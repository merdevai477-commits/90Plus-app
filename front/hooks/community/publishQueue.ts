/**
 * Background publishing for Community posts.
 *
 * The composer closes the moment the user taps "Post": a ghost card shows up
 * at the top of the feed while photos finish uploading and the post is
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
  MAX_POST_IMAGES,
  uploadCommunityImage,
  type CommunityAuthor,
  type CommunityMedia,
  type CommunityPost,
} from '../../services/community.api';
import type { GetTokenFn } from '../../utils/clerkAuthToken';
import { prependPostToFeed } from './communityCache';

/** Long-edge cap before upload — keeps multi-image posts light on R2. */
const MAX_EDGE = 1080;
const JPEG_QUALITY = 0.7;

export { MAX_POST_IMAGES };

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
  kind?: 'TEXT' | 'TEAM_POLL';
  pollOptionA?: string;
  pollOptionB?: string;
  pollOptions?: string[];
  image: LocalImage | null;
  images: LocalImage[];
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

export function imageDraftKey(clientId: string, index: number): string {
  return `${clientId}#img${index}`;
}

export function listImageDraftKeys(clientId: string): string[] {
  const drafts = usePublishStore.getState().drafts;
  const keys: string[] = [];
  for (let i = 0; i < MAX_POST_IMAGES; i++) {
    const key = imageDraftKey(clientId, i);
    if (drafts[key]) keys.push(key);
  }
  // Legacy single-draft key from older compose sessions.
  if (drafts[clientId]) keys.push(clientId);
  return keys;
}

export function listImageDrafts(clientId: string): Array<{ key: string; index: number; draft: MediaDraft }> {
  const drafts = usePublishStore.getState().drafts;
  const out: Array<{ key: string; index: number; draft: MediaDraft }> = [];
  for (let i = 0; i < MAX_POST_IMAGES; i++) {
    const key = imageDraftKey(clientId, i);
    const draft = drafts[key];
    if (draft) out.push({ key, index: i, draft });
  }
  if (!out.length && drafts[clientId]) {
    out.push({ key: clientId, index: 0, draft: drafts[clientId] });
  }
  return out;
}

export function nextImageSlot(clientId: string): number | null {
  const drafts = usePublishStore.getState().drafts;
  for (let i = 0; i < MAX_POST_IMAGES; i++) {
    if (!drafts[imageDraftKey(clientId, i)] && !(i === 0 && drafts[clientId])) return i;
  }
  return null;
}

async function shrink(local: LocalImage): Promise<LocalImage> {
  const longEdge = Math.max(local.width, local.height);
  const actions =
    longEdge > MAX_EDGE
      ? [{ resize: local.width >= local.height ? { width: MAX_EDGE } : { height: MAX_EDGE } }]
      : [];
  const out = await manipulateAsync(local.uri, actions, { compress: JPEG_QUALITY, format: SaveFormat.JPEG });
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

export function cancelAllImageUploads(clientId: string): void {
  for (const key of listImageDraftKeys(clientId)) cancelImageUpload(key);
}

interface PublishInput {
  getToken: GetTokenFn;
  queryClient: QueryClient;
  /** Draft id; reused as the server idempotency key. */
  clientId: string;
  content: string;
  kind?: 'TEXT' | 'TEAM_POLL';
  pollOptionA?: string;
  pollOptionB?: string;
  pollOptions?: string[];
  author: CommunityAuthor;
  onPublished?: (post: CommunityPost) => void;
}

/** Fire-and-forget: shows a ghost post immediately and publishes in the background. */
export function publishPost(input: PublishInput): void {
  const { clientId } = input;
  const imageDrafts = listImageDrafts(clientId);
  const store = usePublishStore.getState();
  const kind = input.kind ?? 'TEXT';
  const isPoll = kind === 'TEAM_POLL';
  const locals = isPoll ? [] : imageDrafts.map((row) => row.draft.local);
  store.upsertPending({
    clientId,
    content: input.content,
    kind,
    pollOptionA: input.pollOptionA,
    pollOptionB: input.pollOptionB,
    pollOptions: input.pollOptions,
    image: locals[0] ?? null,
    images: locals,
    author: input.author,
    createdAt: new Date().toISOString(),
    status: 'publishing',
  });

  const run = async () => {
    usePublishStore.getState().patchPending(clientId, { status: 'publishing', error: undefined });
    try {
      const mediaIds: string[] = [];
      if (!isPoll) {
        // Uploads already start in parallel on pick — wait for all slots together.
        const settled = await Promise.all(
          listImageDrafts(clientId).map(async ({ key, draft }) => {
            let handle = uploads.get(key);
            if (!handle || draft.status === 'failed') {
              startImageUpload(input.getToken, key, draft.local);
              handle = uploads.get(key);
            }
            const media = draft.media ?? (await handle!.promise);
            return media.id;
          }),
        );
        mediaIds.push(...settled);
      }
      const post = await communityApi.createPost(input.getToken, {
        content: input.content,
        mediaId: mediaIds[0] ?? null,
        mediaIds,
        clientId,
        kind,
        ...(isPoll
          ? {
              pollOptionA: input.pollOptions?.[0]?.trim() ?? input.pollOptionA?.trim(),
              pollOptionB: input.pollOptions?.[1]?.trim() ?? input.pollOptionB?.trim(),
              pollOptions: input.pollOptions?.map((option) => option.trim()).filter(Boolean),
            }
          : {}),
      });
      for (const key of listImageDraftKeys(clientId)) {
        uploads.delete(key);
        usePublishStore.getState().setDraft(key, null);
      }
      retryJobs.delete(clientId);
      prependPostToFeed(input.queryClient, post);
      usePublishStore.getState().removePending(clientId);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      input.onPublished?.(post);
    } catch (error) {
      if (error instanceof CommunityApiError && error.code === 'MEDIA_NOT_FOUND') {
        for (const { key } of listImageDrafts(clientId)) {
          usePublishStore.getState().setDraft(key, { status: 'failed', media: undefined });
        }
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
  cancelAllImageUploads(clientId);
  usePublishStore.getState().removePending(clientId);
}

/** Resolves when a single draft photo finishes uploading (or is already done). */
export async function waitForImageUpload(draftKey: string): Promise<CommunityMedia> {
  const current = usePublishStore.getState().drafts[draftKey];
  if (!current) throw new CommunityApiError(0, 'MEDIA_NOT_FOUND', 'No image draft');
  if (current.media) return current.media;
  const handle = uploads.get(draftKey);
  if (!handle) throw new CommunityApiError(0, 'MEDIA_NOT_FOUND', 'Upload not started');
  return handle.promise;
}

export async function waitForAllImageUploads(clientId: string): Promise<CommunityMedia[]> {
  const rows = listImageDrafts(clientId);
  if (!rows.length) return [];
  return Promise.all(rows.map((row) => waitForImageUpload(row.key)));
}
