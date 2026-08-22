/**
 * Full-screen create-group form (photo, name, optional description, private type).
 */

import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import {
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Lock,
  Pencil,
  Users,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
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

import { useImagePicker } from '../../hooks/useImagePicker';
import { useToast } from '../../contexts/ToastContext';
import { useTranslation } from '../../src/i18n';
import { GroupImageSourceSheet } from './GroupImageSourceSheet';
import { PG, PG_GRADIENTS, PG_GLOW_PURPLE, PG_RADII, usePGFonts } from './theme';

const DESC_MAX = 120;

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
  onCreate: (name: string, localImageUri: string | null) => Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  const { medium, bold, extra } = usePGFonts();
  const { t } = useTranslation();
  const ob = t.predictionGroups.onboarding;
  const form = t.predictionGroups.createForm;
  const toast = useToast();
  const { pickFromGallery, pickFromCamera } = useImagePicker();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageSourceOpen, setImageSourceOpen] = useState(false);
  const [pickerActive, setPickerActive] = useState(false);

  const row: ViewStyle = { flexDirection: isRTL ? 'row-reverse' : 'row' };
  const align = isRTL ? 'right' : 'left';
  const BackIcon = isRTL ? ChevronRight : ChevronLeft;

  useEffect(() => {
    if (visible) {
      setName('');
      setDescription('');
      setImageUri(null);
      setImageSourceOpen(false);
    }
  }, [visible]);

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

  const handleSubmit = useCallback(async () => {
    if (name.trim().length < 2) {
      toast.showError(ob.nameError, ob.nameRequired);
      return;
    }
    try {
      await onCreate(name.trim(), imageUri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e: any) {
      toast.showError(ob.createFailed, e?.message ?? ob.tryAgain);
    }
  }, [imageUri, name, ob, onCreate, toast]);

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
          <Text style={[styles.headerTitle, { fontFamily: extra }]}>{form.title}</Text>
          <View style={styles.backBtn} />
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}
            keyboardShouldPersistTaps="handled"
          >
            <Pressable onPress={() => setImageSourceOpen(true)} style={styles.avatarWrap}>
              <LinearGradient colors={PG_GRADIENTS.purple} style={styles.avatar}>
                {imageUri ? (
                  <Image source={{ uri: imageUri }} style={styles.avatarImg} contentFit="cover" />
                ) : (
                  <Camera size={32} color={PG.primaryLight} />
                )}
              </LinearGradient>
            </Pressable>

            <Text style={[styles.label, { fontFamily: medium, textAlign: align }]}>{ob.groupName}</Text>
            <View style={[styles.field, row]}>
              <Users size={18} color={PG.textMuted} />
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder={ob.groupNamePlaceholder}
                placeholderTextColor={PG.textMuted}
                maxLength={40}
                style={[styles.input, { fontFamily: medium, textAlign: align }]}
              />
            </View>

            <Text style={[styles.label, { fontFamily: medium, textAlign: align }]}>{form.description}</Text>
            <View style={[styles.field, styles.area, row]}>
              <Pencil size={18} color={PG.textMuted} style={{ marginTop: 2 }} />
              <TextInput
                value={description}
                onChangeText={(v) => setDescription(v.slice(0, DESC_MAX))}
                placeholder={form.descriptionPlaceholder}
                placeholderTextColor={PG.textMuted}
                multiline
                maxLength={DESC_MAX}
                style={[styles.input, styles.areaInput, { fontFamily: medium, textAlign: align }]}
              />
            </View>
            <Text style={[styles.counter, { fontFamily: medium }]}>
              {description.length}/{DESC_MAX}
            </Text>

            <Text style={[styles.label, { fontFamily: medium, textAlign: align }]}>{form.type}</Text>
            <View style={[styles.field, row]}>
              <Lock size={18} color={PG.primaryLight} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldTitle, { fontFamily: bold, textAlign: align }]}>{form.typePrivate}</Text>
                <Text style={[styles.fieldHint, { fontFamily: medium, textAlign: align }]}>{form.typePrivateHint}</Text>
              </View>
              <ChevronDown size={18} color={PG.textMuted} />
            </View>

            <Text style={[styles.label, { fontFamily: medium, textAlign: align }]}>{form.maxMembers}</Text>
            <View style={[styles.field, row]}>
              <Users size={18} color={PG.primaryLight} />
              <Text style={[styles.fieldTitle, { fontFamily: bold, flex: 1, textAlign: align }]}>
                {form.maxMembersValue}
              </Text>
              <ChevronDown size={18} color={PG.textMuted} />
            </View>

            <Pressable disabled={busy} onPress={() => void handleSubmit()} style={{ marginTop: 16 }}>
              <LinearGradient colors={[...PG_GRADIENTS.purple]} style={styles.submit}>
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={[styles.submitTxt, { fontFamily: bold }]}>{form.submit}</Text>
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
  root: { flex: 1, backgroundColor: PG.bg },
  header: { alignItems: 'center', paddingHorizontal: 12, minHeight: 48 },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, color: PG.text, fontSize: 18, textAlign: 'center' },
  body: { paddingHorizontal: 20, paddingTop: 12, gap: 8 },
  avatarWrap: { alignSelf: 'center', marginBottom: 12, ...PG_GLOW_PURPLE },
  avatar: {
    width: 108,
    height: 108,
    borderRadius: 54,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  label: { color: PG.text, fontSize: 13, marginTop: 10 },
  field: {
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 14,
    borderRadius: PG_RADII.md,
    backgroundColor: PG.cardElevated,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  area: { alignItems: 'flex-start', minHeight: 96, paddingVertical: 12 },
  input: { flex: 1, color: PG.text, fontSize: 14, paddingVertical: 12 },
  areaInput: { minHeight: 72, textAlignVertical: 'top' },
  counter: { color: PG.textMuted, fontSize: 11, alignSelf: 'flex-start' },
  fieldTitle: { color: PG.text, fontSize: 14 },
  fieldHint: { color: PG.textMuted, fontSize: 11, marginTop: 2 },
  submit: {
    borderRadius: PG_RADII.xl,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    ...PG_GLOW_PURPLE,
  },
  submitTxt: { color: '#fff', fontSize: 16 },
});
