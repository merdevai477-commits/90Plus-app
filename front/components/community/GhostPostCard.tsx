import React, { memo, useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  FadeIn,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { CircleAlert, RotateCcw, Pencil, X } from 'lucide-react-native';

import { usePublishStore, type PendingPost } from '../../hooks/community/publishQueue';
import { CommunityAvatar } from './CommunityAvatar';
import { ShimmerSweep } from './Shimmer';
import { IMAGE_ASPECT, postCardStyles } from './PostCard';
import { AVATAR_SIZE, C, CI, POST_IMAGE_RADIUS } from './theme';
import { isArabicText } from './richTextParse';

interface Props {
  pending: PendingPost;
  contentWidth: number;
  isAr: boolean;
  fonts: { regular: string; medium: string; semibold: string };
  labels: { publishing: string; failed: string; retry: string; edit: string; discard: string };
  errorText: string | null;
  errorTitle?: string | null;
  canRetry: boolean;
  onRetry: () => void;
  onEdit: () => void;
  onDiscard: () => void;
}

/** Optimistic "ghost" of a post that is still being published. */
export const GhostPostCard = memo(function GhostPostCard({
  pending,
  contentWidth,
  isAr,
  fonts,
  labels,
  errorText,
  errorTitle,
  canRetry,
  onRetry,
  onEdit,
  onDiscard,
}: Props) {
  const progress = usePublishStore((s) => s.drafts[pending.clientId]?.progress ?? (pending.image ? 0 : 1));
  const failed = pending.status === 'failed';
  const pulse = useSharedValue(0.55);
  const bar = useSharedValue(0);

  useEffect(() => {
    if (failed) {
      cancelAnimation(pulse);
      pulse.value = withTiming(1, { duration: 200 });
      return;
    }
    pulse.value = withRepeat(withTiming(0.85, { duration: 900 }), -1, true);
    return () => cancelAnimation(pulse);
  }, [failed, pulse]);

  useEffect(() => {
    bar.value = withTiming(failed ? bar.value : Math.max(0.08, progress * 0.9), { duration: 260 });
  }, [progress, failed, bar]);

  const cardStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));
  const barStyle = useAnimatedStyle(() => ({ width: `${bar.value * 100}%` }));

  const row = isAr ? 'row-reverse' : 'row';
  const name = pending.author.displayName || pending.author.username;
  const rtl = isArabicText(pending.content);
  const imgHeight = Math.round(contentWidth * IMAGE_ASPECT);

  return (
    <Animated.View entering={FadeIn.duration(220)} style={[postCardStyles.card, styles.ghost, failed && styles.failedBorder]}>
      <Animated.View style={[styles.inner, cardStyle]}>
        <View style={[styles.header, { flexDirection: row }]}>
          <CommunityAvatar uri={pending.author.avatar} name={name} size={AVATAR_SIZE} />
          <View style={[styles.meta, { alignItems: isAr ? 'flex-end' : 'flex-start' }]}>
            <View style={[styles.nameRow, { flexDirection: row }]}>
              <Text style={[styles.name, { fontFamily: fonts.semibold }]} numberOfLines={1}>
                {name}
              </Text>
              {pending.author.isVerified && <Image source={CI.verified} style={styles.icon16} contentFit="contain" />}
            </View>
            <Text style={[styles.status, { fontFamily: fonts.regular }, failed && { color: C.danger }]}>
              {failed ? labels.failed : labels.publishing}
            </Text>
          </View>
        </View>

        {!!pending.content && (
          <Text
            style={[
              styles.content,
              { fontFamily: fonts.medium, textAlign: rtl ? 'right' : 'left', writingDirection: rtl ? 'rtl' : 'ltr' },
            ]}
            numberOfLines={6}
          >
            {pending.content}
          </Text>
        )}

        {pending.image && (
          <View style={[styles.imageWrap, { height: imgHeight }]}>
            <Image source={{ uri: pending.image.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
            {!failed && <View style={styles.imageVeil} />}
          </View>
        )}
      </Animated.View>

      {!failed && (
        <View style={styles.track}>
          <Animated.View style={[styles.bar, barStyle]} />
          <ShimmerSweep width={contentWidth} color="rgba(255,255,255,0.35)" />
        </View>
      )}

      {failed && (
        <View style={styles.failBox}>
          {(!!errorTitle || !!errorText) && (
            <View style={[styles.errorRow, { flexDirection: isAr ? 'row-reverse' : 'row' }]}>
              <CircleAlert size={18} color="#FCA5A5" />
              <View style={{ flex: 1, gap: 2 }}>
                {!!errorTitle && (
                  <Text style={[styles.errorTitle, { fontFamily: fonts.semibold, textAlign: isAr ? 'right' : 'left' }]}>
                    {errorTitle}
                  </Text>
                )}
                {!!errorText && (
                  <Text style={[styles.errorText, { fontFamily: fonts.regular, textAlign: isAr ? 'right' : 'left' }]}>{errorText}</Text>
                )}
              </View>
            </View>
          )}
          <View style={[styles.failActions, { flexDirection: row }]}>
            {canRetry ? (
              <Pressable onPress={onRetry} style={[styles.pill, styles.pillPrimary]} accessibilityRole="button">
                <RotateCcw size={16} color="#FFF" />
                <Text style={[styles.pillText, { fontFamily: fonts.semibold }]}>{labels.retry}</Text>
              </Pressable>
            ) : (
              <Pressable onPress={onEdit} style={[styles.pill, styles.pillPrimary]} accessibilityRole="button">
                <Pencil size={16} color="#FFF" />
                <Text style={[styles.pillText, { fontFamily: fonts.semibold }]}>{labels.edit}</Text>
              </Pressable>
            )}
            <Pressable onPress={onDiscard} style={styles.pill} accessibilityRole="button">
              <X size={16} color={C.muted} />
              <Text style={[styles.pillText, { color: C.muted, fontFamily: fonts.semibold }]}>{labels.discard}</Text>
            </Pressable>
          </View>
        </View>
      )}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  ghost: {
    overflow: 'hidden',
    borderColor: 'rgba(139,92,246,0.35)',
  },
  failedBorder: {
    borderColor: 'rgba(239,68,68,0.45)',
  },
  inner: {
    gap: 16,
  },
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
  },
  name: {
    color: C.textStrong,
    fontSize: 16,
    fontWeight: '600',
    flexShrink: 1,
  },
  status: {
    color: C.accentSoft,
    fontSize: 13,
  },
  icon16: { width: 16, height: 16 },
  content: {
    color: C.text,
    fontSize: 16,
    lineHeight: 22,
  },
  imageWrap: {
    borderRadius: POST_IMAGE_RADIUS,
    overflow: 'hidden',
    backgroundColor: '#15111F',
  },
  imageVeil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(9,7,16,0.35)',
  },
  track: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(139,92,246,0.18)',
    overflow: 'hidden',
    marginTop: -6,
  },
  bar: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: C.accent,
  },
  failBox: {
    gap: 12,
    marginTop: -6,
  },
  errorRow: {
    alignItems: 'flex-start',
    gap: 8,
  },
  errorTitle: {
    color: '#FECACA',
    fontSize: 14,
    fontWeight: '700',
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 13,
    lineHeight: 18,
  },
  failActions: {
    gap: 10,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: C.input,
    borderWidth: 1,
    borderColor: C.inputBorder,
  },
  pillPrimary: {
    backgroundColor: C.accent,
    borderColor: C.accent,
  },
  pillText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
