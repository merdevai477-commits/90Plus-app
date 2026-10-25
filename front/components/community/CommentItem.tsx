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

/** Figma node 1474:4305 — avatar, name/time column, heart, then the text. */
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
    const row = isAr ? 'row-reverse' : 'row';
    const name = comment.author.displayName || comment.author.username;
    const pending = comment.id.startsWith('temp-');
    const size = isReply ? 28 : COMMENT_AVATAR_SIZE;

    return (
      <Pressable
        onLongPress={() => !pending && onMenu(comment)}
        delayLongPress={320}
        style={[styles.wrap, isReply && (isAr ? styles.replyAr : styles.replyEn), pending && styles.pending]}
      >
        <View style={[styles.header, { flexDirection: row }]}>
          <CommunityAvatar
            uri={comment.author.avatar}
            name={name}
            size={size}
            onPress={() => onProfile(comment.author.username)}
          />
          <Pressable
            onPress={() => onProfile(comment.author.username)}
            style={[styles.meta, { alignItems: isAr ? 'flex-end' : 'flex-start' }]}
          >
            <View style={[styles.nameRow, { flexDirection: row }]}>
              <Text style={[styles.name, isReply && styles.nameSmall, { fontFamily: fonts.semibold }]} numberOfLines={1}>
                {name}
              </Text>
              {comment.author.isVerified && <Image source={CI.verified} style={styles.icon16} contentFit="contain" />}
            </View>
            <View style={[styles.timeRow, { flexDirection: row }]}>
              <Text style={[styles.time, { fontFamily: fonts.regular }]}>{timeLabel}</Text>
              <Image source={CI.earth} style={styles.icon14} contentFit="contain" />
            </View>
          </Pressable>
          {pending ? (
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
                <LikeIcon liked size={22} />
              ) : (
                <Image source={CI.commentHeartOutlined} style={{ width: 22, height: 22 }} contentFit="contain" />
              )}
              {comment.likesCount > 0 && (
                <Text style={[styles.likeCount, { fontFamily: fonts.regular }]}>{formatCount(comment.likesCount)}</Text>
              )}
            </Pressable>
          )}
        </View>

        <RichText
          key={comment.id}
          text={comment.content}
          style={[styles.text, { fontFamily: fonts.medium }]}
          onHashtag={onHashtag}
          onMention={onMention}
          onLongPress={() => !pending && onMenu(comment)}
        />

        {!pending && (
          <View style={[styles.footer, { flexDirection: row }]}>
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
    gap: 10,
    paddingVertical: 12,
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
  },
  meta: {
    flex: 1,
    gap: 3,
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
    color: C.muted,
    fontSize: 12,
  },
  icon16: { width: 16, height: 16 },
  icon14: { width: 14, height: 14 },
  like: {
    alignItems: 'center',
    minWidth: 28,
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
    transform: [{ rotate: '90deg' }],
  },
});
