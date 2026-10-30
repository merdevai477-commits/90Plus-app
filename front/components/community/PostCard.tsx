import React, { memo, useCallback, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { ChevronLeft } from 'lucide-react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  withDelay,
} from 'react-native-reanimated';

import type { CommunityPost } from '../../services/community.api';
import { CommunityAvatar } from './CommunityAvatar';
import { RichText } from './RichText';
import { formatCount } from './format';
import { AVATAR_SIZE, C, CARD_RADIUS, CI, POST_IMAGE_RADIUS } from './theme';

export interface PostCardHandlers {
  onLike: (post: CommunityPost) => void;
  onDoubleTapLike: (post: CommunityPost) => void;
  onComment: (post: CommunityPost) => void;
  onShare: (post: CommunityPost) => void;
  onMenu: (post: CommunityPost) => void;
  onOpenImage: (post: CommunityPost) => void;
  onProfile: (username: string) => void;
  onHashtag: (tag: string) => void;
  onMention: (username: string) => void;
  onFollow?: (post: CommunityPost) => void;
  onVote?: (post: CommunityPost, choice: 'A' | 'B') => void;
}

export interface PostCardLabels {
  follow: string;
  following: string;
  like: string;
  comment: string;
  share: string;
  viewAllComments: string;
}

interface Props extends PostCardHandlers {
  post: CommunityPost;
  /** Width available inside the card (screen minus gutters and card padding). */
  contentWidth: number;
  isAr: boolean;
  timeLabel: string;
  fonts: { regular: string; medium: string; semibold: string };
  seeMore: string;
  seeLess: string;
  labels: PostCardLabels;
  /** expo-image priority — keep high only for near-viewport cards. */
  imagePriority?: 'low' | 'normal' | 'high';
}

/** Figma ratio: 216px tall image in a 368px wide card body. */
export const IMAGE_ASPECT = 216 / 368;

export const LikeIcon = memo(function LikeIcon({ liked, size = 18 }: { liked: boolean; size?: number }) {
  const scale = useSharedValue(1);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    scale.value = liked
      ? withSequence(withSpring(1.35, { damping: 6, stiffness: 420 }), withSpring(1, { damping: 10, stiffness: 300 }))
      : withSequence(withTiming(0.82, { duration: 90 }), withSpring(1, { damping: 12, stiffness: 300 }));
  }, [liked, scale]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={style}>
      <Image
        source={liked ? CI.heartFilled : CI.heartOutlined}
        style={{ width: size, height: size }}
        tintColor={liked ? C.like : C.icon}
        contentFit="contain"
      />
    </Animated.View>
  );
});

function PostImage({
  post,
  width,
  onOpen,
  onDoubleTap,
  priority = 'normal',
}: {
  post: CommunityPost;
  width: number;
  onOpen: () => void;
  onDoubleTap: () => void;
  priority?: 'low' | 'normal' | 'high';
}) {
  const heart = useSharedValue(0);
  const height = Math.round(width * IMAGE_ASPECT);

  const burst = useCallback(() => {
    onDoubleTap();
  }, [onDoubleTap]);

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDelay(240)
    .onEnd((_e, ok) => {
      if (!ok) return;
      heart.value = withSequence(
        withSpring(1, { damping: 8, stiffness: 320 }),
        withDelay(380, withTiming(0, { duration: 220 })),
      );
      runOnJS(burst)();
    });
  const singleTap = Gesture.Tap().onEnd((_e, ok) => {
    if (ok) runOnJS(onOpen)();
  });
  const gesture = Gesture.Exclusive(doubleTap, singleTap);

  const heartStyle = useAnimatedStyle(() => ({
    opacity: heart.value,
    transform: [{ scale: 0.4 + heart.value * 0.8 }],
  }));

  if (!post.image) return null;
  return (
    <GestureDetector gesture={gesture}>
      <View style={[styles.imageWrap, { width, height }]} accessibilityRole="imagebutton">
        <Image
          source={{ uri: post.image.url }}
          placeholder={post.image.placeholder ? { uri: post.image.placeholder } : undefined}
          placeholderContentFit="cover"
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={120}
          cachePolicy="memory-disk"
          recyclingKey={post.id}
          priority={priority}
          allowDownscaling
        />
        <Animated.View pointerEvents="none" style={[styles.burst, heartStyle]}>
          <Image source={CI.heartFilled} tintColor="#FFFFFF" style={{ width: 92, height: 92 }} contentFit="contain" />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

function PollOptions({
  post,
  isAr,
  fonts,
  onVote,
}: {
  post: CommunityPost;
  isAr: boolean;
  fonts: Props['fonts'];
  onVote?: (post: CommunityPost, choice: 'A' | 'B') => void;
}) {
  const poll = post.poll;
  if (!poll) return null;

  const total = poll.votesA + poll.votesB;
  const showPct = poll.votedByMe !== null || total > 0;
  const pctA = total > 0 ? Math.round((poll.votesA / total) * 100) : 0;
  const pctB = total > 0 ? Math.round((poll.votesB / total) * 100) : 0;
  const row = isAr ? 'row-reverse' : 'row';

  const renderOption = (choice: 'A' | 'B', label: string, pct: number) => {
    const selected = poll.votedByMe === choice;
    const onPress = () => {
      if (!onVote || selected) return;
      onVote(post, choice);
    };
    const inner = (
      <View style={styles.pollInner}>
        <Text style={[styles.pollText, { fontFamily: fonts.semibold }]} numberOfLines={2}>
          {label}
        </Text>
        {showPct ? (
          <Text style={[styles.pollPct, { fontFamily: fonts.medium }]}>{pct}%</Text>
        ) : null}
      </View>
    );
    if (selected) {
      return (
        <Pressable
          key={choice}
          onPress={onPress}
          style={[styles.pollBtn, { flex: 1 }]}
          accessibilityRole="button"
          accessibilityState={{ selected: true }}
        >
          <LinearGradient colors={[C.accent, C.accentDeep]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={styles.pollGradient}>
            {inner}
          </LinearGradient>
        </Pressable>
      );
    }
    return (
      <Pressable
        key={choice}
        onPress={onPress}
        style={[styles.pollBtn, styles.pollIdle, { flex: 1 }]}
        accessibilityRole="button"
      >
        {inner}
      </Pressable>
    );
  };

  return (
    <View style={[styles.pollRow, { flexDirection: row }]}>
      {renderOption('A', poll.optionA, pctA)}
      {renderOption('B', poll.optionB, pctB)}
    </View>
  );
}

function ActionButton({
  label,
  count,
  icon,
  onPress,
  isAr,
  fonts,
  selected,
}: {
  label: string;
  count: number;
  icon: React.ReactNode;
  onPress: () => void;
  isAr: boolean;
  fonts: Props['fonts'];
  selected?: boolean;
}) {
  const inner = isAr ? (
    <>
      <Text style={[styles.actionLabel, { fontFamily: fonts.regular }]}>{label}</Text>
      <Text style={[styles.actionCount, { fontFamily: fonts.regular }]}>{formatCount(count)}</Text>
      {icon}
    </>
  ) : (
    <>
      {icon}
      <Text style={[styles.actionCount, { fontFamily: fonts.regular }]}>{formatCount(count)}</Text>
      <Text style={[styles.actionLabel, { fontFamily: fonts.regular }]}>{label}</Text>
    </>
  );
  return (
    <Pressable onPress={onPress} hitSlop={10} style={styles.action} accessibilityRole="button" accessibilityState={{ selected }}>
      {inner}
    </Pressable>
  );
}

function PostCardBase({
  post,
  contentWidth,
  isAr,
  timeLabel,
  fonts,
  seeMore,
  seeLess,
  labels,
  imagePriority = 'normal',
  onLike,
  onDoubleTapLike,
  onComment,
  onShare,
  onMenu,
  onOpenImage,
  onProfile,
  onHashtag,
  onMention,
  onFollow,
  onVote,
}: Props) {
  const name = post.author.displayName || post.author.username;
  const row = isAr ? 'row-reverse' : 'row';
  const openProfile = () => onProfile(post.author.username);
  const showFollow = !post.isMine && onFollow;
  const following = post.author.isFollowing;

  return (
    <View style={styles.card}>
      <View style={[styles.header, { flexDirection: row }]}>
        <CommunityAvatar uri={post.author.avatar} name={name} size={AVATAR_SIZE} onPress={openProfile} />
        <Pressable onPress={openProfile} style={[styles.meta, { alignItems: isAr ? 'flex-end' : 'flex-start' }]}>
          <View style={[styles.nameRow, { flexDirection: row }]}>
            <Text style={[styles.name, { fontFamily: fonts.semibold }]} numberOfLines={1}>
              {name}
            </Text>
            {post.author.isVerified && <Image source={CI.verified} style={styles.icon16} contentFit="contain" />}
          </View>
          <View style={[styles.timeRow, { flexDirection: row }]}>
            <Text style={[styles.time, { fontFamily: fonts.regular }]}>{timeLabel}</Text>
            <Image source={CI.earth} style={styles.icon12} contentFit="contain" />
          </View>
        </Pressable>
        <View style={[styles.headerActions, { flexDirection: row }]}>
          {showFollow && (
            <Pressable
              onPress={() => onFollow(post)}
              style={[styles.followBtn, following && styles.followBtnActive]}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityState={{ selected: following }}
            >
              <Text style={[styles.followText, { fontFamily: fonts.semibold }]}>{following ? labels.following : labels.follow}</Text>
            </Pressable>
          )}
          <Pressable onPress={() => onMenu(post)} hitSlop={12} style={styles.menuBtn} accessibilityRole="button" accessibilityLabel="More">
            <Image source={CI.overflow} style={styles.icon24} contentFit="contain" />
          </Pressable>
        </View>
      </View>

      <View style={styles.body}>
        {(!!post.content || post.kind === 'TEAM_POLL') && (
          <View style={[styles.contentBox, post.kind === 'TEAM_POLL' && styles.contentBoxPoll]}>
            {!!post.content && (
              <RichText
                key={post.id}
                text={post.content}
                style={[styles.content, { fontFamily: fonts.medium }]}
                onHashtag={onHashtag}
                onMention={onMention}
                collapseAfterLines={post.image ? 4 : 8}
                seeMoreLabel={seeMore}
                seeLessLabel={seeLess}
              />
            )}
            {post.kind === 'TEAM_POLL' && <PollOptions post={post} isAr={isAr} fonts={fonts} onVote={onVote} />}
          </View>
        )}
        <PostImage
          post={post}
          width={contentWidth}
          priority={imagePriority}
          onOpen={() => onOpenImage(post)}
          onDoubleTap={() => onDoubleTapLike(post)}
        />
      </View>

      <View style={[styles.actions, { flexDirection: isAr ? 'row' : 'row-reverse' }]}>
        <ActionButton
          label={labels.share}
          count={post.sharesCount}
          icon={<Image source={CI.share} style={styles.icon18} contentFit="contain" />}
          onPress={() => onShare(post)}
          isAr={isAr}
          fonts={fonts}
        />
        <ActionButton
          label={labels.comment}
          count={post.commentsCount}
          icon={<Image source={CI.comment} style={styles.icon18} contentFit="contain" />}
          onPress={() => onComment(post)}
          isAr={isAr}
          fonts={fonts}
        />
        <ActionButton
          label={labels.like}
          count={post.likesCount}
          icon={<LikeIcon liked={post.likedByMe} size={18} />}
          onPress={() => onLike(post)}
          isAr={isAr}
          fonts={fonts}
          selected={post.likedByMe}
        />
      </View>

      <View style={styles.footerDivider} />
      <Pressable
        onPress={() => onComment(post)}
        style={[styles.viewComments, { flexDirection: isAr ? 'row' : 'row-reverse' }]}
        accessibilityRole="button"
      >
        <ChevronLeft size={16} color={C.muted} />
        <Text style={[styles.viewCommentsText, { fontFamily: fonts.regular }]}>{labels.viewAllComments}</Text>
      </Pressable>
    </View>
  );
}

export const PostCard = memo(
  PostCardBase,
  (a, b) =>
    a.post === b.post &&
    a.contentWidth === b.contentWidth &&
    a.isAr === b.isAr &&
    a.timeLabel === b.timeLabel &&
    a.fonts === b.fonts &&
    a.labels === b.labels &&
    a.imagePriority === b.imagePriority,
);

export const postCardStyles = StyleSheet.create({
  card: {
    paddingHorizontal: 24,
    paddingVertical: 25,
    borderRadius: CARD_RADIUS,
    backgroundColor: C.card,
    borderWidth: 0.5,
    borderColor: C.cardBorder,
    gap: 17,
  },
});

const styles = StyleSheet.create({
  card: postCardStyles.card,
  header: {
    alignItems: 'center',
    gap: 11,
  },
  meta: {
    flex: 1,
    gap: 4,
  },
  headerActions: {
    alignItems: 'center',
    gap: 8,
  },
  followBtn: {
    paddingHorizontal: 15,
    paddingVertical: 6,
    borderRadius: 52,
    backgroundColor: C.followBtn,
  },
  followBtnActive: {
    opacity: 0.85,
  },
  followText: {
    color: C.followText,
    fontSize: 11,
    fontWeight: '600',
  },
  nameRow: {
    alignItems: 'center',
    gap: 7,
    maxWidth: '100%',
  },
  name: {
    color: C.textStrong,
    fontSize: 15,
    fontWeight: '600',
    flexShrink: 1,
  },
  timeRow: {
    alignItems: 'center',
    gap: 4,
  },
  time: {
    color: C.muted,
    fontSize: 9,
  },
  menuBtn: {
    alignSelf: 'center',
  },
  icon16: { width: 16, height: 16 },
  icon12: { width: 12, height: 12 },
  icon18: { width: 18, height: 18 },
  icon24: { width: 24, height: 24 },
  body: {
    gap: 22,
  },
  contentBox: {
    backgroundColor: C.contentBox,
    borderRadius: 12,
    paddingHorizontal: 23,
    paddingVertical: 10,
    gap: 12,
    width: '100%',
  },
  contentBoxPoll: {
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
  },
  content: {
    color: C.text,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '500',
  },
  pollRow: {
    gap: 8,
    width: '100%',
  },
  pollBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    minHeight: 88,
    justifyContent: 'center',
  },
  pollIdle: {
    backgroundColor: C.pollIdle,
  },
  pollGradient: {
    flex: 1,
    minHeight: 88,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 19,
  },
  pollInner: {
    flex: 1,
    minHeight: 88,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 19,
  },
  pollText: {
    color: C.textStrong,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  pollPct: {
    color: C.textStrong,
    fontSize: 13,
    fontWeight: '500',
    opacity: 0.9,
    textAlign: 'center',
  },
  imageWrap: {
    borderRadius: POST_IMAGE_RADIUS,
    overflow: 'hidden',
    backgroundColor: '#15111F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  burst: {
    position: 'absolute',
  },
  actions: {
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 48,
    justifyContent: 'center',
  },
  actionLabel: {
    color: C.muted,
    fontSize: 12,
  },
  actionCount: {
    color: C.muted,
    fontSize: 12,
  },
  footerDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: C.divider,
  },
  viewComments: {
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingTop: 0,
  },
  viewCommentsText: {
    color: C.muted,
    fontSize: 12,
  },
});
