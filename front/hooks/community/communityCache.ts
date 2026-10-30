/**
 * React Query keys and cache patchers for Community. A post can live in the
 * main feed, a hashtag feed, a profile feed and its own detail query at the
 * same time — every mutation patches all of them so the UI never disagrees.
 */

import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import type { CommunityComment, CommunityPage, CommunityPost } from '../../services/community.api';

export const communityKeys = {
  all: ['community'] as const,
  feed: ['community', 'feed'] as const,
  trending: ['community', 'trending'] as const,
  tag: (tag: string) => ['community', 'tag', tag.toLowerCase()] as const,
  user: (username: string) => ['community', 'user', username.toLowerCase()] as const,
  post: (id: string) => ['community', 'post', id] as const,
  comments: (postId: string) => ['community', 'comments', postId] as const,
  replies: (commentId: string) => ['community', 'replies', commentId] as const,
};

type PostPages = InfiniteData<CommunityPage<CommunityPost>, string | null>;

function isPostPages(data: unknown): data is PostPages {
  const d = data as PostPages | undefined;
  return !!d && Array.isArray(d.pages) && d.pages.every((p) => Array.isArray(p?.items));
}

function isPost(data: unknown): data is CommunityPost {
  const d = data as CommunityPost | undefined;
  return !!d && typeof d.id === 'string' && 'likedByMe' in d && 'author' in d;
}

const postQueryFilter = (key: readonly unknown[]) =>
  key[0] === 'community' && (key[1] === 'feed' || key[1] === 'tag' || key[1] === 'user' || key[1] === 'post');

export function updateAuthorFollowingEverywhere(qc: QueryClient, authorId: string, isFollowing: boolean): void {
  for (const query of qc.getQueryCache().findAll({ predicate: (q) => postQueryFilter(q.queryKey) })) {
    const data = query.state.data;
    if (isPostPages(data)) {
      let changed = false;
      const pages = data.pages.map((page) => {
        let pageChanged = false;
        const items = page.items.map((p) => {
          if (p.author.id !== authorId) return p;
          pageChanged = true;
          return { ...p, author: { ...p.author, isFollowing } };
        });
        if (!pageChanged) return page;
        changed = true;
        return { ...page, items };
      });
      if (changed) qc.setQueryData(query.queryKey, { ...data, pages });
    } else if (isPost(data) && data.author.id === authorId) {
      qc.setQueryData(query.queryKey, { ...data, author: { ...data.author, isFollowing } });
    }
  }
}

export function updatePostEverywhere(
  qc: QueryClient,
  postId: string,
  updater: (post: CommunityPost) => CommunityPost,
): void {
  for (const query of qc.getQueryCache().findAll({ predicate: (q) => postQueryFilter(q.queryKey) })) {
    const data = query.state.data;
    if (isPostPages(data)) {
      let changed = false;
      const pages = data.pages.map((page) => {
        let pageChanged = false;
        const items = page.items.map((p) => {
          if (p.id !== postId) return p;
          pageChanged = true;
          return updater(p);
        });
        if (!pageChanged) return page;
        changed = true;
        return { ...page, items };
      });
      if (changed) qc.setQueryData(query.queryKey, { ...data, pages });
    } else if (isPost(data) && data.id === postId) {
      qc.setQueryData(query.queryKey, updater(data));
    }
  }
}

export function findPost(qc: QueryClient, postId: string): CommunityPost | undefined {
  for (const query of qc.getQueryCache().findAll({ predicate: (q) => postQueryFilter(q.queryKey) })) {
    const data = query.state.data;
    if (isPostPages(data)) {
      for (const page of data.pages) {
        const hit = page.items.find((p) => p.id === postId);
        if (hit) return hit;
      }
    } else if (isPost(data) && data.id === postId) {
      return data;
    }
  }
  return undefined;
}

export function removePostEverywhere(qc: QueryClient, postId: string): void {
  for (const query of qc.getQueryCache().findAll({ predicate: (q) => postQueryFilter(q.queryKey) })) {
    const data = query.state.data;
    if (!isPostPages(data)) continue;
    if (!data.pages.some((p) => p.items.some((i) => i.id === postId))) continue;
    qc.setQueryData(query.queryKey, {
      ...data,
      pages: data.pages.map((page) => ({ ...page, items: page.items.filter((i) => i.id !== postId) })),
    });
  }
}

export function removeAuthorEverywhere(qc: QueryClient, authorId: string): void {
  for (const query of qc.getQueryCache().findAll({ predicate: (q) => postQueryFilter(q.queryKey) })) {
    const data = query.state.data;
    if (!isPostPages(data)) continue;
    qc.setQueryData(query.queryKey, {
      ...data,
      pages: data.pages.map((page) => ({ ...page, items: page.items.filter((i) => i.author.id !== authorId) })),
    });
  }
}

export function prependPostToFeed(qc: QueryClient, post: CommunityPost): void {
  qc.setQueryData<PostPages>(communityKeys.feed, (data) => {
    if (!data || !data.pages.length) {
      return { pages: [{ items: [post], nextCursor: null }], pageParams: [null] };
    }
    const [first, ...rest] = data.pages;
    if (first.items.some((p) => p.id === post.id)) return data;
    return { ...data, pages: [{ ...first, items: [post, ...first.items] }, ...rest] };
  });
  qc.setQueryData(communityKeys.post(post.id), post);
}

// ─── Comments ─────────────────────────────────────────────────────────────

type CommentPages = InfiniteData<CommunityPage<CommunityComment>, string | null>;

function mapComment(c: CommunityComment, id: string, fn: (c: CommunityComment) => CommunityComment): CommunityComment {
  if (c.id === id) return fn(c);
  if (c.replies?.some((r) => r.id === id)) {
    return { ...c, replies: c.replies.map((r) => (r.id === id ? fn(r) : r)) };
  }
  return c;
}

export function updateCommentEverywhere(
  qc: QueryClient,
  postId: string,
  commentId: string,
  fn: (c: CommunityComment) => CommunityComment,
): void {
  qc.setQueryData<CommentPages>(communityKeys.comments(postId), (data) =>
    data
      ? { ...data, pages: data.pages.map((p) => ({ ...p, items: p.items.map((c) => mapComment(c, commentId, fn)) })) }
      : data,
  );
  for (const query of qc.getQueryCache().findAll({ queryKey: ['community', 'replies'] })) {
    const data = query.state.data as CommentPages | undefined;
    if (!data?.pages?.some((p) => p.items.some((c) => c.id === commentId))) continue;
    qc.setQueryData<CommentPages>(query.queryKey, {
      ...data,
      pages: data.pages.map((p) => ({ ...p, items: p.items.map((c) => (c.id === commentId ? fn(c) : c)) })),
    });
  }
}

export function insertComment(qc: QueryClient, comment: CommunityComment): void {
  const postId = comment.postId;
  if (!comment.parentId) {
    qc.setQueryData<CommentPages>(communityKeys.comments(postId), (data) => {
      if (!data || !data.pages.length) return { pages: [{ items: [comment], nextCursor: null }], pageParams: [null] };
      const [first, ...rest] = data.pages;
      return { ...data, pages: [{ ...first, items: [comment, ...first.items] }, ...rest] };
    });
    return;
  }
  const parentId = comment.parentId;
  qc.setQueryData<CommentPages>(communityKeys.comments(postId), (data) =>
    data
      ? {
          ...data,
          pages: data.pages.map((p) => ({
            ...p,
            items: p.items.map((c) =>
              c.id === parentId
                ? { ...c, repliesCount: c.repliesCount + 1, replies: [...(c.replies ?? []), comment] }
                : c,
            ),
          })),
        }
      : data,
  );
}

export function removeComment(qc: QueryClient, postId: string, commentId: string): void {
  qc.setQueryData<CommentPages>(communityKeys.comments(postId), (data) =>
    data
      ? {
          ...data,
          pages: data.pages.map((p) => ({
            ...p,
            items: p.items
              .filter((c) => c.id !== commentId)
              .map((c) =>
                c.replies?.some((r) => r.id === commentId)
                  ? {
                      ...c,
                      repliesCount: Math.max(0, c.repliesCount - 1),
                      replies: c.replies.filter((r) => r.id !== commentId),
                    }
                  : c,
              ),
          })),
        }
      : data,
  );
  for (const query of qc.getQueryCache().findAll({ queryKey: ['community', 'replies'] })) {
    const data = query.state.data as CommentPages | undefined;
    if (!data?.pages?.some((p) => p.items.some((c) => c.id === commentId))) continue;
    qc.setQueryData<CommentPages>(query.queryKey, {
      ...data,
      pages: data.pages.map((p) => ({ ...p, items: p.items.filter((c) => c.id !== commentId) })),
    });
  }
}
