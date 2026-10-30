import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MessageCircle } from 'lucide-react-native';

import type { CommunityPost } from '../../services/community.api';
import { ActionMenu } from './ActionMenu';
import { ConfirmSheet } from './ConfirmSheet';
import { CommentComposer } from './CommentComposer';
import { formatCount } from './format';
import { useCommentThread } from './useCommentThread';
import { C } from './theme';

interface Props {
  post: CommunityPost | null;
  onClose: () => void;
}

const SPRING = { damping: 26, stiffness: 260, mass: 0.9 } as const;

/**
 * Facebook-style comments sheet: slides up to 60% of the screen, drags up to
 * full height, flicks down to dismiss, and lifts its input with the keyboard.
 */
export function CommentsSheet({ post, onClose }: Props) {
  const visible = !!post;
  const { height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [keyboardH, setKeyboardH] = useState(0);
  const ctx = useCommentThread(post, visible);
  const { s, fonts, isAr } = ctx;

  const fullTop = insets.top + 8;
  const halfTop = Math.round(screenH * 0.4);
  const closedTop = screenH;
  const top = useSharedValue(closedTop);
  const startTop = useSharedValue(0);

  const close = useCallback(() => {
    Keyboard.dismiss();
    top.value = withTiming(closedTop, { duration: 220 }, (done) => {
      if (done) runOnJS(onClose)();
    });
  }, [closedTop, onClose, top]);

  useEffect(() => {
    if (visible) top.value = withSpring(halfTop, SPRING);
    else top.value = closedTop;
  }, [visible, halfTop, closedTop, top]);

  useEffect(() => {
    if (!visible) return;
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const a = Keyboard.addListener(showEvt, (e) => {
      setKeyboardH(e.endCoordinates.height);
      top.value = withSpring(fullTop, SPRING);
    });
    const b = Keyboard.addListener(hideEvt, () => setKeyboardH(0));
    return () => {
      a.remove();
      b.remove();
    };
  }, [visible, fullTop, top]);

  const pan = Gesture.Pan()
    .onBegin(() => {
      startTop.value = top.value;
    })
    .onUpdate((e) => {
      top.value = Math.max(fullTop, startTop.value + e.translationY);
    })
    .onEnd((e) => {
      const projected = top.value + e.velocityY * 0.18;
      if (projected > halfTop + (closedTop - halfTop) * 0.35) {
        runOnJS(close)();
      } else if (projected < (fullTop + halfTop) / 2) {
        top.value = withSpring(fullTop, { ...SPRING, velocity: e.velocityY });
      } else {
        top.value = withSpring(halfTop, { ...SPRING, velocity: e.velocityY });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({ top: top.value }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(top.value, [fullTop, halfTop, closedTop], [1, 0.85, 0], Extrapolation.CLAMP),
  }));

  const commentsCount = post?.commentsCount ?? 0;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={close} statusBarTranslucent navigationBarTranslucent>
      <GestureHandlerRootView style={StyleSheet.absoluteFill}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        </Animated.View>

        <Animated.View style={[styles.sheet, sheetStyle]}>
          <GestureDetector gesture={pan}>
            <View style={styles.handleArea}>
              <View style={styles.grabber} />
              <View style={[styles.titleRow, { flexDirection: isAr ? 'row-reverse' : 'row' }]}>
                <Text style={[styles.title, { fontFamily: fonts.semibold }]}>{s.comments}</Text>
                {commentsCount > 0 && (
                  <View style={styles.countPill}>
                    <Text style={[styles.countText, { fontFamily: fonts.semibold }]}>{formatCount(commentsCount)}</Text>
                  </View>
                )}
              </View>
            </View>
          </GestureDetector>

          <View style={{ flex: 1 }}>
            {ctx.thread.isLoading ? (
              <View style={styles.center}>
                <ActivityIndicator color={C.accentSoft} />
              </View>
            ) : (
              <FlashList
                data={ctx.rows}
                renderItem={ctx.renderRow}
                keyExtractor={(r) => r.key}
                getItemType={(r) => r.type}
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                onEndReached={() => {
                  if (ctx.thread.hasNextPage && !ctx.thread.isFetchingNextPage) void ctx.thread.fetchNextPage();
                }}
                onEndReachedThreshold={0.6}
                ListEmptyComponent={
                  <View style={styles.empty}>
                    <MessageCircle size={40} color={C.accentDeep} />
                    <Text style={[styles.emptyText, { fontFamily: fonts.regular }]}>{s.noComments}</Text>
                  </View>
                }
                ListFooterComponent={
                  ctx.thread.isFetchingNextPage ? <ActivityIndicator style={{ marginVertical: 16 }} color={C.accentSoft} /> : null
                }
              />
            )}
          </View>

          <View style={{ paddingBottom: keyboardH }}>
            <CommentComposer
              ref={ctx.composerRef}
              isAr={isAr}
              fonts={fonts}
              labels={ctx.composerLabels}
              onSubmit={ctx.submit}
              onError={ctx.onError}
              bottomInset={keyboardH > 0 ? 0 : insets.bottom}
            />
          </View>
        </Animated.View>

        <ActionMenu
          visible={!!ctx.menu}
          items={ctx.menuItems}
          cancelLabel={s.cancel}
          onClose={ctx.closeMenu}
          fontFamily={fonts.semibold}
        />
        <ActionMenu
          visible={ctx.reportOpen}
          title={s.reportTitle}
          items={ctx.reportItems}
          cancelLabel={s.cancel}
          onClose={ctx.closeReport}
          fontFamily={fonts.semibold}
        />
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
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: C.overlay,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: C.screen,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: C.inputBorder,
    overflow: 'hidden',
  },
  handleArea: {
    paddingTop: 10,
    paddingBottom: 12,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.cardBorder,
  },
  grabber: {
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#3A3348',
    marginBottom: 10,
  },
  titleRow: {
    alignItems: 'center',
    gap: 8,
  },
  title: {
    color: C.textStrong,
    fontSize: 17,
    fontWeight: '600',
  },
  countPill: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 999,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    color: C.textStrong,
    fontSize: 12,
    fontWeight: '600',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    alignItems: 'center',
    paddingTop: 48,
    gap: 12,
  },
  emptyText: {
    color: C.muted,
    fontSize: 14,
    textAlign: 'center',
  },
});
