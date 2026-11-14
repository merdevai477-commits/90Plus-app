import React, { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { type CommunityPost } from '../../services/community.api';
import { useCommunityPosts } from '../../hooks/community/useCommunityFeed';
import { usePostActions } from '../../hooks/community/usePostActions';
import { useTranslation } from '../../src/i18n';
import { getAppFont } from '../../utils/fontSetup';
import { CommentsSheet } from '../community/CommentsSheet';
import { useFeedMetrics } from '../community/CommunityFeedList';
import { PostCard } from '../community/PostCard';
import { formatRelativeTime } from '../community/format';

export function ProfilePostsPane({ username }: { username: string }) {
  const actions = usePostActions();
  const { t, language } = useTranslation();
  const s = t.community;
  const metrics = useFeedMetrics();
  const feed = useCommunityPosts({ kind: 'user', username });
  const [sheetPost, setSheetPost] = useState<CommunityPost | null>(null);
  const isAr = language === 'ar';
  const fonts = useMemo(
    () => ({ regular: getAppFont(400, language), medium: getAppFont(500, language), semibold: getAppFont(600, language) }),
    [language],
  );
  const labels = useMemo(
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

  if (feed.isLoading) {
    return <ActivityIndicator color="#C4B5FD" style={styles.pad} />;
  }
  if (feed.isError && feed.posts.length === 0) {
    return <Text style={styles.empty}>{s.errorTitle}</Text>;
  }
  if (!feed.posts.length) {
    return <Text style={styles.empty}>{s.emptyTitle}</Text>;
  }

  return (
    <View style={[styles.list, { paddingHorizontal: metrics.sidePad }]}>
      {feed.posts.map((post, index) => (
        <PostCard
          key={post.id}
          post={post}
          contentWidth={metrics.contentWidth}
          isAr={isAr}
          timeLabel={formatRelativeTime(post.createdAt, s)}
          fonts={fonts}
          seeMore={s.seeMore}
          seeLess={s.seeLess}
          labels={labels}
          imagePriority={index < 2 ? 'high' : 'low'}
          onLike={actions.toggleLike}
          onDoubleTapLike={actions.likeOnce}
          onComment={setSheetPost}
          onShare={(item) => void actions.share(item)}
          onMenu={() => undefined}
          onOpenImage={(item) => item.image && setSheetPost(item)}
          onProfile={actions.openProfile}
          onHashtag={actions.openHashtag}
          onMention={actions.openProfile}
          onFollow={actions.toggleFollow}
          onVote={actions.votePoll}
        />
      ))}
      {feed.hasNextPage ? (
        <Text
          style={styles.more}
          onPress={() => { if (!feed.isFetchingNextPage) void feed.fetchNextPage(); }}
        >
          {feed.isFetchingNextPage ? '…' : s.loadMore}
        </Text>
      ) : null}
      <CommentsSheet post={sheetPost} onClose={() => setSheetPost(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 16, paddingTop: 12, paddingBottom: 24 },
  pad: { marginVertical: 28 },
  empty: { color: '#9A93A8', textAlign: 'center', marginVertical: 28, paddingHorizontal: 24 },
  more: { color: '#C4B5FD', textAlign: 'center', fontWeight: '700', paddingVertical: 12 },
});
