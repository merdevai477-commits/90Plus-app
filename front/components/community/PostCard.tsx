import React, { memo, useCallback, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
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
}

/** Figma ratio: 216px tall image in a 368px wide card body. */
export const IMAGE_ASPECT = 216 / 368;

export const LikeIcon = memo(function LikeIcon({ liked, size = 24 }: { liked: boolean; size?: number }) {
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
}: {
  post: CommunityPost;
  width: number;
  onOpen: () => void;
  onDoubleTap: () => void;
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
          transition={180}
          cachePolicy="memory-disk"
          recyclingKey={post.id}
          priority="high"
        />
        <Animated.View pointerEvents="none" style={[styles.burst, heartStyle]}>
          <Image source={CI.heartFilled} tintColor="#FFFFFF" style={{ width: 92, height: 92 }} contentFit="contain" />
        </Animated.View>
      </View>
    </GestureDetector>
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
  onLike,
  onDoubleTapLike,
  onComment,
  onShare,
  onMenu,
  onOpenImage,
  onProfile,
  onHashtag,
  onMention,
}: Props) {
  const name = post.author.displayName || post.author.username;
  const row = isAr ? 'row-reverse' : 'row';
  const openProfile = () => onProfile(post.author.username);

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
            <Image source={CI.earth} style={styles.icon16} contentFit="contain" />
          </View>
        </Pressable>
        <Pressable onPress={() => onMenu(post)} hitSlop={12} style={styles.menuBtn} accessibilityRole="button" accessibilityLabel="More">
          <Image source={CI.overflow} style={styles.icon24} contentFit="contain" />
        </Pressable>
      </View>

      <View style={styles.body}>
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
        <PostImage
          post={post}
          width={contentWidth}
          onOpen={() => onOpenImage(post)}
          onDoubleTap={() => onDoubleTapLike(post)}
        />
      </View>

      <View style={[styles.actions, { flexDirection: isAr ? 'row' : 'row-reverse' }]}>
        <Pressable onPress={() => onShare(post)} hitSlop={10} style={styles.action} accessibilityRole="button">
          <Image source={CI.share} style={styles.icon24} contentFit="contain" />
          <Text style={[styles.counter, { fontFamily: fonts.regular }]}>{formatCount(post.sharesCount)}</Text>
        </Pressable>
        <Pressable onPress={() => onComment(post)} hitSlop={10} style={styles.action} accessibilityRole="button">
          <Image source={CI.comment} style={styles.icon24} contentFit="contain" />
          <Text style={[styles.counter, { fontFamily: fonts.regular }]}>{formatCount(post.commentsCount)}</Text>
        </Pressable>
        <Pressable
          onPress={() => onLike(post)}
          hitSlop={10}
          style={styles.action}
          accessibilityRole="button"
          accessibilityState={{ selected: post.likedByMe }}
        >
          <LikeIcon liked={post.likedByMe} />
          <Text style={[styles.counter, { fontFamily: fonts.regular }]}>{formatCount(post.likesCount)}</Text>
        </Pressable>
      </View>
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
    a.fonts === b.fonts,
);

export const postCardStyles = StyleSheet.create({
  card: {
    paddingHorizontal: 16,
    paddingVertical: 25,
    borderRadius: CARD_RADIUS,
    backgroundColor: C.card,
    borderWidth: 0.5,
    borderColor: C.cardBorder,
    gap: 22,
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
  nameRow: {
    alignItems: 'center',
    gap: 7,
    maxWidth: '100%',
  },
  name: {
    color: C.textStrong,
    fontSize: 16,
    fontWeight: '600',
    flexShrink: 1,
  },
  timeRow: {
    alignItems: 'center',
    gap: 4,
  },
  time: {
    color: C.muted,
    fontSize: 13,
  },
  menuBtn: {
    alignSelf: 'center',
  },
  icon16: { width: 16, height: 16 },
  icon24: { width: 24, height: 24 },
  body: {
    gap: 12,
  },
  content: {
    color: C.text,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '500',
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
    paddingHorizontal: 7,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 48,
    justifyContent: 'center',
  },
  counter: {
    color: C.counter,
    fontSize: 16,
  },
});
