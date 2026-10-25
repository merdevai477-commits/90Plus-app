import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import type { CommunityComment, CommunityPost } from '../../services/community.api';
import { toastManager } from '../../services/toastManager';
import { useTranslation } from '../../src/i18n';
import { getAppFont } from '../../utils/fontSetup';
import { useComments, type CommentRow } from '../../hooks/community/useComments';
import { useCommunityMe } from '../../hooks/community/useCommunityMe';
import { usePostActions } from '../../hooks/community/usePostActions';
import type { ActionMenuItem } from './ActionMenu';
import { CommentItem } from './CommentItem';
import type { CommentComposerHandle } from './CommentComposer';
import { communityErrorMessage, fillTemplate, formatRelativeTime } from './format';
import { C } from './theme';

/**
 * Everything a comments surface needs — rows, renderers, composer wiring and
 * the long-press menu — shared by the feed's sheet and the post screen.
 */
export function useCommentThread(post: Pick<CommunityPost, 'id' | 'isMine'> | null, enabled = true) {
  const postId = post?.id ?? '';
  const { t, language } = useTranslation();
  const s = t.community;
  const isAr = language === 'ar';
  const me = useCommunityMe();
  const actions = usePostActions();
  const thread = useComments(postId, enabled && !!postId);
  const composerRef = useRef<CommentComposerHandle>(null);
  const [menu, setMenu] = useState<CommunityComment | null>(null);

  const fonts = useMemo(
    () => ({ regular: getAppFont(400, language), medium: getAppFont(500, language), semibold: getAppFont(600, language) }),
    [language],
  );
  const labels = useMemo(() => ({ reply: s.reply }), [s.reply]);

  const onReply = useCallback((c: CommunityComment) => composerRef.current?.replyTo(c), []);
  const onMenu = useCallback((c: CommunityComment) => setMenu(c), []);

  const renderRow = useCallback(
    ({ item }: { item: CommentRow }) => {
      if (item.type === 'more') {
        return (
          <Pressable
            onPress={() => void thread.loadMoreReplies(item.rootId)}
            style={[styles.more, isAr ? { marginRight: 46, flexDirection: 'row-reverse' } : { marginLeft: 46 }]}
            hitSlop={6}
          >
            <View style={styles.moreLine} />
            {item.loading ? (
              <ActivityIndicator size="small" color={C.accentSoft} />
            ) : (
              <Text style={[styles.moreText, { fontFamily: fonts.semibold }]}>
                {item.remaining === 1 ? s.viewReply : fillTemplate(s.viewReplies, { count: item.remaining })}
              </Text>
            )}
          </Pressable>
        );
      }
      return (
        <CommentItem
          comment={item.comment}
          isReply={item.type === 'reply'}
          isAr={isAr}
          timeLabel={formatRelativeTime(item.comment.createdAt, s)}
          fonts={fonts}
          labels={labels}
          onLike={thread.toggleLike}
          onReply={onReply}
          onMenu={onMenu}
          onProfile={actions.openProfile}
          onHashtag={actions.openHashtag}
          onMention={actions.openProfile}
        />
      );
    },
    [actions.openHashtag, actions.openProfile, fonts, isAr, labels, onMenu, onReply, s, thread],
  );

  const submit = useCallback(
    (text: string, replyTo: CommunityComment | null) => thread.submit(text, me, replyTo),
    [me, thread],
  );
  const onError = useCallback((err: unknown) => toastManager.showError(s.comments, communityErrorMessage(err, s)), [s]);

  const menuItems = useMemo<ActionMenuItem[]>(() => {
    if (!menu) return [];
    const items: ActionMenuItem[] = [
      { key: 'reply', label: s.reply, onPress: () => onReply(menu) },
      { key: 'copy', label: s.copyText, onPress: () => void actions.copyText(menu.content) },
    ];
    if (!menu.isMine) {
      items.push({ key: 'profile', label: s.viewProfile, onPress: () => actions.openProfile(menu.author.username) });
      items.push({
        key: 'report',
        label: s.reportComment,
        destructive: true,
        onPress: () => actions.askReport('comment', menu.id, () => thread.hideLocally(menu)),
      });
    }
    if (menu.isMine || post?.isMine) {
      items.push({
        key: 'delete',
        label: s.delete,
        destructive: true,
        onPress: () =>
          Alert.alert(s.deleteCommentTitle, s.deleteBody, [
            { text: s.cancel, style: 'cancel' },
            { text: s.delete, style: 'destructive', onPress: () => void thread.remove(menu) },
          ]),
      });
    }
    return items;
  }, [actions, menu, onReply, post?.isMine, s, thread]);

  const composerLabels = useMemo(
    () => ({ placeholder: s.writeComment, replyingTo: s.replyingTo, noUsers: s.noUsersFound, cooldown: s.commentCooldown }),
    [s],
  );

  return {
    thread,
    rows: thread.rows,
    renderRow,
    composerRef,
    composerLabels,
    submit,
    onError,
    menu,
    menuItems,
    closeMenu: () => setMenu(null),
    fonts,
    isAr,
    s,
  };
}

const styles = StyleSheet.create({
  more: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  moreLine: {
    width: 24,
    height: 1,
    backgroundColor: C.inputBorder,
  },
  moreText: {
    color: C.muted,
    fontSize: 13,
    fontWeight: '600',
  },
});
