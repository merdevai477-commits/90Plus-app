import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { AtSign, Hash, RotateCcw, X } from 'lucide-react-native';

import { CommunityAvatar } from '../../components/community/CommunityAvatar';
import { ConfirmSheet } from '../../components/community/ConfirmSheet';
import { KeyboardDock } from '../../components/community/KeyboardDock';
import { MentionSuggestions } from '../../components/community/MentionSuggestions';
import { activeMentionQuery, isArabicText } from '../../components/community/richTextParse';
import { communityErrorMessage, fillTemplate } from '../../components/community/format';
import { C, CI, POST_IMAGE_RADIUS } from '../../components/community/theme';
import {
  cancelImageUpload,
  newClientId,
  publishPost,
  startImageUpload,
  usePublishStore,
  waitForImageUpload,
} from '../../hooks/community/publishQueue';
import { findPost, updatePostEverywhere } from '../../hooks/community/communityCache';
import { useCommunityMe } from '../../hooks/community/useCommunityMe';
import { useCommunityToken } from '../../hooks/community/useCommunityFeed';
import { useMentionSearch } from '../../hooks/community/useMentionSearch';
import { communityApi, type CommunityAuthor } from '../../services/community.api';
import { toastManager } from '../../services/toastManager';
import { useTranslation } from '../../src/i18n';
import { getAppFont } from '../../utils/fontSetup';

const MAX_LEN = 2000;
const WARN_AT = 200;

function UploadBar({ progress }: { progress: number }) {
  const value = useSharedValue(progress);
  useEffect(() => {
    value.value = withTiming(progress, { duration: 220 });
  }, [progress, value]);
  const style = useAnimatedStyle(() => ({ width: `${value.value * 100}%` }));
  return (
    <View style={styles.barTrack}>
      <Animated.View style={[styles.barFill, style]} />
    </View>
  );
}

function insertAt(text: string, caret: number, insert: string): { next: string; caret: number } {
  const next = `${text.slice(0, caret)}${insert}${text.slice(caret)}`.slice(0, MAX_LEN);
  return { next, caret: Math.min(MAX_LEN, caret + insert.length) };
}

export default function ComposeScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { t, language } = useTranslation();
  const s = t.community;
  const isAr = language === 'ar';
  const getToken = useCommunityToken();
  const me = useCommunityMe();
  const params = useLocalSearchParams<{ restore?: string; photo?: string; edit?: string }>();
  const editId = typeof params.edit === 'string' && params.edit ? params.edit : null;
  const editing = !!editId;
  const existing = editId ? findPost(qc, editId) : undefined;

  const [clientId] = useState(() => {
    const restoring = params.restore && usePublishStore.getState().pending.find((p) => p.clientId === params.restore);
    return restoring ? restoring.clientId : newClientId();
  });
  const [text, setText] = useState(() => {
    const pending = usePublishStore.getState().pending.find((x) => x.clientId === params.restore);
    if (pending) return pending.content;
    return existing?.content ?? '';
  });
  const [caret, setCaret] = useState(0);
  const [keepRemoteImage, setKeepRemoteImage] = useState(() => !!existing?.image);
  const [saving, setSaving] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const draft = usePublishStore((st) => st.drafts[clientId]);
  const inputRef = useRef<TextInput>(null);
  const published = useRef(false);

  const fonts = useMemo(
    () => ({ regular: getAppFont(400, language), medium: getAppFont(500, language), semibold: getAppFont(600, language) }),
    [language],
  );

  useEffect(() => {
    if (params.restore) usePublishStore.getState().removePending(params.restore);
  }, [params.restore]);

  const pickImage = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, allowsEditing: false });
      if (result.canceled || !result.assets?.[0]) return;
      const a = result.assets[0];
      setKeepRemoteImage(false);
      startImageUpload(getToken, clientId, { uri: a.uri, width: a.width || 1080, height: a.height || 1080 });
    } catch {
      toastManager.showError(s.addPhoto, s.imageFailed);
    }
  }, [clientId, getToken, s.addPhoto, s.imageFailed]);

  useEffect(() => {
    if (params.photo === '1' && !params.restore) {
      const id = setTimeout(() => void pickImage(), 250);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => inputRef.current?.focus(), 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasLocalImage = !!draft;
  const hasRemoteImage = editing && keepRemoteImage && !!existing?.image && !hasLocalImage;
  const hasImage = hasLocalImage || hasRemoteImage;
  const trimmed = text.trim();
  const dirty =
    !editing ||
    trimmed !== (existing?.content ?? '').trim() ||
    hasLocalImage ||
    keepRemoteImage !== !!existing?.image;
  const hasContent = trimmed.length > 0 || hasImage;
  const overLimit = text.length > MAX_LEN;
  const canPost = hasContent && !overLimit && !saving && (!editing || dirty);

  const leave = useCallback(() => {
    if (!published.current) cancelImageUpload(clientId);
    router.back();
  }, [clientId, router]);

  const confirmLeave = useCallback(() => {
    if (!hasContent || (editing && !dirty)) {
      leave();
      return true;
    }
    setDiscardOpen(true);
    return true;
  }, [dirty, editing, hasContent, leave]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', confirmLeave);
    return () => sub.remove();
  }, [confirmLeave]);

  const applyInsert = useCallback(
    (token: string) => {
      const { next, caret: pos } = insertAt(text, caret, token);
      setText(next);
      setCaret(pos);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.setNativeProps({ selection: { start: pos, end: pos } });
      });
    },
    [caret, text],
  );

  const saveEdit = useCallback(async () => {
    if (!editId || !canPost) return;
    setSaving(true);
    try {
      let mediaId: string | undefined;
      if (draft) {
        if (draft.status === 'failed' || !draft.media) {
          startImageUpload(getToken, clientId, draft.local);
        }
        mediaId = (await waitForImageUpload(clientId)).id;
      }
      const removeImage = !keepRemoteImage && !draft && !!existing?.image;
      const post = await communityApi.updatePost(getToken, editId, {
        content: trimmed,
        ...(mediaId ? { mediaId } : {}),
        ...(removeImage ? { removeImage: true } : {}),
      });
      updatePostEverywhere(qc, editId, () => post);
      qc.setQueryData(['community', 'post', editId], post);
      cancelImageUpload(clientId);
      published.current = true;
      toastManager.showSuccess(s.posted, '');
      router.back();
    } catch (err) {
      toastManager.showError(s.failedToPost, communityErrorMessage(err, s));
    } finally {
      setSaving(false);
    }
  }, [canPost, clientId, draft, editId, existing?.image, getToken, keepRemoteImage, qc, router, s, trimmed]);

  const post = useCallback(() => {
    if (!canPost) return;
    if (editing) {
      void saveEdit();
      return;
    }
    published.current = true;
    publishPost({ getToken, queryClient: qc, clientId, content: trimmed, author: me });
    router.back();
  }, [canPost, clientId, editing, getToken, me, qc, router, saveEdit, trimmed]);

  const mention = activeMentionQuery(text, caret);
  const { results, loading } = useMentionSearch(mention ? mention.query : null);
  const pickMention = useCallback(
    (u: CommunityAuthor) => {
      if (!mention) return;
      const next = `${text.slice(0, mention.start)}@${u.username} ${text.slice(caret)}`;
      setText(next);
      const pos = mention.start + u.username.length + 2;
      setCaret(pos);
      requestAnimationFrame(() => inputRef.current?.setNativeProps({ selection: { start: pos, end: pos } }));
    },
    [caret, mention, text],
  );

  const previewW = Math.min(width, 640) - 40;
  const previewSource = draft?.local.uri ?? (hasRemoteImage ? existing!.image!.url : null);
  const ratio = draft
    ? Math.min(1.25, Math.max(0.5, draft.local.height / Math.max(1, draft.local.width)))
    : hasRemoteImage && existing?.image
      ? Math.min(1.25, Math.max(0.5, existing.image.height / Math.max(1, existing.image.width)))
      : 1;
  const previewH = Math.round(previewW * ratio);
  const left = MAX_LEN - text.length;
  const textAlign = text ? (isArabicText(text) ? 'right' : 'left') : isAr ? 'right' : 'left';
  const name = me.displayName || me.username;
  const title = editing ? s.editPostTitle : s.composerTitle;
  const cta = editing ? s.save : s.post;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={[styles.topBar, { flexDirection: isAr ? 'row-reverse' : 'row' }]}>
        <Pressable
          onPress={confirmLeave}
          style={styles.cancelBtn}
          accessibilityRole="button"
          accessibilityLabel={s.cancel}
        >
          <Text style={[styles.cancelText, { fontFamily: fonts.semibold }]}>{s.cancel}</Text>
        </Pressable>
        <Text style={[styles.title, { fontFamily: fonts.semibold }]} numberOfLines={1}>
          {title}
        </Text>
        <Pressable
          onPress={post}
          disabled={!canPost}
          style={[styles.postBtnWrap, !canPost && styles.postBtnDisabled]}
          accessibilityRole="button"
        >
          <LinearGradient
            colors={canPost ? ['#A78BFA', '#7C3AED'] : ['#3B2A63', '#2A1D4A']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.postBtn}
          >
            {saving ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Text style={[styles.postText, { fontFamily: fonts.semibold }]}>{cta}</Text>
            )}
          </LinearGradient>
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        <View style={[styles.authorRow, { flexDirection: isAr ? 'row-reverse' : 'row' }]}>
          <CommunityAvatar uri={me.avatar} name={name} size={44} />
          <Text style={[styles.author, { fontFamily: fonts.semibold }]} numberOfLines={1}>
            {name}
          </Text>
        </View>

        <TextInput
          ref={inputRef}
          value={text}
          onChangeText={setText}
          onSelectionChange={(e) => setCaret(e.nativeEvent.selection.end)}
          placeholder={s.composerPlaceholder}
          placeholderTextColor={C.placeholder}
          multiline
          scrollEnabled={false}
          maxLength={MAX_LEN + 50}
          selectionColor={C.accent}
          style={[styles.input, { fontFamily: fonts.medium, textAlign }]}
        />

        {previewSource && (
          <Animated.View entering={FadeIn.duration(180)} style={[styles.preview, { width: previewW, height: previewH }]}>
            <Image source={{ uri: previewSource }} style={StyleSheet.absoluteFill} contentFit="cover" transition={120} />
            {draft?.status === 'uploading' && (
              <View style={styles.previewShade}>
                <ActivityIndicator color="#FFF" />
                <Text style={[styles.previewLabel, { fontFamily: fonts.medium }]}>
                  {s.uploadingImage} {Math.round(draft.progress * 100)}%
                </Text>
              </View>
            )}
            {draft?.status === 'failed' && (
              <Pressable
                style={styles.previewShade}
                onPress={() => startImageUpload(getToken, clientId, draft.local)}
                accessibilityRole="button"
              >
                <RotateCcw size={26} color="#FFF" />
                <Text style={[styles.previewLabel, { fontFamily: fonts.medium }]}>{communityErrorMessage(draft.error, s)}</Text>
                <Text style={[styles.previewRetry, { fontFamily: fonts.semibold }]}>{s.retry}</Text>
              </Pressable>
            )}
            {draft && draft.status !== 'failed' && <UploadBar progress={draft.status === 'done' ? 1 : draft.progress} />}
            <Pressable
              onPress={() => {
                cancelImageUpload(clientId);
                setKeepRemoteImage(false);
              }}
              hitSlop={8}
              style={styles.removeImage}
              accessibilityRole="button"
              accessibilityLabel={s.removePhoto}
            >
              <X size={18} color="#FFF" />
            </Pressable>
          </Animated.View>
        )}
      </ScrollView>

      <KeyboardDock bottomInset={insets.bottom} style={{ paddingBottom: insets.bottom }}>
        {mention && (
          <View style={{ paddingHorizontal: 16 }}>
            <MentionSuggestions users={results} loading={loading} emptyLabel={s.noUsersFound} fontFamily={fonts.regular} onPick={pickMention} />
          </View>
        )}
        <View style={[styles.toolbar, { flexDirection: isAr ? 'row-reverse' : 'row' }]}>
          <View style={[styles.tools, { flexDirection: isAr ? 'row-reverse' : 'row' }]}>
            <Pressable onPress={() => void pickImage()} style={styles.tool} accessibilityRole="button" accessibilityLabel={s.addPhoto}>
              <Image source={CI.image} style={styles.toolIcon} contentFit="contain" />
              <Text style={[styles.toolText, { fontFamily: fonts.medium }]}>{s.addPhoto}</Text>
            </Pressable>
            <Pressable onPress={() => applyInsert('#')} style={styles.tool} accessibilityRole="button" accessibilityLabel={s.hashtagTool}>
              <View style={styles.toolGlyph}>
                <Hash size={18} color={C.accentSoft} strokeWidth={2.4} />
              </View>
              <Text style={[styles.toolText, { fontFamily: fonts.medium }]}>{s.hashtagTool}</Text>
            </Pressable>
            <Pressable onPress={() => applyInsert('@')} style={styles.tool} accessibilityRole="button" accessibilityLabel={s.mentionTool}>
              <View style={styles.toolGlyph}>
                <AtSign size={18} color={C.accentSoft} strokeWidth={2.4} />
              </View>
              <Text style={[styles.toolText, { fontFamily: fonts.medium }]}>{s.mentionTool}</Text>
            </Pressable>
          </View>
          {left <= WARN_AT && (
            <Text style={[styles.counter, { fontFamily: fonts.semibold }, left < 0 && { color: C.danger }]}>
              {fillTemplate(s.charsLeft, { n: left })}
            </Text>
          )}
        </View>
      </KeyboardDock>

      <ConfirmSheet
        visible={discardOpen}
        title={s.discardTitle}
        body={s.discardBody}
        confirmLabel={s.discard}
        cancelLabel={s.keepEditing}
        fontFamily={fonts.semibold}
        onConfirm={leave}
        onClose={() => setDiscardOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.screen,
  },
  topBar: {
    height: 58,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    backgroundColor: C.header,
    gap: 10,
  },
  cancelBtn: {
    minWidth: 78,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  cancelText: {
    color: C.text,
    fontSize: 14,
    fontWeight: '600',
  },
  title: {
    flex: 1,
    color: C.textStrong,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  postBtnWrap: {
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: C.accent,
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  postBtnDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  postBtn: {
    minWidth: 84,
    height: 36,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  body: {
    padding: 20,
    gap: 16,
    alignItems: 'stretch',
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
  },
  authorRow: {
    alignItems: 'center',
    gap: 12,
  },
  author: {
    color: C.textStrong,
    fontSize: 16,
    fontWeight: '600',
    flexShrink: 1,
  },
  input: {
    color: C.text,
    fontSize: 18,
    lineHeight: 26,
    minHeight: 120,
    textAlignVertical: 'top',
    padding: 0,
  },
  preview: {
    borderRadius: POST_IMAGE_RADIUS,
    overflow: 'hidden',
    backgroundColor: '#15111F',
    alignSelf: 'center',
  },
  previewShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
  },
  previewLabel: {
    color: '#FFF',
    fontSize: 13,
    textAlign: 'center',
  },
  previewRetry: {
    color: C.accentSoft,
    fontSize: 14,
    fontWeight: '600',
  },
  removeImage: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  barTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  barFill: {
    height: 4,
    backgroundColor: C.accent,
  },
  toolbar: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.inputBorder,
    backgroundColor: C.composer,
    gap: 10,
  },
  tools: {
    flex: 1,
    alignItems: 'center',
    gap: 18,
  },
  tool: {
    alignItems: 'center',
    gap: 6,
    minWidth: 54,
  },
  toolGlyph: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(183,154,248,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(183,154,248,0.28)',
  },
  toolIcon: { width: 24, height: 24 },
  toolText: {
    color: C.accentSoft,
    fontSize: 12,
    fontWeight: '600',
  },
  counter: {
    color: C.counter,
    fontSize: 13,
  },
});
