/**
 * Full-screen create-group form (Figma 471:1927) — avatar, name, description,
 * member search/queue (no privacy / max-members). Invites fire after create.
 */

import { useAuth } from '@clerk/clerk-expo';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getApiUrl } from '../../config/api.config';
import { useImagePicker } from '../../hooks/useImagePicker';
import { useToast } from '../../contexts/ToastContext';
import { useTranslation } from '../../src/i18n';
import type { SearchUserResult } from '../../src/services/authService';
import { GroupImageSourceSheet } from './GroupImageSourceSheet';
import { PG, PG_GRADIENTS, usePGFonts } from './theme';

const DESC_MAX = 120;
const API_URL = getApiUrl();
const PLACEHOLDER = require('../../assets/images/plear 90Plus.jpg');
const ICON_CAMERA = require('../../assets/images/prediction-groups/icon-camera.svg');
const ICON_EDIT = require('../../assets/images/prediction-groups/icon-edit.svg');
const ICON_SEARCH = require('../../assets/images/prediction-groups/icon-search.svg');

const FIELD_BORDER = '#262626';
const PLACEHOLDER_COLOR = '#5D5D5D';

export function GroupCreateScreen({
  visible,
  isRTL,
  busy,
  onClose,
  onCreate,
}: {
  visible: boolean;
  isRTL: boolean;
  busy?: boolean;
  onClose: () => void;
  onCreate: (
    name: string,
    localImageUri: string | null,
    inviteeIds: string[],
  ) => Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  const { medium, bold } = usePGFonts();
  const { t, direction } = useTranslation();
  const ob = t.predictionGroups.onboarding;
  const form = t.predictionGroups.createForm;
  const toast = useToast();
  const { getToken } = useAuth();
  const { pickFromGallery, pickFromCamera } = useImagePicker();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageSourceOpen, setImageSourceOpen] = useState(false);
  const [pickerActive, setPickerActive] = useState(false);
  const [query, setQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [results, setResults] = useState<SearchUserResult[]>([]);
  const [queued, setQueued] = useState<SearchUserResult[]>([]);

  const row: ViewStyle = { flexDirection: isRTL ? 'row-reverse' : 'row' };
  const align = isRTL ? ('right' as const) : ('left' as const);
  const writingDirection = direction;
  const BackIcon = isRTL ? ChevronRight : ChevronLeft;
  const queuedIds = useMemo(() => new Set(queued.map((u) => u.id)), [queued]);

  useEffect(() => {
    if (visible) {
      setName('');
      setDescription('');
      setImageUri(null);
      setImageSourceOpen(false);
      setQuery('');
      setResults([]);
      setQueued([]);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearchLoading(false);
      return;
    }
    let cancelled = false;
    setSearchLoading(true);
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const token = await getToken();
          if (cancelled || !token) {
            if (!cancelled) {
              setResults([]);
              setSearchLoading(false);
            }
            return;
          }
          const url = `${API_URL}/clerk/search?q=${encodeURIComponent(q)}&limit=20`;
          const res = await fetch(url, {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          });
          const data = await res.json().catch(() => null);
          if (cancelled) return;
          if (!res.ok || data?.status !== 'SUCCESS') {
            setResults([]);
            return;
          }
          setResults((data.data?.users ?? []) as SearchUserResult[]);
        } catch {
          if (!cancelled) setResults([]);
        } finally {
          if (!cancelled) setSearchLoading(false);
        }
      })();
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [getToken, query, visible]);

  const pickImage = useCallback(
    async (source: 'gallery' | 'camera') => {
      setPickerActive(true);
      await new Promise((resolve) => setTimeout(resolve, Platform.OS === 'ios' ? 400 : 250));
      try {
        const result =
          source === 'gallery'
            ? await pickFromGallery({ type: 'avatar', allowsEditing: true, aspect: [1, 1] })
            : await pickFromCamera({ type: 'avatar', allowsEditing: true, aspect: [1, 1] });
        if (result?.uri) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          setImageUri(result.uri);
        }
      } finally {
        setPickerActive(false);
      }
    },
    [pickFromCamera, pickFromGallery],
  );

  const addInvitee = useCallback((user: SearchUserResult) => {
    setQueued((prev) => (prev.some((u) => u.id === user.id) ? prev : [...prev, user]));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  const removeInvitee = useCallback((userId: string) => {
    setQueued((prev) => prev.filter((u) => u.id !== userId));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (name.trim().length < 2) {
      toast.showError(ob.nameError, ob.nameRequired);
      return;
    }
    try {
      await onCreate(
        name.trim(),
        imageUri,
        queued.map((u) => u.id),
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e: any) {
      toast.showError(ob.createFailed, e?.message ?? ob.tryAgain);
    }
  }, [imageUri, name, ob, onCreate, queued, toast]);

  return (
    <Modal
      visible={visible && !pickerActive}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={[styles.root, { paddingTop: insets.top + 6 }]}>
        <View style={[styles.header, row]}>
          <Pressable onPress={onClose} hitSlop={8} style={styles.backBtn}>
            <BackIcon size={22} color="#fff" />
          </Pressable>
          <Text style={[styles.headerTitle, { fontFamily: bold, writingDirection }]}>
            {form.title}
          </Text>
          <View style={styles.backBtn} />
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 28 }]}
            keyboardShouldPersistTaps="handled"
          >
            <Pressable onPress={() => setImageSourceOpen(true)} style={styles.avatarWrap}>
              <LinearGradient
                colors={['#4A078A', '#130224']}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.avatar}
              >
                {imageUri ? (
                  <Image source={{ uri: imageUri }} style={styles.avatarImg} contentFit="cover" />
                ) : (
                  <Image
                    source={ICON_CAMERA}
                    style={styles.cameraIcon}
                    contentFit="contain"
                    transition={0}
                  />
                )}
              </LinearGradient>
            </Pressable>

            <Text style={[styles.label, { fontFamily: bold, textAlign: align, writingDirection }]}>
              {ob.groupName}
            </Text>
            <View style={[styles.field, row]}>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder={ob.groupNamePlaceholder}
                placeholderTextColor={PLACEHOLDER_COLOR}
                maxLength={40}
                style={[styles.input, { fontFamily: medium, textAlign: align, writingDirection }]}
              />
            </View>

            <Text style={[styles.label, { fontFamily: bold, textAlign: align, writingDirection }]}>
              {form.description}
            </Text>
            <View style={[styles.field, styles.area, row]}>
              <TextInput
                value={description}
                onChangeText={(v) => setDescription(v.slice(0, DESC_MAX))}
                placeholder={form.descriptionPlaceholder}
                placeholderTextColor={PLACEHOLDER_COLOR}
                multiline
                maxLength={DESC_MAX}
                style={[
                  styles.input,
                  styles.areaInput,
                  { fontFamily: medium, textAlign: align, writingDirection },
                ]}
              />
              <Image source={ICON_EDIT} style={styles.fieldIcon} contentFit="contain" transition={0} />
            </View>
            <Text
              style={[
                styles.counter,
                {
                  fontFamily: medium,
                  alignSelf: isRTL ? 'flex-start' : 'flex-end',
                  writingDirection,
                },
              ]}
            >
              {description.length}/{DESC_MAX}
            </Text>

            <Text style={[styles.label, { fontFamily: bold, textAlign: align, writingDirection }]}>
              {form.addMembers}
            </Text>
            <View style={[styles.field, row]}>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={form.searchMembers}
                placeholderTextColor={PLACEHOLDER_COLOR}
                style={[styles.input, { fontFamily: medium, textAlign: align, writingDirection }]}
              />
              {searchLoading ? (
                <ActivityIndicator color={PG.primaryLight} size="small" />
              ) : (
                <Image
                  source={ICON_SEARCH}
                  style={styles.fieldIcon}
                  contentFit="contain"
                  transition={0}
                />
              )}
            </View>

            {queued.length > 0 ? (
              <View style={styles.queuedList}>
                {queued.map((u) => (
                  <View key={u.id} style={[styles.userRow, row]}>
                    <Image
                      source={u.avatar ? { uri: u.avatar } : PLACEHOLDER}
                      style={styles.userAvatar}
                      contentFit="cover"
                    />
                    <Text
                      style={[
                        styles.userName,
                        { fontFamily: medium, textAlign: align, writingDirection, flex: 1 },
                      ]}
                      numberOfLines={1}
                    >
                      {u.displayName || u.username}
                    </Text>
                    <Pressable onPress={() => removeInvitee(u.id)} hitSlop={8}>
                      <Text style={[styles.addedChip, { fontFamily: medium }]}>{form.added}</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}

            {query.trim().length >= 2 ? (
              <View style={styles.results}>
                {results.length === 0 && !searchLoading ? (
                  <Text
                    style={[
                      styles.emptySearch,
                      { fontFamily: medium, textAlign: align, writingDirection },
                    ]}
                  >
                    {form.emptySearch}
                  </Text>
                ) : (
                  results.map((u) => {
                    const already = queuedIds.has(u.id);
                    return (
                      <View key={u.id} style={[styles.userRow, row]}>
                        <Image
                          source={u.avatar ? { uri: u.avatar } : PLACEHOLDER}
                          style={styles.userAvatar}
                          contentFit="cover"
                        />
                        <Text
                          style={[
                            styles.userName,
                            { fontFamily: medium, textAlign: align, writingDirection, flex: 1 },
                          ]}
                          numberOfLines={1}
                        >
                          {u.displayName || u.username}
                        </Text>
                        {already ? (
                          <Text style={[styles.addedChip, { fontFamily: medium }]}>{form.added}</Text>
                        ) : (
                          <Pressable
                            onPress={() => addInvitee(u)}
                            style={styles.addBtn}
                            accessibilityRole="button"
                          >
                            <Text style={[styles.addBtnTxt, { fontFamily: bold }]}>{form.add}</Text>
                          </Pressable>
                        )}
                      </View>
                    );
                  })
                )}
              </View>
            ) : null}

            <Pressable
              disabled={busy}
              onPress={() => void handleSubmit()}
              style={{ marginTop: 20 }}
            >
              <LinearGradient
                colors={[...PG_GRADIENTS.purple]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.submit}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={[styles.submitTxt, { fontFamily: bold, writingDirection }]}>
                    {form.submit}
                  </Text>
                )}
              </LinearGradient>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>

        <GroupImageSourceSheet
          visible={imageSourceOpen}
          hasImage={Boolean(imageUri)}
          isRTL={isRTL}
          embedded
          onClose={() => setImageSourceOpen(false)}
          onPickGallery={() => {
            setImageSourceOpen(false);
            void pickImage('gallery');
          }}
          onPickCamera={() => {
            setImageSourceOpen(false);
            void pickImage('camera');
          }}
          onRemoveImage={() => setImageUri(null)}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#030303' },
  header: { alignItems: 'center', paddingHorizontal: 12, minHeight: 48 },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, color: '#fff', fontSize: 20, textAlign: 'center' },
  body: { paddingHorizontal: 22, paddingTop: 12, gap: 10 },
  avatarWrap: {
    alignSelf: 'center',
    marginBottom: 16,
    shadowColor: 'rgba(99,50,145,0.89)',
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 1,
    shadowRadius: 18,
    elevation: 12,
  },
  avatar: {
    width: 126,
    height: 126,
    borderRadius: 63,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#8A38D8',
  },
  avatarImg: { width: '100%', height: '100%' },
  cameraIcon: { width: 50, height: 44 },
  label: { color: '#fff', fontSize: 11, marginTop: 8 },
  field: {
    alignItems: 'center',
    gap: 10,
    height: 58,
    paddingHorizontal: 24,
    borderRadius: 16,
    backgroundColor: '#030303',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: FIELD_BORDER,
  },
  area: { height: 86, alignItems: 'flex-start', paddingVertical: 16 },
  input: { flex: 1, color: PG.text, fontSize: 16, paddingVertical: 10 },
  areaInput: { minHeight: 50, textAlignVertical: 'top' },
  fieldIcon: { width: 24, height: 24 },
  counter: { color: '#797979', fontSize: 11, marginTop: -4 },
  queuedList: { gap: 8, marginTop: 4 },
  results: { gap: 8, marginTop: 4 },
  userRow: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(12,5,26,0.8)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#53198A',
  },
  userAvatar: { width: 36, height: 36, borderRadius: 18 },
  userName: { color: '#fff', fontSize: 14 },
  addBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(61,10,179,0.55)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#53198A',
  },
  addBtnTxt: { color: '#fff', fontSize: 12 },
  addedChip: { color: PG.primaryLight, fontSize: 12 },
  emptySearch: { color: PLACEHOLDER_COLOR, fontSize: 13, paddingVertical: 8 },
  submit: {
    borderRadius: 16,
    minHeight: 66,
    paddingVertical: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitTxt: { color: '#fff', fontSize: 18 },
});
