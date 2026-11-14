import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { communityApi, type CommunityPost } from '../../services/community.api';
import { useCommunityToken } from '../../hooks/community/useCommunityFeed';
import { usePostActions } from '../../hooks/community/usePostActions';
import { useTranslation } from '../../src/i18n';
import { getAppFont } from '../../utils/fontSetup';
import { CommentsSheet } from '../community/CommentsSheet';
import { PostCard } from '../community/PostCard';
import { formatRelativeTime } from '../community/format';

export function ProfilePostsPane({ username }: { username: string }) {
  const getToken = useCommunityToken();
  const actions = usePostActions();
  const { t, language } = useTranslation();
  const s = t.community;
  const { width } = useWindowDimensions();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failed, setFailed] = useState(false);
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

  const load = useCallback(async (next: string | null, append: boolean) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setFailed(false);
    try {
      const page = await communityApi.userPosts(getToken, username, next);
      setPosts((prev) => (append ? [...prev, ...page.items] : page.items));
      setCursor(page.nextCursor);
    } catch {
      if (!append) setPosts([]);
      setFailed(true);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [getToken, username]);

  useEffect(() => {
    void load(null, false);
  }, [load]);

  if (loading) {
    return <ActivityIndicator color="#C4B5FD" style={styles.pad} />;
  }
  if (failed && posts.length === 0) {
    return <Text style={styles.empty}>{s.errorTitle}</Text>;
  }
  if (!posts.length) {
    return <Text style={styles.empty}>{s.emptyTitle}</Text>;
  }

  return (
    <View style={styles.list}>
      {posts.map((post, index) => (
        <PostCard
          key={post.id}
          post={post}
          contentWidth={Math.max(280, width - 40)}
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
      {cursor ? (
        <Text
          style={styles.more}
          onPress={() => { if (!loadingMore) void load(cursor, true); }}
        >
          {loadingMore ? '…' : s.loadMore}
        </Text>
      ) : null}
      {failed ? <Text style={styles.empty}>{s.errorTitle}</Text> : null}
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
