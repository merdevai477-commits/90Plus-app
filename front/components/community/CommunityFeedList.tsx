import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { ArrowUp, MessagesSquare, RefreshCw } from 'lucide-react-native';

import ImageViewerModal from '../common/ImageViewerModal';
import { communityApi, type CommunityPost } from '../../services/community.api';
import { useTranslation } from '../../src/i18n';
import { getAppFont } from '../../utils/fontSetup';
import { useCommunityPosts, useCommunityToken } from '../../hooks/community/useCommunityFeed';
import { usePostActions } from '../../hooks/community/usePostActions';
import { discardPending, retryPending, usePublishStore, type PendingPost } from '../../hooks/community/publishQueue';
import { findPost } from '../../hooks/community/communityCache';
import { ActionMenu, type ActionMenuItem } from './ActionMenu';
import { ConfirmSheet } from './ConfirmSheet';
import { CommentsSheet } from './CommentsSheet';
import { FeedSkeleton } from './FeedSkeleton';
import { GhostPostCard } from './GhostPostCard';
import { IMAGE_ASPECT, PostCard } from './PostCard';
import { communityErrorMessage, formatRelativeTime, isContentRejection, isImageRejected } from './format';
import { C } from './theme';

type FeedSource = { kind: 'feed' } | { kind: 'tag'; tag: string } | { kind: 'user'; username: string };

type Row = { type: 'ghost'; key: string; pending: PendingPost } | { type: 'post'; key: string; post: CommunityPost };

const CARD_PADDING = 24;
const MAX_CARD_WIDTH = 600;

/** Gutters scale with the screen and cards stop growing on tablets. */
export function useFeedMetrics() {
  const { width } = useWindowDimensions();
  return useMemo(() => {
    const gutter = Math.round(Math.min(24, Math.max(12, width * 0.045)));
    const cardWidth = Math.min(width - gutter * 2, MAX_CARD_WIDTH);
    const sidePad = Math.round((width - cardWidth) / 2);
    const contentWidth = Math.floor(cardWidth - CARD_PADDING * 2);
    return { width, sidePad, cardWidth, contentWidth, imageHeight: Math.round(contentWidth * IMAGE_ASPECT) };
  }, [width]);
}

interface Props {
  source: FeedSource;
  header?: React.ReactElement | null;
  showPending?: boolean;
  topPadding?: number;
  bottomPadding?: number;
  onPostsCount?: (count: number | undefined) => void;
}

export function CommunityFeedList({ source, header, showPending = false, topPadding = 0, bottomPadding = 24, onPostsCount }: Props) {
  const { t, language } = useTranslation();
  const s = t.community;
  const isAr = language === 'ar';
  const router = useRouter();
  const qc = useQueryClient();
  const getToken = useCommunityToken();
  const metrics = useFeedMetrics();
  const actions = usePostActions();
  const listRef = useRef<FlashListRef<Row>>(null);

  const feed = useCommunityPosts(source);
  const pending = usePublishStore((st) => st.pending);
  const [menuPost, setMenuPost] = useState<CommunityPost | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CommunityPost | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [sheetPostId, setSheetPostId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    onPostsCount?.(feed.postsCount);
  }, [feed.postsCount, onPostsCount]);

  useFocusEffect(
    useCallback(
      () => () => {
        setSheetPostId(null);
        setViewerUrl(null);
      },
      [],
    ),
  );

  const fonts = useMemo(
    () => ({ regular: getAppFont(400, language), medium: getAppFont(500, language), semibold: getAppFont(600, language) }),
    [language],
  );

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    if (showPending) for (const p of pending) out.push({ type: 'ghost', key: `g:${p.clientId}`, pending: p });
    for (const p of feed.posts) out.push({ type: 'post', key: p.id, post: p });
    return out;
  }, [feed.posts, pending, showPending]);

  const newest = feed.posts[0];
  const peek = useQuery({
    queryKey: ['community', 'peek'],
    queryFn: () => communityApi.feed(getToken, null),
    enabled: source.kind === 'feed' && !!newest,
    refetchInterval: 45_000,
    refetchIntervalInBackground: false,
    staleTime: 40_000,
  });
  const hasNewPosts = useMemo(() => {
    const top = peek.data?.items[0];
    if (!top || !newest || top.id === newest.id) return false;
    return new Date(top.createdAt).getTime() > new Date(newest.createdAt).getTime() && !top.isMine;
  }, [newest, peek.data]);

  const showNewPosts = useCallback(async () => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
    await qc.resetQueries({ queryKey: ['community', 'feed'], exact: true });
  }, [qc]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (source.kind === 'feed') await qc.resetQueries({ queryKey: ['community', 'feed'], exact: true });
      else await feed.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [feed, qc, source.kind]);

  const onEndReached = useCallback(() => {
    if (feed.hasNextPage && !feed.isFetchingNextPage && !feed.isError) void feed.fetchNextPage();
  }, [feed]);

  const onOpenImage = useCallback((p: CommunityPost) => p.image && setViewerUrl(p.image.url), []);
  const onComment = useCallback((p: CommunityPost) => setSheetPostId(p.id), []);
  const onMenu = useCallback((p: CommunityPost) => setMenuPost(p), []);
  const onShare = useCallback((p: CommunityPost) => void actions.share(p), [actions]);

  const ghostLabels = useMemo(
    () => ({ publishing: s.ghostUploading, failed: s.failedToPost, retry: s.retry, edit: s.edit, discard: s.discard }),
    [s],
  );

  const postCardLabels = useMemo(
    () => ({
      follow: s.follow,
      following: s.following,
      like: s.likeLabel,
      comment: s.commentLabel,
      share: s.shareLabel,
      viewAllComments: s.viewAllComments,
    }),
    [s],
  );

  const renderItem = useCallback(
    ({ item }: { item: Row }) => {
      if (item.type === 'ghost') {
        const p = item.pending;
        const err = p.status === 'failed' ? p.error : null;
        const rejected = isContentRejection(err);
        return (
          <GhostPostCard
            pending={p}
            contentWidth={metrics.contentWidth}
            isAr={isAr}
            fonts={fonts}
            labels={ghostLabels}
            errorTitle={isImageRejected(err) ? s.imageRejectedTitle : null}
            errorText={err ? communityErrorMessage(err, s) : null}
            canRetry={!rejected}
            onRetry={() => retryPending(p.clientId)}
            onEdit={() => router.push({ pathname: '/community/compose', params: { restore: p.clientId } })}
            onDiscard={() => discardPending(p.clientId)}
          />
        );
      }
      return (
        <PostCard
          post={item.post}
          contentWidth={metrics.contentWidth}
          isAr={isAr}
          timeLabel={formatRelativeTime(item.post.createdAt, s)}
          fonts={fonts}
          seeMore={s.seeMore}
          seeLess={s.seeLess}
          labels={postCardLabels}
          onLike={actions.toggleLike}
          onDoubleTapLike={actions.likeOnce}
          onComment={onComment}
          onShare={onShare}
          onMenu={onMenu}
          onOpenImage={onOpenImage}
          onProfile={actions.openProfile}
          onHashtag={actions.openHashtag}
          onMention={actions.openProfile}
          onFollow={actions.toggleFollow}
          onVote={actions.votePoll}
        />
      );
    },
    [actions, fonts, ghostLabels, isAr, metrics.contentWidth, onComment, onMenu, onOpenImage, onShare, postCardLabels, router, s],
  );

  const menuItems = useMemo<ActionMenuItem[]>(() => {
    const p = menuPost;
    if (!p) return [];
    const items: ActionMenuItem[] = [];
    if (p.isMine) {
      items.push({
        key: 'edit',
        label: s.editText,
        onPress: () => router.push({ pathname: '/community/compose', params: { edit: p.id } }),
      });
      items.push({
        key: 'photo',
        label: p.image ? s.changePhoto : s.addPhoto,
        onPress: () => router.push({ pathname: '/community/compose', params: { edit: p.id, photo: '1' } }),
      });
      if (p.content) items.push({ key: 'copy', label: s.copyText, onPress: () => void actions.copyText(p.content) });
      items.push({ key: 'delete', label: s.delete, destructive: true, onPress: () => setDeleteTarget(p) });
    } else {
      if (p.content) items.push({ key: 'copy', label: s.copyText, onPress: () => void actions.copyText(p.content) });
      items.push({ key: 'report', label: s.reportPost, destructive: true, onPress: () => actions.askReport('post', p.id) });
    }
    return items;
  }, [actions, menuPost, router, s]);

  const sheetPost = sheetPostId ? (feed.posts.find((p) => p.id === sheetPostId) ?? findPost(qc, sheetPostId) ?? null) : null;

  const listHeader = (
    <View>
      {header}
      {feed.isLoading && <FeedSkeleton isAr={isAr} imageHeight={metrics.imageHeight} />}
    </View>
  );

  const empty =
    feed.isLoading ? null : feed.isError ? (
      <View style={styles.state}>
        <RefreshCw size={36} color={C.accentDeep} />
        <Text style={[styles.stateTitle, { fontFamily: fonts.semibold }]}>{s.errorTitle}</Text>
        <Text style={[styles.stateBody, { fontFamily: fonts.regular }]}>{communityErrorMessage(feed.error, s)}</Text>
        <Pressable onPress={() => void feed.refetch()} style={styles.stateBtn}>
          <Text style={[styles.stateBtnText, { fontFamily: fonts.semibold }]}>{s.tryAgain}</Text>
        </Pressable>
      </View>
    ) : (
      <View style={styles.state}>
        <MessagesSquare size={40} color={C.accentDeep} />
        <Text style={[styles.stateTitle, { fontFamily: fonts.semibold }]}>{s.emptyTitle}</Text>
        <Text style={[styles.stateBody, { fontFamily: fonts.regular }]}>{s.emptyBody}</Text>
      </View>
    );

  return (
    <View style={styles.root}>
      <FlashList
        ref={listRef}
        data={rows}
        renderItem={renderItem}
        keyExtractor={(r) => r.key}
        getItemType={(r) =>
          r.type === 'ghost' ? 'ghost' : r.post.kind === 'TEAM_POLL' ? 'post-poll' : r.post.image ? 'post-image' : 'post-text'
        }
        ListHeaderComponent={listHeader}
        ListEmptyComponent={empty}
        ListFooterComponent={
          feed.isFetchingNextPage ? (
            <ActivityIndicator style={{ marginVertical: 22 }} color={C.accentSoft} />
          ) : feed.isError && rows.length > 0 ? (
            <Pressable onPress={() => void feed.fetchNextPage()} style={[styles.stateBtn, { alignSelf: 'center', marginVertical: 18 }]}>
              <Text style={[styles.stateBtnText, { fontFamily: fonts.semibold }]}>{s.tryAgain}</Text>
            </Pressable>
          ) : null
        }
        ItemSeparatorComponent={Separator}
        contentContainerStyle={{ paddingHorizontal: metrics.sidePad, paddingTop: topPadding, paddingBottom: bottomPadding }}
        onEndReached={onEndReached}
        onEndReachedThreshold={1.2}
        refreshing={refreshing}
        onRefresh={onRefresh}
        maintainVisibleContentPosition={{ autoscrollToTopThreshold: 120 }}
        drawDistance={metrics.imageHeight * 4}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      />

      {hasNewPosts && (
        <Animated.View entering={FadeInUp.springify().damping(16)} exiting={FadeOutUp.duration(160)} style={styles.pillWrap} pointerEvents="box-none">
          <Pressable onPress={() => void showNewPosts()} style={styles.pill} accessibilityRole="button">
            <ArrowUp size={16} color="#FFF" />
            <Text style={[styles.pillText, { fontFamily: fonts.semibold }]}>{s.newPosts}</Text>
          </Pressable>
        </Animated.View>
      )}

      <ActionMenu visible={!!menuPost} items={menuItems} cancelLabel={s.cancel} onClose={() => setMenuPost(null)} fontFamily={fonts.semibold} />
      <ConfirmSheet
        visible={!!deleteTarget}
        title={s.deletePostTitle}
        body={s.deleteBody}
        confirmLabel={s.delete}
        cancelLabel={s.cancel}
        fontFamily={fonts.semibold}
        onConfirm={() => {
          if (deleteTarget) void actions.performDelete(deleteTarget);
        }}
        onClose={() => setDeleteTarget(null)}
      />
      <ImageViewerModal visible={!!viewerUrl} imageUrl={viewerUrl ?? ''} onClose={() => setViewerUrl(null)} />
      <CommentsSheet post={sheetPost} onClose={() => setSheetPostId(null)} />
    </View>
  );
}

function Separator() {
  return <View style={{ height: 14 }} />;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  state: {
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 56,
    gap: 10,
  },
  stateTitle: {
    color: C.textStrong,
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  stateBody: {
    color: C.muted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  stateBtn: {
    marginTop: 8,
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: C.accent,
  },
  stateBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  pillWrap: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: C.accent,
    shadowColor: C.accent,
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  pillText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
});
