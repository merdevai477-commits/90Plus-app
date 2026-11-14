import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';

import { CommentItem } from '../../components/community/CommentItem';
import type { CommentComposerHandle } from '../../components/community/CommentComposer';
import type { ActionMenuItem } from '../../components/community/ActionMenu';
import { fillTemplate, formatRelativeTime } from '../../components/community/format';
import { mapReelComment } from '../../components/reels/mapReelComment';
import { C } from '../../components/community/theme';
import type { CommentRow } from '../community/useComments';
import { useCommunityMe } from '../community/useCommunityMe';
import { REPORT_REASONS } from '../community/usePostActions';
import type { CommunityComment } from '../../services/community.api';
import { toastManager } from '../../services/toastManager';
import { ReelsService } from '../../src/services/authService';
import { useTranslation } from '../../src/i18n';
import { getClerkBearerToken } from '../../utils/clerkAuthToken';
import { getAppFont } from '../../utils/fontSetup';
import { navigateUserProfile } from '../../utils/navigateUserProfile';

interface ReplyState {
  items: CommunityComment[];
  loading: boolean;
  loadedOnce: boolean;
}

export function useReelCommentThread(
  reelId: string | null,
  enabled: boolean,
  options?: { canModerate?: boolean; onAdded?: () => void; onRemoved?: () => void },
) {
  const { t, language } = useTranslation();
  const s = t.community;
  const isAr = language === 'ar';
  const me = useCommunityMe();
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [roots, setRoots] = useState<CommunityComment[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [replyState, setReplyState] = useState<Record<string, ReplyState>>({});
  const [totalCount, setTotalCount] = useState(0);
  const [menu, setMenu] = useState<CommunityComment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CommunityComment | null>(null);
  const [reportTarget, setReportTarget] = useState<CommunityComment | null>(null);
  const composerRef = useRef<CommentComposerHandle>(null);
  const likeBusy = useRef(new Set<string>());

  const fonts = useMemo(
    () => ({ regular: getAppFont(400, language), medium: getAppFont(500, language), semibold: getAppFont(600, language) }),
    [language],
  );

  const loadPage = useCallback(async (cursor: string | null, append: boolean) => {
    if (!reelId) return;
    if (append) setLoadingMore(true);
    else setLoading(true);
    try {
      const token = await getClerkBearerToken(getTokenRef.current);
      if (!token) return;
      const result = await ReelsService.getComments(token, reelId, 20, cursor);
      const mapped = (result.comments || []).map((row) => mapReelComment(row, reelId, me.id));
      setRoots((prev) => (append ? [...prev, ...mapped] : mapped));
      setNextCursor(result.nextCursor ?? null);
      if (typeof result.totalCount === 'number' && !append) setTotalCount(result.totalCount);
    } catch {
      if (!append) setRoots([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [me.id, reelId]);

  useEffect(() => {
    if (!enabled || !reelId) return;
    setRoots([]);
    setReplyState({});
    setNextCursor(null);
    void loadPage(null, false);
  }, [enabled, reelId, loadPage]);

  const rows = useMemo<CommentRow[]>(() => {
    const out: CommentRow[] = [];
    for (const comment of roots) {
      out.push({ type: 'comment', key: comment.id, comment });
      const extra = replyState[comment.id];
      const merged: CommunityComment[] = [];
      const ids = new Set<string>();
      for (const reply of [...(comment.replies ?? []), ...(extra?.items ?? [])]) {
        if (ids.has(reply.id)) continue;
        ids.add(reply.id);
        merged.push(reply);
      }
      merged.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      for (const reply of merged) out.push({ type: 'reply', key: reply.id, comment: reply, rootId: comment.id });
      const remaining = Math.max(0, comment.repliesCount - merged.length);
      if (remaining > 0 && !extra?.loadedOnce) {
        out.push({ type: 'more', key: `more-${comment.id}`, rootId: comment.id, remaining, loading: !!extra?.loading });
      }
    }
    return out;
  }, [replyState, roots]);

  const patch = useCallback((id: string, fn: (comment: CommunityComment) => CommunityComment) => {
    setRoots((list) => list.map((comment) => {
      if (comment.id === id) return fn(comment);
      if (comment.replies?.some((reply) => reply.id === id)) {
        return { ...comment, replies: comment.replies.map((reply) => (reply.id === id ? fn(reply) : reply)) };
      }
      return comment;
    }));
    setReplyState((state) => {
      let changed = false;
      const next: Record<string, ReplyState> = {};
      for (const [key, value] of Object.entries(state)) {
        if (value.items.some((item) => item.id === id)) {
          changed = true;
          next[key] = { ...value, items: value.items.map((item) => (item.id === id ? fn(item) : item)) };
        } else next[key] = value;
      }
      return changed ? next : state;
    });
  }, []);

  const loadMoreReplies = useCallback(async (rootId: string) => {
    if (replyState[rootId]?.loading) return;
    setReplyState((state) => ({
      ...state,
      [rootId]: { items: state[rootId]?.items ?? [], loading: true, loadedOnce: !!state[rootId]?.loadedOnce },
    }));
    try {
      const token = await getClerkBearerToken(getTokenRef.current);
      const list = token ? await ReelsService.getReplies(token, rootId, 50) : [];
      const mapped = (list || []).map((row: any) => mapReelComment(row, reelId || '', me.id));
      setReplyState((state) => ({
        ...state,
        [rootId]: { items: mapped, loading: false, loadedOnce: true },
      }));
    } catch {
      setReplyState((state) => ({ ...state, [rootId]: { ...(state[rootId] as ReplyState), loading: false } }));
    }
  }, [me.id, reelId, replyState]);

  const toggleLike = useCallback(async (comment: CommunityComment) => {
    if (likeBusy.current.has(comment.id) || comment.id.startsWith('temp-')) return;
    likeBusy.current.add(comment.id);
    const next = !comment.likedByMe;
    if (next) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    patch(comment.id, (item) => ({
      ...item,
      likedByMe: next,
      likesCount: Math.max(0, item.likesCount + (next ? 1 : -1)),
    }));
    try {
      const token = await getClerkBearerToken(getTokenRef.current);
      if (!token) throw new Error('AUTH');
      const res = next
        ? await ReelsService.likeComment(token, comment.id)
        : await ReelsService.unlikeComment(token, comment.id);
      if (typeof res.likesCount === 'number') {
        patch(comment.id, (item) => ({ ...item, likesCount: res.likesCount as number, likedByMe: next }));
      }
    } catch {
      patch(comment.id, (item) => ({
        ...item,
        likedByMe: !next,
        likesCount: Math.max(0, item.likesCount + (next ? -1 : 1)),
      }));
    } finally {
      likeBusy.current.delete(comment.id);
    }
  }, [patch]);

  const submit = useCallback(async (content: string, replyTo: CommunityComment | null) => {
    if (!reelId) return;
    const rootId = replyTo ? replyTo.parentId ?? replyTo.id : null;
    const temp: CommunityComment = {
      id: `temp-${Date.now()}`,
      postId: reelId,
      parentId: rootId,
      content,
      createdAt: new Date().toISOString(),
      author: me,
      likesCount: 0,
      repliesCount: 0,
      likedByMe: false,
      isMine: true,
      replies: [],
    };
    if (rootId) {
      setReplyState((state) => ({
        ...state,
        [rootId]: { items: [...(state[rootId]?.items ?? []), temp], loading: false, loadedOnce: true },
      }));
      setRoots((list) => list.map((comment) => (
        comment.id === rootId ? { ...comment, repliesCount: comment.repliesCount + 1 } : comment
      )));
    } else {
      setRoots((list) => [temp, ...list]);
    }
    setTotalCount((count) => count + 1);
    options?.onAdded?.();
    try {
      const token = await getClerkBearerToken(getTokenRef.current);
      if (!token) throw new Error('AUTH');
      const result = rootId
        ? await ReelsService.addReply(token, reelId, rootId, content)
        : await ReelsService.addComment(token, reelId, content);
      const savedRaw = rootId ? result.reply : result.comment;
      if (!result.success || !savedRaw) throw new Error(result.error || 'FAILED');
      const saved = mapReelComment({ ...savedRaw, parentId: rootId }, reelId, me.id);
      patch(temp.id, () => ({ ...saved, isMine: true, replies: [] }));
      return saved;
    } catch (err) {
      if (rootId) {
        setReplyState((state) => ({
          ...state,
          [rootId]: {
            ...(state[rootId] as ReplyState),
            items: (state[rootId]?.items ?? []).filter((item) => item.id !== temp.id),
          },
        }));
        setRoots((list) => list.map((comment) => (
          comment.id === rootId ? { ...comment, repliesCount: Math.max(0, comment.repliesCount - 1) } : comment
        )));
      } else {
        setRoots((list) => list.filter((item) => item.id !== temp.id));
      }
      setTotalCount((count) => Math.max(0, count - 1));
      options?.onRemoved?.();
      throw err;
    }
  }, [me, options, patch, reelId]);

  const remove = useCallback(async (comment: CommunityComment) => {
    const token = await getClerkBearerToken(getTokenRef.current);
    if (!token) return;
    const result = await ReelsService.deleteComment(token, comment.id);
    if (!result.success) {
      toastManager.showError(s.delete, result.message || s.failedToPost);
      return;
    }
    setRoots((list) => list
      .filter((item) => item.id !== comment.id)
      .map((item) => ({
        ...item,
        replies: (item.replies ?? []).filter((reply) => reply.id !== comment.id),
        repliesCount: item.replies?.some((reply) => reply.id === comment.id)
          ? Math.max(0, item.repliesCount - 1)
          : item.repliesCount,
      })));
    setReplyState((state) => {
      const next: Record<string, ReplyState> = {};
      for (const [key, value] of Object.entries(state)) {
        next[key] = { ...value, items: value.items.filter((item) => item.id !== comment.id) };
      }
      return next;
    });
    setTotalCount((count) => Math.max(0, count - 1));
    options?.onRemoved?.();
    setDeleteTarget(null);
  }, [options, s.delete, s.failedToPost]);

  const report = useCallback(async (reason: string) => {
    if (!reportTarget) return;
    const target = reportTarget;
    setReportTarget(null);
    const token = await getClerkBearerToken(getTokenRef.current);
    if (!token) return;
    const result = await ReelsService.reportComment(token, target.id, reason);
    if (result.success) toastManager.showReportSuccess();
    else toastManager.showError(s.reportComment, result.message || s.failedToPost);
  }, [reportTarget, s.failedToPost, s.reportComment]);

  const renderRow = useCallback(({ item }: { item: CommentRow }) => {
    if (item.type === 'more') {
      return (
        <Pressable
          onPress={() => void loadMoreReplies(item.rootId)}
          style={[styles.more, isAr ? { marginRight: 46, flexDirection: 'row-reverse' } : { marginLeft: 46 }]}
          hitSlop={6}
        >
          <View style={styles.moreLine} />
          {item.loading ? (
            <ActivityIndicator size="small" color={C.accentSoft} />
          ) : (
            <Text style={[styles.moreText, { fontFamily: fonts.semibold }]}>
              {item.remaining === 1 ? s.viewReply : fillTemplate(s.viewReplies, { count: item.remaining })}
            </Text>
          )}
        </Pressable>
      );
    }
    return (
      <CommentItem
        comment={item.comment}
        isReply={item.type === 'reply'}
        isAr={isAr}
        timeLabel={formatRelativeTime(item.comment.createdAt, s)}
        fonts={fonts}
        labels={{ reply: s.reply }}
        onLike={toggleLike}
        onReply={(comment) => composerRef.current?.replyTo(comment)}
        onMenu={setMenu}
        onProfile={navigateUserProfile}
        onHashtag={() => undefined}
        onMention={navigateUserProfile}
      />
    );
  }, [fonts, isAr, loadMoreReplies, s, toggleLike]);

  const menuItems = useMemo<ActionMenuItem[]>(() => {
    if (!menu) return [];
    const items: ActionMenuItem[] = [
      { key: 'reply', label: s.reply, onPress: () => composerRef.current?.replyTo(menu) },
      { key: 'copy', label: s.copyText, onPress: () => void Clipboard.setStringAsync(menu.content) },
    ];
    if (!menu.isMine) {
      items.push({ key: 'profile', label: s.viewProfile, onPress: () => navigateUserProfile(menu.author.username) });
      items.push({ key: 'report', label: s.reportComment, destructive: true, onPress: () => setReportTarget(menu) });
    }
    if (menu.isMine) {
      items.unshift({ key: 'edit', label: s.editComment, onPress: () => composerRef.current?.startEdit(menu) });
    }
    if (menu.isMine || options?.canModerate) {
      items.push({ key: 'delete', label: s.delete, destructive: true, onPress: () => setDeleteTarget(menu) });
    }
    return items;
  }, [menu, options?.canModerate, s]);

  const reportItems = useMemo<ActionMenuItem[]>(
    () => REPORT_REASONS.map((reason) => ({
      key: reason,
      label: s.reportReasons[reason],
      destructive: reason === 'HARASSMENT' || reason === 'INAPPROPRIATE',
      onPress: () => void report(reason),
    })),
    [report, s.reportReasons],
  );

  return {
    rows,
    renderRow,
    isLoading: loading,
    isFetchingNextPage: loadingMore,
    hasNextPage: !!nextCursor,
    fetchNextPage: () => { if (nextCursor) void loadPage(nextCursor, true); },
    composerRef,
    composerLabels: {
      placeholder: s.writeComment,
      replyingTo: s.replyingTo,
      noUsers: s.noUsersFound,
      cooldown: s.commentCooldown,
      everyone: s.everyoneMention,
      everyoneHint: s.everyoneHint,
      noPages: s.noPages,
      editing: s.editingComment,
    },
    submit: (text: string, replyTo: CommunityComment | null) => submit(text, replyTo),
    edit: async (comment: CommunityComment, content: string) => {
      const token = await getClerkBearerToken(getTokenRef.current);
      if (!token || !reelId) throw new Error('AUTH');
      const result = await ReelsService.updateComment(token, comment.id, content);
      if (!result.success || !result.comment) throw new Error(result.error || 'FAILED');
      const saved = mapReelComment({ ...result.comment, parentId: comment.parentId }, reelId, me.id);
      patch(comment.id, (current) => ({ ...current, ...saved, isMine: true, replies: current.replies }));
      return saved;
    },
    onError: (err: unknown) => toastManager.showError(s.comments, err instanceof Error ? err.message : s.failedToPost),
    menu,
    menuItems,
    closeMenu: () => setMenu(null),
    deleteTarget,
    closeDelete: () => setDeleteTarget(null),
    confirmDelete: () => { if (deleteTarget) void remove(deleteTarget); },
    reportOpen: !!reportTarget,
    reportItems,
    closeReport: () => setReportTarget(null),
    fonts,
    isAr,
    s,
    totalCount,
  };
}

const styles = StyleSheet.create({
  more: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  moreLine: { width: 24, height: 1, backgroundColor: C.inputBorder },
  moreText: { color: C.muted, fontSize: 13, fontWeight: '600' },
});
