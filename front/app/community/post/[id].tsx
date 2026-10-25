import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MessageCircle, SearchX } from 'lucide-react-native';

import ImageViewerModal from '../../../components/common/ImageViewerModal';
import { ActionMenu, type ActionMenuItem } from '../../../components/community/ActionMenu';
import { ConfirmSheet } from '../../../components/community/ConfirmSheet';
import { CommentComposer } from '../../../components/community/CommentComposer';
import { CommunityHeader, useCommunityHeaderOffset } from '../../../components/community/CommunityHeader';
import { useFeedMetrics } from '../../../components/community/CommunityFeedList';
import { FeedSkeleton } from '../../../components/community/FeedSkeleton';
import { KeyboardDock } from '../../../components/community/KeyboardDock';
import { PostCard } from '../../../components/community/PostCard';
import { useCommentThread } from '../../../components/community/useCommentThread';
import { formatRelativeTime } from '../../../components/community/format';
import { C } from '../../../components/community/theme';
import { communityKeys, findPost } from '../../../hooks/community/communityCache';
import { useCommunityToken } from '../../../hooks/community/useCommunityFeed';
import { usePostActions } from '../../../hooks/community/usePostActions';
import { CommunityApiError, communityApi, type CommunityPost } from '../../../services/community.api';

export default function CommunityPostScreen() {
  const { id, comments } = useLocalSearchParams<{ id: string; comments?: string }>();
  const postId = String(id ?? '');
  const router = useRouter();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const getToken = useCommunityToken();
  const actions = usePostActions();
  const metrics = useFeedMetrics();
  const headerOffset = useCommunityHeaderOffset();
  const [menuOpen, setMenuOpen] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const postQuery = useQuery({
    queryKey: communityKeys.post(postId),
    queryFn: () => communityApi.post(getToken, postId),
    enabled: !!postId,
    initialData: () => findPost(qc, postId),
    initialDataUpdatedAt: 0,
    retry: (count, err) => !(err instanceof CommunityApiError && err.status === 404) && count < 2,
  });
  const post = postQuery.data ?? null;
  const ctx = useCommentThread(post, !!post);
  const { s, fonts, isAr } = ctx;

  useEffect(() => {
    if (comments !== '1' || !post) return;
    const timer = setTimeout(() => ctx.composerRef.current?.focus(), 450);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comments, !!post]);

  const onBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/community');
  }, [router]);

  const onOpenImage = useCallback((p: CommunityPost) => p.image && setViewerUrl(p.image.url), []);
  const onComment = useCallback(() => ctx.composerRef.current?.focus(), [ctx.composerRef]);
  const onShare = useCallback((p: CommunityPost) => void actions.share(p), [actions]);
  const onMenu = useCallback(() => setMenuOpen(true), []);

  const menuItems = useMemo<ActionMenuItem[]>(() => {
    if (!post) return [];
    const items: ActionMenuItem[] = [];
    if (post.isMine) {
      items.push({
        key: 'edit',
        label: s.editText,
        onPress: () => router.push({ pathname: '/community/compose', params: { edit: post.id } }),
      });
      items.push({
        key: 'photo',
        label: post.image ? s.changePhoto : s.addPhoto,
        onPress: () => router.push({ pathname: '/community/compose', params: { edit: post.id, photo: '1' } }),
      });
      if (post.content) items.push({ key: 'copy', label: s.copyText, onPress: () => void actions.copyText(post.content) });
      items.push({ key: 'delete', label: s.delete, destructive: true, onPress: () => setDeleteOpen(true) });
    } else {
      if (post.content) items.push({ key: 'copy', label: s.copyText, onPress: () => void actions.copyText(post.content) });
      items.push({ key: 'report', label: s.reportPost, destructive: true, onPress: () => actions.askReport('post', post.id, onBack) });
    }
    return items;
  }, [actions, onBack, post, router, s]);

  const notFound = postQuery.error instanceof CommunityApiError && postQuery.error.status === 404;

  const header = post ? (
    <View style={{ marginBottom: 8 }}>
      <PostCard
        post={post}
        contentWidth={metrics.contentWidth}
        isAr={isAr}
        timeLabel={formatRelativeTime(post.createdAt, s)}
        fonts={fonts}
        seeMore={s.seeMore}
        seeLess={s.seeLess}
        onLike={actions.toggleLike}
        onDoubleTapLike={actions.likeOnce}
        onComment={onComment}
        onShare={onShare}
        onMenu={onMenu}
        onOpenImage={onOpenImage}
        onProfile={actions.openProfile}
        onHashtag={actions.openHashtag}
        onMention={actions.openProfile}
      />
      <Text style={[styles.section, { fontFamily: fonts.semibold, textAlign: isAr ? 'right' : 'left' }]}>{s.comments}</Text>
    </View>
  ) : null;

  return (
    <View style={styles.root}>
      <CommunityHeader title={s.postTitle} fontFamily={fonts.semibold} onBack={onBack} onBell={() => router.push('/notifications')} />

      {notFound ? (
        <View style={styles.state}>
          <SearchX size={42} color={C.accentDeep} />
          <Text style={[styles.stateText, { fontFamily: fonts.semibold }]}>{s.postNotFound}</Text>
        </View>
      ) : !post ? (
        postQuery.isError ? (
          <View style={styles.state}>
            <Text style={[styles.stateText, { fontFamily: fonts.semibold }]}>{s.errorTitle}</Text>
            <Pressable onPress={() => void postQuery.refetch()} style={styles.retry}>
              <Text style={[styles.retryText, { fontFamily: fonts.semibold }]}>{s.tryAgain}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ paddingHorizontal: metrics.sidePad, paddingTop: headerOffset + 16 }}>
            <FeedSkeleton isAr={isAr} imageHeight={metrics.imageHeight} />
          </View>
        )
      ) : (
        <>
          <FlashList
            data={ctx.rows}
            renderItem={ctx.renderRow}
            keyExtractor={(r) => r.key}
            getItemType={(r) => r.type}
            ListHeaderComponent={header}
            contentContainerStyle={{ paddingHorizontal: metrics.sidePad, paddingTop: headerOffset + 16, paddingBottom: 24 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            onEndReached={() => {
              if (ctx.thread.hasNextPage && !ctx.thread.isFetchingNextPage) void ctx.thread.fetchNextPage();
            }}
            onEndReachedThreshold={0.8}
            ListEmptyComponent={
              ctx.thread.isLoading ? (
                <ActivityIndicator style={{ marginTop: 28 }} color={C.accentSoft} />
              ) : (
                <View style={styles.empty}>
                  <MessageCircle size={36} color={C.accentDeep} />
                  <Text style={[styles.emptyText, { fontFamily: fonts.regular }]}>{s.noComments}</Text>
                </View>
              )
            }
            ListFooterComponent={
              ctx.thread.isFetchingNextPage ? <ActivityIndicator style={{ marginVertical: 16 }} color={C.accentSoft} /> : null
            }
          />
          <KeyboardDock bottomInset={insets.bottom}>
            <LinearGradient pointerEvents="none" colors={['transparent', '#030303']} style={styles.fade} />
            <CommentComposer
              ref={ctx.composerRef}
              isAr={isAr}
              fonts={fonts}
              labels={ctx.composerLabels}
              onSubmit={ctx.submit}
              onError={ctx.onError}
              bottomInset={insets.bottom}
            />
          </KeyboardDock>
        </>
      )}

      <ActionMenu visible={menuOpen} items={menuItems} cancelLabel={s.cancel} onClose={() => setMenuOpen(false)} fontFamily={fonts.semibold} />
      <ActionMenu visible={!!ctx.menu} items={ctx.menuItems} cancelLabel={s.cancel} onClose={ctx.closeMenu} fontFamily={fonts.semibold} />
      <ConfirmSheet
        visible={!!ctx.deleteTarget}
        title={s.deleteCommentTitle}
        body={s.deleteBody}
        confirmLabel={s.delete}
        cancelLabel={s.cancel}
        fontFamily={fonts.semibold}
        onConfirm={ctx.confirmDelete}
        onClose={ctx.closeDelete}
      />
      <ConfirmSheet
        visible={deleteOpen}
        title={s.deletePostTitle}
        body={s.deleteBody}
        confirmLabel={s.delete}
        cancelLabel={s.cancel}
        fontFamily={fonts.semibold}
        onConfirm={() => {
          if (post) void actions.performDelete(post, onBack);
        }}
        onClose={() => setDeleteOpen(false)}
      />
      <ImageViewerModal visible={!!viewerUrl} imageUrl={viewerUrl ?? ''} onClose={() => setViewerUrl(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.screen,
  },
  section: {
    color: C.textStrong,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 4,
  },
  state: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  stateText: {
    color: C.textStrong,
    fontSize: 16,
    textAlign: 'center',
  },
  retry: {
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: C.accent,
  },
  retryText: {
    color: '#FFF',
    fontSize: 14,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 32,
    gap: 10,
  },
  emptyText: {
    color: C.muted,
    fontSize: 14,
  },
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -28,
    height: 28,
  },
});
