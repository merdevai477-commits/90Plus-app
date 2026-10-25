import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { RotateCcw, X } from 'lucide-react-native';

import { CommunityAvatar } from '../../components/community/CommunityAvatar';
import { KeyboardDock } from '../../components/community/KeyboardDock';
import { MentionSuggestions } from '../../components/community/MentionSuggestions';
import { Tap } from '../../components/community/Tap';
import { activeMentionQuery, isArabicText } from '../../components/community/richTextParse';
import { communityErrorMessage, fillTemplate } from '../../components/community/format';
import { C, CI, POST_IMAGE_RADIUS } from '../../components/community/theme';
import {
  cancelImageUpload,
  newClientId,
  publishPost,
  startImageUpload,
  usePublishStore,
} from '../../hooks/community/publishQueue';
import { useCommunityMe } from '../../hooks/community/useCommunityMe';
import { useCommunityToken } from '../../hooks/community/useCommunityFeed';
import { useMentionSearch } from '../../hooks/community/useMentionSearch';
import type { CommunityAuthor } from '../../services/community.api';
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
  const params = useLocalSearchParams<{ restore?: string; photo?: string }>();

  const [clientId] = useState(() => {
    const restoring = params.restore && usePublishStore.getState().pending.find((p) => p.clientId === params.restore);
    return restoring ? restoring.clientId : newClientId();
  });
  const [text, setText] = useState(() => {
    const p = usePublishStore.getState().pending.find((x) => x.clientId === params.restore);
    return p?.content ?? '';
  });
  const [caret, setCaret] = useState(0);
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

  const trimmed = text.trim();
  const hasContent = trimmed.length > 0 || !!draft;
  const overLimit = text.length > MAX_LEN;
  const canPost = hasContent && !overLimit;

  const leave = useCallback(() => {
    if (!published.current) cancelImageUpload(clientId);
    router.back();
  }, [clientId, router]);

  const confirmLeave = useCallback(() => {
    if (!hasContent) {
      leave();
      return true;
    }
    Alert.alert(s.discardTitle, s.discardBody, [
      { text: s.keepEditing, style: 'cancel' },
      { text: s.discard, style: 'destructive', onPress: leave },
    ]);
    return true;
  }, [hasContent, leave, s]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', confirmLeave);
    return () => sub.remove();
  }, [confirmLeave]);

  const post = useCallback(() => {
    if (!canPost) return;
    published.current = true;
    publishPost({ getToken, queryClient: qc, clientId, content: trimmed, author: me });
    router.back();
  }, [canPost, clientId, getToken, me, qc, router, trimmed]);

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
  const ratio = draft ? Math.min(1.25, Math.max(0.5, draft.local.height / Math.max(1, draft.local.width))) : 1;
  const previewH = Math.round(previewW * ratio);
  const left = MAX_LEN - text.length;
  const textAlign = text ? (isArabicText(text) ? 'right' : 'left') : isAr ? 'right' : 'left';
  const name = me.displayName || me.username;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={[styles.topBar, { flexDirection: isAr ? 'row-reverse' : 'row' }]}>
        <Pressable onPress={confirmLeave} hitSlop={10} style={styles.close} accessibilityRole="button" accessibilityLabel={s.cancel}>
          <X size={24} color={C.textStrong} />
        </Pressable>
        <Text style={[styles.title, { fontFamily: fonts.semibold }]}>{s.composerTitle}</Text>
        <Tap
          onPress={post}
          disabled={!canPost}
          style={[styles.postBtn, !canPost && styles.postBtnDisabled]}
          pressedStyle={{ opacity: 0.85 }}
          accessibilityRole="button"
        >
          <Text style={[styles.postText, { fontFamily: fonts.semibold }]}>{s.post}</Text>
        </Tap>
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

        {draft && (
          <Animated.View entering={FadeIn.duration(180)} style={[styles.preview, { width: previewW, height: previewH }]}>
            <Image source={{ uri: draft.local.uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={120} />
            {draft.status === 'uploading' && (
              <View style={styles.previewShade}>
                <ActivityIndicator color="#FFF" />
                <Text style={[styles.previewLabel, { fontFamily: fonts.medium }]}>
                  {s.uploadingImage} {Math.round(draft.progress * 100)}%
                </Text>
              </View>
            )}
            {draft.status === 'failed' && (
              <Pressable
                style={styles.previewShade}
                onPress={() => startImageUpload(getToken, clientId, draft.local)}
                accessibilityRole="button"
              >
                <RotateCcw size={26} color="#FFF" />
                <Text style={[styles.previewLabel, { fontFamily: fonts.medium }]}>
                  {communityErrorMessage(draft.error, s)}
                </Text>
                <Text style={[styles.previewRetry, { fontFamily: fonts.semibold }]}>{s.retry}</Text>
              </Pressable>
            )}
            {draft.status !== 'failed' && <UploadBar progress={draft.status === 'done' ? 1 : draft.progress} />}
            <Pressable
              onPress={() => cancelImageUpload(clientId)}
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
          <Tap
            onPress={() => void pickImage()}
            style={[styles.tool, { flexDirection: isAr ? 'row-reverse' : 'row' }]}
            accessibilityRole="button"
          >
            <Image source={CI.image} style={{ width: 24, height: 24 }} contentFit="contain" />
            <Text style={[styles.toolText, { fontFamily: fonts.medium }]}>{s.addPhoto}</Text>
          </Tap>
          {left <= WARN_AT && (
            <Text style={[styles.counter, { fontFamily: fonts.semibold }, left < 0 && { color: C.danger }]}>
              {fillTemplate(s.charsLeft, { n: left })}
            </Text>
          )}
        </View>
      </KeyboardDock>
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
    paddingHorizontal: 16,
    backgroundColor: C.header,
  },
  close: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: C.textStrong,
    fontSize: 18,
    fontWeight: '600',
  },
  postBtn: {
    minWidth: 72,
    height: 36,
    paddingHorizontal: 18,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.accent,
  },
  postBtnDisabled: {
    backgroundColor: C.accentDeep,
    opacity: 0.55,
  },
  postText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
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
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.inputBorder,
    backgroundColor: C.composer,
  },
  tool: {
    alignItems: 'center',
    gap: 8,
  },
  toolText: {
    color: C.accentSoft,
    fontSize: 14,
  },
  counter: {
    color: C.counter,
    fontSize: 13,
  },
});
