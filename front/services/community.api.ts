/**
 * Community (المجتمع) API client — thin wrapper over `/api/community/*`.
 * Every call takes Clerk's `getToken` so it works from hooks and from the
 * background publish queue alike.
 */

import { getApiUrl } from '../config/api.config';
import { fetchWithClerkAuth, getClerkBearerToken, type GetTokenFn } from '../utils/clerkAuthToken';

export interface CommunityAuthor {
  id: string;
  username: string;
  displayName: string | null;
  avatar: string | null;
  isVerified: boolean;
}

export interface CommunityImage {
  url: string;
  width: number;
  height: number;
  placeholder: string | null;
}

export interface CommunityPost {
  id: string;
  content: string;
  createdAt: string;
  image: CommunityImage | null;
  author: CommunityAuthor;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  likedByMe: boolean;
  isMine: boolean;
}

export interface CommunityComment {
  id: string;
  postId: string;
  parentId: string | null;
  content: string;
  createdAt: string;
  author: CommunityAuthor;
  likesCount: number;
  repliesCount: number;
  likedByMe: boolean;
  isMine: boolean;
  replies?: CommunityComment[];
}

export interface CommunityPage<T> {
  items: T[];
  nextCursor: string | null;
}

export interface CommunityMedia {
  id: string;
  url: string;
  width: number;
  height: number;
  placeholder: string | null;
}

export type ReportReason = 'SPAM' | 'HARASSMENT' | 'INAPPROPRIATE' | 'FAKE_INFO' | 'OTHER';

export class CommunityApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public retryAfterSec?: number,
    public max?: number,
  ) {
    super(message);
  }
}

const base = () => `${getApiUrl()}/community`;

async function request<T>(getToken: GetTokenFn, path: string, init: RequestInit = {}): Promise<T> {
  let res: Response | null;
  try {
    res = await fetchWithClerkAuth(getToken, `${base()}${path}`, init);
  } catch {
    throw new CommunityApiError(0, 'NETWORK', 'Network error');
  }
  if (!res) throw new CommunityApiError(401, 'AUTH_REQUIRED', 'Not signed in');
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.status !== 'SUCCESS') {
    throw new CommunityApiError(
      res.status,
      json?.code ?? 'UNKNOWN',
      json?.message ?? `Request failed (${res.status})`,
      typeof json?.retryAfterSec === 'number' ? json.retryAfterSec : undefined,
      typeof json?.max === 'number' ? json.max : undefined,
    );
  }
  return json.data as T;
}

const qs = (params: Record<string, string | null | undefined>) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) s.set(k, v);
  const str = s.toString();
  return str ? `?${str}` : '';
};

const json = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const communityApi = {
  feed: (getToken: GetTokenFn, cursor?: string | null) =>
    request<CommunityPage<CommunityPost>>(getToken, `/feed${qs({ cursor })}`),

  trending: (getToken: GetTokenFn) => request<{ tag: string; count: number }[]>(getToken, '/trending'),

  hashtagPosts: (getToken: GetTokenFn, tag: string, cursor?: string | null) =>
    request<CommunityPage<CommunityPost> & { tag: string; postsCount: number }>(
      getToken,
      `/hashtags/${encodeURIComponent(tag)}/posts${qs({ cursor })}`,
    ),

  userPosts: (getToken: GetTokenFn, username: string, cursor?: string | null) =>
    request<CommunityPage<CommunityPost> & { author: CommunityAuthor | null }>(
      getToken,
      `/users/${encodeURIComponent(username)}/posts${qs({ cursor })}`,
    ),

  post: (getToken: GetTokenFn, id: string) => request<CommunityPost>(getToken, `/posts/${id}`),

  createPost: (getToken: GetTokenFn, body: { content: string; mediaId?: string | null; clientId: string }) =>
    request<CommunityPost>(getToken, '/posts', json(body)),

  deletePost: (getToken: GetTokenFn, id: string) =>
    request<{ deleted: true }>(getToken, `/posts/${id}`, { method: 'DELETE' }),

  likePost: (getToken: GetTokenFn, id: string, like: boolean) =>
    request<{ likesCount: number; liked: boolean }>(getToken, `/posts/${id}/like`, { method: like ? 'POST' : 'DELETE' }),

  sharePost: (getToken: GetTokenFn, id: string, platform?: string) =>
    request<{ sharesCount: number }>(getToken, `/posts/${id}/share`, json({ platform })),

  report: (getToken: GetTokenFn, kind: 'post' | 'comment', id: string, type: ReportReason) =>
    request<{ reported: true; hidden: boolean }>(
      getToken,
      `/${kind === 'post' ? 'posts' : 'comments'}/${id}/report`,
      json({ type, reason: type }),
    ),

  comments: (getToken: GetTokenFn, postId: string, cursor?: string | null) =>
    request<CommunityPage<CommunityComment>>(getToken, `/posts/${postId}/comments${qs({ cursor })}`),

  replies: (getToken: GetTokenFn, commentId: string, cursor?: string | null) =>
    request<CommunityPage<CommunityComment>>(getToken, `/comments/${commentId}/replies${qs({ cursor })}`),

  createComment: (getToken: GetTokenFn, postId: string, body: { content: string; parentId?: string | null }) =>
    request<CommunityComment>(getToken, `/posts/${postId}/comments`, json(body)),

  deleteComment: (getToken: GetTokenFn, id: string) =>
    request<{ deleted: true }>(getToken, `/comments/${id}`, { method: 'DELETE' }),

  likeComment: (getToken: GetTokenFn, id: string, like: boolean) =>
    request<{ likesCount: number; liked: boolean }>(getToken, `/comments/${id}/like`, { method: like ? 'POST' : 'DELETE' }),

  searchMentions: (getToken: GetTokenFn, q: string) =>
    request<CommunityAuthor[]>(getToken, `/mentions/search${qs({ q })}`),
};

/**
 * Multipart upload with progress (fetch has no upload progress on RN).
 */
export function uploadCommunityImage(
  getToken: GetTokenFn,
  file: { uri: string; mimeType: string; name: string },
  onProgress?: (fraction: number) => void,
): { promise: Promise<CommunityMedia>; abort: () => void } {
  let xhr: XMLHttpRequest | null = null;
  let aborted = false;

  const promise = (async () => {
    const token = await getClerkBearerToken(getToken);
    if (!token) throw new CommunityApiError(401, 'AUTH_REQUIRED', 'Not signed in');
    if (aborted) throw new CommunityApiError(0, 'ABORTED', 'Upload cancelled');

    const form = new FormData();
    form.append('image', { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob);

    return new Promise<CommunityMedia>((resolve, reject) => {
      xhr = new XMLHttpRequest();
      xhr.open('POST', `${base()}/media`);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.timeout = 90_000;
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) onProgress(Math.min(0.98, e.loaded / e.total));
      };
      xhr.onload = () => {
        let body: any = null;
        try {
          body = JSON.parse(xhr!.responseText);
        } catch {
          /* non-JSON */
        }
        if (xhr!.status >= 200 && xhr!.status < 300 && body?.status === 'SUCCESS') {
          onProgress?.(1);
          resolve(body.data as CommunityMedia);
        } else {
          reject(
            new CommunityApiError(
              xhr!.status,
              body?.code ?? 'UPLOAD_FAILED',
              body?.message ?? 'Upload failed',
              typeof body?.retryAfterSec === 'number' ? body.retryAfterSec : undefined,
            ),
          );
        }
      };
      xhr.onerror = () => reject(new CommunityApiError(0, 'NETWORK', 'Network error'));
      xhr.ontimeout = () => reject(new CommunityApiError(0, 'TIMEOUT', 'Upload timed out'));
      xhr.onabort = () => reject(new CommunityApiError(0, 'ABORTED', 'Upload cancelled'));
      xhr.send(form);
    });
  })();

  return {
    promise,
    abort: () => {
      aborted = true;
      xhr?.abort();
    },
  };
}
