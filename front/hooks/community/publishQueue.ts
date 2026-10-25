/**
 * Background publishing for Community posts.
 *
 * The composer closes the moment the user taps "Post": a ghost card shows up
 * at the top of the feed while the photo finishes uploading and the post is
 * created. Photos start uploading as soon as they're picked, so by the time
 * the user is done typing the slow part is usually already over.
 */

import * as Haptics from 'expo-haptics';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import type { QueryClient } from '@tanstack/react-query';
import { create } from 'zustand';

import {
  CommunityApiError,
  communityApi,
  uploadCommunityImage,
  type CommunityAuthor,
  type CommunityMedia,
  type CommunityPost,
} from '../../services/community.api';
import type { GetTokenFn } from '../../utils/clerkAuthToken';
import { prependPostToFeed } from './communityCache';

const MAX_EDGE = 1440;

export interface LocalImage {
  uri: string;
  width: number;
  height: number;
}

export interface MediaDraft {
  local: LocalImage;
  progress: number;
  status: 'uploading' | 'done' | 'failed';
  media?: CommunityMedia;
  error?: unknown;
}

export interface PendingPost {
  clientId: string;
  content: string;
  image: LocalImage | null;
  author: CommunityAuthor;
  createdAt: string;
  status: 'publishing' | 'failed';
  error?: unknown;
}

interface PublishState {
  drafts: Record<string, MediaDraft>;
  pending: PendingPost[];
  setDraft: (id: string, patch: Partial<MediaDraft> | null) => void;
  upsertPending: (post: PendingPost) => void;
  patchPending: (clientId: string, patch: Partial<PendingPost>) => void;
  removePending: (clientId: string) => void;
}

export const usePublishStore = create<PublishState>((set) => ({
  drafts: {},
  pending: [],
  setDraft: (id, patch) =>
    set((s) => {
      const drafts = { ...s.drafts };
      if (patch === null) delete drafts[id];
      else drafts[id] = { ...(drafts[id] as MediaDraft), ...patch };
      return { drafts };
    }),
  upsertPending: (post) =>
    set((s) => ({ pending: [post, ...s.pending.filter((p) => p.clientId !== post.clientId)] })),
  patchPending: (clientId, patch) =>
    set((s) => ({ pending: s.pending.map((p) => (p.clientId === clientId ? { ...p, ...patch } : p)) })),
  removePending: (clientId) => set((s) => ({ pending: s.pending.filter((p) => p.clientId !== clientId) })),
}));

interface UploadHandle {
  promise: Promise<CommunityMedia>;
  abort: () => void;
}

const uploads = new Map<string, UploadHandle>();
const retryJobs = new Map<string, () => void>();

export function newClientId(): string {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

async function shrink(local: LocalImage): Promise<LocalImage> {
  const longEdge = Math.max(local.width, local.height);
  const actions =
    longEdge > MAX_EDGE
      ? [{ resize: local.width >= local.height ? { width: MAX_EDGE } : { height: MAX_EDGE } }]
      : [];
  const out = await manipulateAsync(local.uri, actions, { compress: 0.82, format: SaveFormat.JPEG });
  return { uri: out.uri, width: out.width, height: out.height };
}

/** Starts compressing + uploading a picked photo for the draft `id`. */
export function startImageUpload(getToken: GetTokenFn, id: string, picked: LocalImage): void {
  cancelImageUpload(id);
  const store = usePublishStore.getState();
  store.setDraft(id, { local: picked, progress: 0.02, status: 'uploading', media: undefined, error: undefined });

  let inner: UploadHandle | null = null;
  let cancelled = false;
  const promise = (async () => {
    const small = await shrink(picked).catch(() => picked);
    if (cancelled) throw new CommunityApiError(0, 'ABORTED', 'Upload cancelled');
    inner = uploadCommunityImage(
      getToken,
      { uri: small.uri, mimeType: 'image/jpeg', name: 'photo.jpg' },
      (p) => usePublishStore.getState().setDraft(id, { progress: 0.05 + p * 0.95 }),
    );
    return inner.promise;
  })();

  const handle: UploadHandle = {
    promise,
    abort: () => {
      cancelled = true;
      inner?.abort();
    },
  };
  uploads.set(id, handle);

  promise.then(
    (media) => {
      if (uploads.get(id) !== handle) return;
      usePublishStore.getState().setDraft(id, { status: 'done', progress: 1, media });
    },
    (error) => {
      if (uploads.get(id) !== handle) return;
      usePublishStore.getState().setDraft(id, { status: 'failed', error });
    },
  );
}

export function cancelImageUpload(id: string): void {
  uploads.get(id)?.abort();
  uploads.delete(id);
  usePublishStore.getState().setDraft(id, null);
}

interface PublishInput {
  getToken: GetTokenFn;
  queryClient: QueryClient;
  /** Draft id; reused as the server idempotency key. */
  clientId: string;
  content: string;
  author: CommunityAuthor;
  onPublished?: (post: CommunityPost) => void;
}

/** Fire-and-forget: shows a ghost post immediately and publishes in the background. */
export function publishPost(input: PublishInput): void {
  const { clientId } = input;
  const draft = usePublishStore.getState().drafts[clientId];
  const store = usePublishStore.getState();
  store.upsertPending({
    clientId,
    content: input.content,
    image: draft?.local ?? null,
    author: input.author,
    createdAt: new Date().toISOString(),
    status: 'publishing',
  });

  const run = async () => {
    usePublishStore.getState().patchPending(clientId, { status: 'publishing', error: undefined });
    try {
      let mediaId: string | null = null;
      const current = usePublishStore.getState().drafts[clientId];
      if (current) {
        let handle = uploads.get(clientId);
        if (!handle || current.status === 'failed') {
          startImageUpload(input.getToken, clientId, current.local);
          handle = uploads.get(clientId);
        }
        const media = current.media ?? (await handle!.promise);
        mediaId = media.id;
      }
      const post = await communityApi.createPost(input.getToken, {
        content: input.content,
        mediaId,
        clientId,
      });
      uploads.delete(clientId);
      retryJobs.delete(clientId);
      prependPostToFeed(input.queryClient, post);
      usePublishStore.getState().removePending(clientId);
      usePublishStore.getState().setDraft(clientId, null);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      input.onPublished?.(post);
    } catch (error) {
      if (error instanceof CommunityApiError && error.code === 'MEDIA_NOT_FOUND') {
        const d = usePublishStore.getState().drafts[clientId];
        if (d) usePublishStore.getState().setDraft(clientId, { status: 'failed', media: undefined });
      }
      usePublishStore.getState().patchPending(clientId, { status: 'failed', error });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  retryJobs.set(clientId, () => void run());
  void run();
}

export function retryPending(clientId: string): void {
  retryJobs.get(clientId)?.();
}

export function discardPending(clientId: string): void {
  retryJobs.delete(clientId);
  cancelImageUpload(clientId);
  usePublishStore.getState().removePending(clientId);
}
