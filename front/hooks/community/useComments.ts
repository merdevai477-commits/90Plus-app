import { useCallback, useMemo, useRef, useState } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

import { communityApi, type CommunityAuthor, type CommunityComment } from '../../services/community.api';
import {
  communityKeys,
  insertComment,
  removeComment,
  updateCommentEverywhere,
  updatePostEverywhere,
} from './communityCache';
import { useCommunityToken } from './useCommunityFeed';

export type CommentRow =
  | { type: 'comment'; key: string; comment: CommunityComment }
  | { type: 'reply'; key: string; comment: CommunityComment; rootId: string }
  | { type: 'more'; key: string; rootId: string; remaining: number; loading: boolean };

interface ReplyState {
  items: CommunityComment[];
  nextCursor: string | null;
  loading: boolean;
  loadedOnce: boolean;
}

export function useComments(postId: string, enabled = true) {
  const { isLoaded, isSignedIn } = useAuth();
  const getToken = useCommunityToken();
  const qc = useQueryClient();
  const [replyState, setReplyState] = useState<Record<string, ReplyState>>({});
  const likeBusy = useRef(new Set<string>());

  const query = useInfiniteQuery({
    queryKey: communityKeys.comments(postId),
    queryFn: ({ pageParam }) => communityApi.comments(getToken, postId, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: enabled && !!postId && isLoaded === true && isSignedIn === true,
    staleTime: 15_000,
  });

  const rows = useMemo<CommentRow[]>(() => {
    const out: CommentRow[] = [];
    const seen = new Set<string>();
    for (const page of query.data?.pages ?? []) {
      for (const c of page.items) {
        if (seen.has(c.id)) continue;
        seen.add(c.id);
        out.push({ type: 'comment', key: c.id, comment: c });
        const extra = replyState[c.id];
        const inline = c.replies ?? [];
        const merged: CommunityComment[] = [];
        const ids = new Set<string>();
        for (const r of [...inline, ...(extra?.items ?? [])]) {
          if (ids.has(r.id)) continue;
          ids.add(r.id);
          merged.push(r);
        }
        merged.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        for (const r of merged) out.push({ type: 'reply', key: r.id, comment: r, rootId: c.id });
        const remaining = Math.max(0, c.repliesCount - merged.length);
        if (remaining > 0 && (!extra?.loadedOnce || extra.nextCursor)) {
          out.push({ type: 'more', key: `more-${c.id}`, rootId: c.id, remaining, loading: !!extra?.loading });
        }
      }
    }
    return out;
  }, [query.data, replyState]);

  const loadMoreReplies = useCallback(
    async (rootId: string) => {
      const current = replyState[rootId];
      if (current?.loading) return;
      setReplyState((s) => ({
        ...s,
        [rootId]: { items: s[rootId]?.items ?? [], nextCursor: s[rootId]?.nextCursor ?? null, loading: true, loadedOnce: !!s[rootId]?.loadedOnce },
      }));
      try {
        const page = await communityApi.replies(getToken, rootId, current?.nextCursor ?? null);
        setReplyState((s) => ({
          ...s,
          [rootId]: {
            items: [...(s[rootId]?.items ?? []), ...page.items],
            nextCursor: page.nextCursor,
            loading: false,
            loadedOnce: true,
          },
        }));
      } catch {
        setReplyState((s) => ({ ...s, [rootId]: { ...(s[rootId] as ReplyState), loading: false } }));
      }
    },
    [getToken, replyState],
  );

  const patchLocalReply = useCallback((commentId: string, fn: (c: CommunityComment) => CommunityComment) => {
    setReplyState((s) => {
      let changed = false;
      const next: Record<string, ReplyState> = {};
      for (const [k, v] of Object.entries(s)) {
        if (v.items.some((c) => c.id === commentId)) {
          changed = true;
          next[k] = { ...v, items: v.items.map((c) => (c.id === commentId ? fn(c) : c)) };
        } else next[k] = v;
      }
      return changed ? next : s;
    });
  }, []);

  const dropLocalReply = useCallback((commentId: string) => {
    setReplyState((s) => {
      const next: Record<string, ReplyState> = {};
      for (const [k, v] of Object.entries(s)) next[k] = { ...v, items: v.items.filter((c) => c.id !== commentId) };
      return next;
    });
  }, []);

  const toggleLike = useCallback(
    async (comment: CommunityComment) => {
      if (likeBusy.current.has(comment.id) || comment.id.startsWith('temp-')) return;
      likeBusy.current.add(comment.id);
      const next = !comment.likedByMe;
      if (next) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const flip = (c: CommunityComment) => ({
        ...c,
        likedByMe: next,
        likesCount: Math.max(0, c.likesCount + (next ? 1 : -1)),
      });
      updateCommentEverywhere(qc, postId, comment.id, flip);
      patchLocalReply(comment.id, flip);
      try {
        const res = await communityApi.likeComment(getToken, comment.id, next);
        const settle = (c: CommunityComment) => ({ ...c, likedByMe: res.liked, likesCount: res.likesCount });
        updateCommentEverywhere(qc, postId, comment.id, settle);
        patchLocalReply(comment.id, settle);
      } catch {
        const revert = (c: CommunityComment) => ({
          ...c,
          likedByMe: !next,
          likesCount: Math.max(0, c.likesCount + (next ? -1 : 1)),
        });
        updateCommentEverywhere(qc, postId, comment.id, revert);
        patchLocalReply(comment.id, revert);
      } finally {
        likeBusy.current.delete(comment.id);
      }
    },
    [getToken, patchLocalReply, postId, qc],
  );

  /** Optimistic comment/reply. Resolves with the saved comment or throws the API error. */
  const submit = useCallback(
    async (content: string, author: CommunityAuthor, replyTo: CommunityComment | null) => {
      const rootId = replyTo ? replyTo.parentId ?? replyTo.id : null;
      const temp: CommunityComment = {
        id: `temp-${Date.now()}`,
        postId,
        parentId: rootId,
        content,
        createdAt: new Date().toISOString(),
        author,
        likesCount: 0,
        repliesCount: 0,
        likedByMe: false,
        isMine: true,
        replies: [],
      };
      insertComment(qc, temp);
      updatePostEverywhere(qc, postId, (p) => ({ ...p, commentsCount: p.commentsCount + 1 }));
      try {
        const saved = await communityApi.createComment(getToken, postId, {
          content,
          parentId: replyTo?.id ?? null,
        });
        updateCommentEverywhere(qc, postId, temp.id, () => ({ ...saved, replies: saved.replies ?? [] }));
        return saved;
      } catch (err) {
        removeComment(qc, postId, temp.id);
        updatePostEverywhere(qc, postId, (p) => ({ ...p, commentsCount: Math.max(0, p.commentsCount - 1) }));
        throw err;
      }
    },
    [getToken, postId, qc],
  );

  const remove = useCallback(
    async (comment: CommunityComment) => {
      const removed = 1 + (comment.parentId ? 0 : comment.repliesCount);
      removeComment(qc, postId, comment.id);
      dropLocalReply(comment.id);
      updatePostEverywhere(qc, postId, (p) => ({ ...p, commentsCount: Math.max(0, p.commentsCount - removed) }));
      try {
        await communityApi.deleteComment(getToken, comment.id);
      } catch {
        void qc.invalidateQueries({ queryKey: communityKeys.comments(postId) });
      }
    },
    [dropLocalReply, getToken, postId, qc],
  );

  const hideLocally = useCallback(
    (comment: CommunityComment) => {
      removeComment(qc, postId, comment.id);
      dropLocalReply(comment.id);
    },
    [dropLocalReply, postId, qc],
  );

  return { ...query, rows, loadMoreReplies, toggleLike, submit, remove, hideLocally };
}
