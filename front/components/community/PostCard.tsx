import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  withDelay,
} from 'react-native-reanimated';

import { pollChoices, pollTotal, pollVotedIndex, type CommunityPost } from '../../services/community.api';
import { useTranslation } from '../../src/i18n';
import { PollVotersSheet } from './PollVotersSheet';
import { CommunityAvatar } from './CommunityAvatar';
import { RichText } from './RichText';
import { formatCount } from './format';
import { LikersSheet } from './LikersSheet';
import { useCommunityTheme } from '../../hooks/useCommunityTheme';
import { AVATAR_SIZE, CARD_RADIUS, CI, COMMUNITY_LIGHT_ELEVATION, POST_IMAGE_RADIUS } from './theme';
import UserIdentity from '../identity/UserIdentity';

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
  onVote?: (post: CommunityPost, optionIndex: number) => void;
}

export interface PostCardLabels {
  follow: string;
  following: string;
  like: string;
  comment: string;
  share: string;
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

/** Fallback when a post has no stored dimensions. */
export const IMAGE_ASPECT = 216 / 368;
const MIN_IMAGE_RATIO = 0.42;
const MAX_IMAGE_RATIO = 1.6;

/** Size the frame to the photo so wide, square and tall images stay whole. */
export function postImageLayout(
  width: number,
  image?: { width: number; height: number } | null,
): { height: number; fit: 'cover' | 'contain' } {
  const iw = image?.width ?? 0;
  const ih = image?.height ?? 0;
  const natural = iw > 0 && ih > 0 ? ih / iw : IMAGE_ASPECT;
  const capped = Math.min(MAX_IMAGE_RATIO, Math.max(MIN_IMAGE_RATIO, natural));
  const fit = natural < MIN_IMAGE_RATIO - 0.001 || natural > MAX_IMAGE_RATIO + 0.001 ? 'contain' : 'cover';
  return { height: Math.max(1, Math.round(width * capped)), fit };
}

export const LikeIcon = memo(function LikeIcon({ liked, size = 18 }: { liked: boolean; size?: number }) {
  const { colors } = useCommunityTheme();
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
        tintColor={liked ? colors.like : colors.icon}
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
  const { colors, isDark } = useCommunityTheme();
  const heart = useSharedValue(0);
  const layout = postImageLayout(width, post.image);

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
      <View
        style={[
          styles.imageWrap,
          {
            width,
            height: layout.height,
            backgroundColor: isDark ? '#15111F' : colors.contentBox,
            borderColor: isDark ? 'transparent' : 'rgba(75,31,163,0.12)',
            borderWidth: isDark ? 0 : StyleSheet.hairlineWidth,
          },
        ]}
        accessibilityRole="imagebutton"
      >
        <Image
          source={{ uri: post.image.url }}
          placeholder={post.image.placeholder ? { uri: post.image.placeholder } : undefined}
          placeholderContentFit={layout.fit}
          style={StyleSheet.absoluteFill}
          contentFit={layout.fit}
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
  onProfile,
}: {
  post: CommunityPost;
  isAr: boolean;
  fonts: Props['fonts'];
  onVote?: (post: CommunityPost, optionIndex: number) => void;
  onProfile: (username: string) => void;
}) {
  const { t } = useTranslation();
  const { colors, isDark } = useCommunityTheme();
  const [votersFor, setVotersFor] = useState<number | null>(null);
  const poll = post.poll;
  if (!poll) return null;

  const options = pollChoices(poll);
  const total = pollTotal(poll);
  const voted = pollVotedIndex(poll);
  const row = isAr ? 'row-reverse' : 'row';
  const voterOption = options.find((option) => option.index === votersFor) ?? null;

  return (
    <View style={styles.pollStack}>
      {options.map((option) => {
        const selected = voted === option.index;
        const pct = total > 0 ? Math.round((option.votes / total) * 100) : 0;
        return (
          <View
            key={option.index}
            style={[
              styles.pollOption,
              {
                backgroundColor: colors.pollIdle,
                borderColor: isDark ? 'transparent' : colors.cardBorder,
                borderWidth: isDark ? 0 : 1,
              },
              selected && {
                backgroundColor: colors.pollSelected,
                borderColor: isDark ? 'transparent' : colors.accent,
              },
            ]}
          >
            <View style={[styles.pollFill, { width: `${pct}%`, backgroundColor: colors.accent }]} />
            <Pressable
              onPress={() => onVote?.(post, option.index)}
              style={[styles.pollLabelHit, { flexDirection: row }]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Text
                style={[
                  styles.pollText,
                  { fontFamily: fonts.semibold, textAlign: isAr ? 'right' : 'left', color: colors.textStrong },
                ]}
                numberOfLines={2}
              >
                {option.label}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => option.votes > 0 && setVotersFor(option.index)}
              disabled={option.votes === 0}
              hitSlop={8}
              style={styles.pollCountHit}
              accessibilityRole="button"
              accessibilityLabel={`${option.votes}`}
            >
              <Text style={[styles.pollPct, { fontFamily: fonts.medium, color: colors.muted }]}>{option.votes}</Text>
            </Pressable>
          </View>
        );
      })}
      <Text
        style={[
          styles.pollTotal,
          { fontFamily: fonts.medium, textAlign: isAr ? 'right' : 'left', color: colors.muted },
        ]}
      >
        {t.community.pollVotesCount.replace('{n}', String(total))}
      </Text>
      <PollVotersSheet
        postId={post.id}
        optionIndex={votersFor}
        optionLabel={voterOption?.label ?? ''}
        visible={votersFor != null}
        onClose={() => setVotersFor(null)}
        onProfile={onProfile}
      />
    </View>
  );
}

function ActionButton({
  label,
  count,
  icon,
  onPress,
  onLongPress,
  isAr,
  fonts,
  selected,
  colors,
}: {
  label: string;
  count: number;
  icon: React.ReactNode;
  onPress: () => void;
  onLongPress?: () => void;
  isAr: boolean;
  fonts: Props['fonts'];
  selected?: boolean;
  colors: { muted: string; textStrong: string };
}) {
  const inner = isAr ? (
    <>
      <Text style={[styles.actionLabel, { fontFamily: fonts.regular, color: colors.muted }]}>{label}</Text>
      <Text style={[styles.actionCount, { fontFamily: fonts.semibold, color: colors.textStrong }]}>
        {formatCount(count)}
      </Text>
      {icon}
    </>
  ) : (
    <>
      {icon}
      <Text style={[styles.actionCount, { fontFamily: fonts.semibold, color: colors.textStrong }]}>
        {formatCount(count)}
      </Text>
      <Text style={[styles.actionLabel, { fontFamily: fonts.regular, color: colors.muted }]}>{label}</Text>
    </>
  );
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={320}
      hitSlop={10}
      style={styles.action}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityHint={onLongPress ? label : undefined}
    >
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
  const { colors, isDark } = useCommunityTheme();
  const [likersOpen, setLikersOpen] = useState(false);
  useEffect(() => {
    setLikersOpen(false);
  }, [post.id]);
  const name = post.author.displayName || post.author.username;
  const row = isAr ? 'row-reverse' : 'row';
  const openProfile = () => onProfile(post.author.username);
  const showFollow = !post.isMine && onFollow;
  const following = post.author.isFollowing;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.cardBorder,
          borderWidth: isDark ? 0.5 : 0,
        },
        !isDark && COMMUNITY_LIGHT_ELEVATION.card,
      ]}
    >
      <View style={[styles.header, { flexDirection: row }]}>
        <CommunityAvatar uri={post.author.avatar} name={name} size={AVATAR_SIZE} onPress={openProfile} />
        <Pressable onPress={openProfile} style={[styles.meta, { alignItems: isAr ? 'flex-end' : 'flex-start' }]}>
          <View style={[styles.nameRow, { flexDirection: row }]}>
            <UserIdentity
              user={post.author}
              name={name}
              variant="inline"
              nameStyle={[styles.name, { fontFamily: fonts.semibold, color: colors.textStrong }]}
            />
          </View>
          <View style={[styles.timeRow, { flexDirection: row }]}>
            <Text style={[styles.time, { fontFamily: fonts.regular, color: colors.muted }]}>{timeLabel}</Text>
            <Image source={CI.earth} style={styles.icon12} contentFit="contain" tintColor={colors.muted} />
          </View>
        </Pressable>
        <View style={[styles.headerActions, { flexDirection: row }]}>
          {showFollow && (
            <Pressable
              onPress={() => onFollow(post)}
              style={[
                styles.followBtn,
                {
                  backgroundColor: following ? (isDark ? '#21153c' : 'rgba(106,43,217,0.1)') : colors.followBtn,
                },
              ]}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityState={{ selected: following }}
            >
              <Text
                style={[
                  styles.followText,
                  {
                    fontFamily: fonts.semibold,
                    color: following ? (isDark ? '#bdb6c3' : colors.accent) : colors.followText,
                  },
                ]}
              >
                {following ? labels.following : labels.follow}
              </Text>
            </Pressable>
          )}
          <Pressable onPress={() => onMenu(post)} hitSlop={12} style={styles.menuBtn} accessibilityRole="button" accessibilityLabel="More">
            <Image source={CI.overflow} style={styles.icon24} contentFit="contain" tintColor={colors.icon} />
          </Pressable>
        </View>
      </View>

      <View style={styles.body}>
        {(!!post.content || post.kind === 'TEAM_POLL') && (
          <View
            style={[
              styles.contentBox,
              { backgroundColor: colors.contentBox },
              post.kind === 'TEAM_POLL' && styles.contentBoxPoll,
            ]}
          >
            {!!post.content && (
              <RichText
                key={post.id}
                text={post.content}
                style={[styles.content, { fontFamily: fonts.medium, color: colors.textStrong }]}
                onHashtag={onHashtag}
                onMention={onMention}
                collapseAfterLines={post.image ? 4 : 8}
                seeMoreLabel={seeMore}
                seeLessLabel={seeLess}
              />
            )}
            {post.kind === 'TEAM_POLL' && (
              <PollOptions post={post} isAr={isAr} fonts={fonts} onVote={onVote} onProfile={onProfile} />
            )}
          </View>
        )}
        <PostImage
          post={post}
          width={contentWidth}
          priority={imagePriority}
          onOpen={() => onOpenImage(post)}
          onDoubleTap={() => onDoubleTapLike(post)}
        />
        <View style={[styles.actions, { flexDirection: isAr ? 'row' : 'row-reverse' }]}>
          <ActionButton
            label={labels.share}
            count={post.sharesCount}
            icon={<Image source={CI.share} style={styles.icon18} contentFit="contain" tintColor={colors.icon} />}
            onPress={() => onShare(post)}
            isAr={isAr}
            fonts={fonts}
            colors={colors}
          />
          <ActionButton
            label={labels.comment}
            count={post.commentsCount}
            icon={<Image source={CI.comment} style={styles.icon18} contentFit="contain" tintColor={colors.icon} />}
            onPress={() => onComment(post)}
            isAr={isAr}
            fonts={fonts}
            colors={colors}
          />
          <ActionButton
            label={labels.like}
            count={post.likesCount}
            icon={<LikeIcon liked={post.likedByMe} size={18} />}
            onPress={() => onLike(post)}
            onLongPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setLikersOpen(true);
            }}
            isAr={isAr}
            fonts={fonts}
            selected={post.likedByMe}
            colors={colors}
          />
        </View>
      </View>

      <LikersSheet
        postId={post.id}
        visible={likersOpen}
        onClose={() => setLikersOpen(false)}
        onProfile={onProfile}
      />
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
    borderWidth: 0.5,
    gap: 25,
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
    borderRadius: 54,
  },
  followText: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  nameRow: {
    alignItems: 'center',
    gap: 7,
    maxWidth: '100%',
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    flexShrink: 1,
  },
  timeRow: {
    alignItems: 'center',
    gap: 4,
  },
  time: {
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
    width: '100%',
  },
  contentBox: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 12,
    width: '100%',
  },
  contentBoxPoll: {
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
  },
  content: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '500',
  },
  pollStack: {
    gap: 8,
    width: '100%',
  },
  pollOption: {
    minHeight: 48,
    borderRadius: 14,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
  },
  pollFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    opacity: 0.28,
  },
  pollLabelHit: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pollCountHit: {
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  pollTotal: {
    fontSize: 13,
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
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  pollPct: {
    fontSize: 13,
    fontWeight: '500',
    opacity: 0.9,
    textAlign: 'center',
  },
  imageWrap: {
    borderRadius: POST_IMAGE_RADIUS,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  burst: {
    position: 'absolute',
  },
  actions: {
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 7,
    width: '100%',
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 48,
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: 14,
    lineHeight: 19,
  },
  actionCount: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '600',
  },
});
