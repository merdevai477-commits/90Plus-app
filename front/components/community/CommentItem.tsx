import React, { memo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';

import type { CommunityComment } from '../../services/community.api';
import { CommunityAvatar } from './CommunityAvatar';
import { LikeIcon } from './PostCard';
import { RichText } from './RichText';
import { formatCount } from './format';
import { C, CI, COMMENT_AVATAR_SIZE } from './theme';

export interface CommentHandlers {
  onLike: (c: CommunityComment) => void;
  onReply: (c: CommunityComment) => void;
  onMenu: (c: CommunityComment) => void;
  onProfile: (username: string) => void;
  onHashtag: (tag: string) => void;
  onMention: (username: string) => void;
}

interface Props extends CommentHandlers {
  comment: CommunityComment;
  isReply: boolean;
  isAr: boolean;
  timeLabel: string;
  fonts: { regular: string; medium: string; semibold: string };
  labels: { reply: string };
}

/**
 * Figma node 1474:4347 — header is [heart ⟷ name/time] + avatar, then
 * body text aligned to the avatar side. Reply/menu stay as product actions.
 */
export const CommentItem = memo(
  function CommentItem({
    comment,
    isReply,
    isAr,
    timeLabel,
    fonts,
    labels,
    onLike,
    onReply,
    onMenu,
    onProfile,
    onHashtag,
    onMention,
  }: Props) {
    const name = comment.author.displayName || comment.author.username;
    const pending = comment.id.startsWith('temp-');
    const size = isReply ? 28 : COMMENT_AVATAR_SIZE;
    const textAlign = isAr ? 'right' : 'left';

    const likeControl = pending ? (
      <ActivityIndicator size="small" color={C.accentSoft} />
    ) : (
      <Pressable
        onPress={() => onLike(comment)}
        hitSlop={12}
        style={styles.like}
        accessibilityRole="button"
        accessibilityState={{ selected: comment.likedByMe }}
      >
        {comment.likedByMe ? (
          <LikeIcon liked size={24} />
        ) : (
          <Image source={CI.commentHeartOutlined} style={styles.heartIcon} contentFit="contain" />
        )}
        {comment.likesCount > 0 && (
          <Text style={[styles.likeCount, { fontFamily: fonts.regular }]}>{formatCount(comment.likesCount)}</Text>
        )}
      </Pressable>
    );

    const meta = (
      <Pressable
        onPress={() => onProfile(comment.author.username)}
        style={[styles.meta, { alignItems: isAr ? 'flex-end' : 'flex-start' }]}
      >
        <View style={[styles.nameRow, { flexDirection: isAr ? 'row-reverse' : 'row' }]}>
          <Text style={[styles.name, isReply && styles.nameSmall, { fontFamily: fonts.semibold }]} numberOfLines={1}>
            {name}
          </Text>
          {comment.author.isVerified && <Image source={CI.verified} style={styles.icon16} contentFit="contain" />}
        </View>
        <View style={[styles.timeRow, { flexDirection: isAr ? 'row-reverse' : 'row' }]}>
          <Text style={[styles.time, { fontFamily: fonts.regular }]}>{timeLabel}</Text>
          <Image source={CI.earth} style={styles.icon16} contentFit="contain" />
        </View>
      </Pressable>
    );

    return (
      <Pressable
        onLongPress={() => !pending && onMenu(comment)}
        delayLongPress={320}
        style={[styles.wrap, isReply && (isAr ? styles.replyAr : styles.replyEn), pending && styles.pending]}
      >
        {/* Figma 1474:4348 — flex-1 space-between (heart + meta) then avatar */}
        <View style={[styles.header, { flexDirection: isAr ? 'row' : 'row-reverse' }]}>
          <View style={[styles.headerMain, { flexDirection: isAr ? 'row' : 'row-reverse' }]}>
            {likeControl}
            {meta}
          </View>
          <CommunityAvatar
            uri={comment.author.avatar}
            name={name}
            size={size}
            onPress={() => onProfile(comment.author.username)}
          />
        </View>

        <RichText
          key={comment.id}
          text={comment.content}
          style={[styles.text, { fontFamily: fonts.medium }]}
          align={textAlign}
          onHashtag={onHashtag}
          onMention={onMention}
          onLongPress={() => !pending && onMenu(comment)}
        />

        {!pending && (
          <View style={[styles.footer, { flexDirection: isAr ? 'row-reverse' : 'row', alignSelf: isAr ? 'flex-end' : 'flex-start' }]}>
            <Pressable onPress={() => onReply(comment)} hitSlop={8} accessibilityRole="button">
              <Text style={[styles.replyBtn, { fontFamily: fonts.semibold }]}>{labels.reply}</Text>
            </Pressable>
            <Pressable onPress={() => onMenu(comment)} hitSlop={8} accessibilityRole="button" accessibilityLabel="More">
              <Image source={CI.overflow} style={styles.menuIcon} contentFit="contain" />
            </Pressable>
          </View>
        )}
      </Pressable>
    );
  },
  (a, b) => a.comment === b.comment && a.isAr === b.isAr && a.timeLabel === b.timeLabel && a.fonts === b.fonts,
);

const styles = StyleSheet.create({
  wrap: {
    gap: 12,
    paddingVertical: 12,
    alignItems: 'stretch',
  },
  replyAr: {
    marginRight: 46,
  },
  replyEn: {
    marginLeft: 46,
  },
  pending: {
    opacity: 0.6,
  },
  header: {
    alignItems: 'center',
    gap: 11,
    width: '100%',
  },
  headerMain: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    minWidth: 0,
  },
  meta: {
    gap: 4,
    flexShrink: 1,
    maxWidth: '78%',
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
  nameSmall: {
    fontSize: 14,
  },
  timeRow: {
    alignItems: 'center',
    gap: 4,
  },
  time: {
    color: '#a3a3a3',
    fontSize: 13,
  },
  icon16: { width: 16, height: 16 },
  heartIcon: { width: 24, height: 24 },
  like: {
    alignItems: 'center',
    minWidth: 24,
  },
  likeCount: {
    color: C.muted,
    fontSize: 11,
    marginTop: 1,
  },
  text: {
    color: C.textStrong,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '500',
    width: '100%',
  },
  footer: {
    alignItems: 'center',
    gap: 18,
  },
  replyBtn: {
    color: C.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  menuIcon: {
    width: 18,
    height: 18,
    // Asset is vertical; rotate to match horizontal "…" in the comments sheet.
    transform: [{ rotate: '90deg' }],
  },
});
