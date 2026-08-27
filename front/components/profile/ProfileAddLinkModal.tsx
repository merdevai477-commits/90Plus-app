import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from '../../src/i18n';
import { runSafeModalClose } from '../../utils/safeModalClose';
import {
  detectSocialPlatformFromUrl,
  normalizePastedUrl,
  type SocialPlatformId,
} from '../../src/utils/socialPlatformDetect';
import { PROFILE_ICONS } from './profileV2Assets';
import { getSocialBrandIcon, socialPlatformLabel } from './socialBrandIcons';

const CARD_WIDTH = Math.min(404, Dimensions.get('window').width - 32);
const INNER_WIDTH = Math.min(337, CARD_WIDTH - 48);

export function ProfileAddLinkModal({
  visible,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (url: string, platform: SocialPlatformId) => void;
}) {
  const { t } = useTranslation();
  const [url, setUrl] = useState('');

  useEffect(() => {
    if (visible) setUrl('');
  }, [visible]);

  const detected = useMemo(() => detectSocialPlatformFromUrl(url), [url]);
  const brand = detected ? getSocialBrandIcon(detected) : null;
  const hasText = url.trim().length > 0;

  const safeClose = useCallback(() => {
    runSafeModalClose(onClose);
  }, [onClose]);

  const handleDone = useCallback(() => {
    const normalized = normalizePastedUrl(url);
    const platform = detectSocialPlatformFromUrl(url);
    if (!normalized || !platform) {
      return;
    }
    onSubmit(normalized, platform);
    safeClose();
  }, [onSubmit, safeClose, url]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={safeClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={safeClose} />
        <View style={styles.card}>
          <View style={styles.header}>
            <Pressable
              onPress={safeClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t.common.close}
              style={styles.closeHit}
            >
              <Ionicons name="close" size={24} color="#fff" />
            </Pressable>
            <Text style={styles.title}>{t.profile.pasteLink}</Text>
          </View>

          <Text style={styles.hint}>{t.profile.pasteLinkHint}</Text>

          <View style={styles.inputShell}>
            <LinearGradient
              colors={['#07040D', '#0C051A']}
              start={{ x: 0.5, y: 1 }}
              end={{ x: 0.5, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
            {brand ? (
              <Image source={brand.source} style={[styles.brandIcon, { width: brand.width, height: brand.height }]} contentFit="contain" />
            ) : (
              <Image source={PROFILE_ICONS.link} style={styles.linkIcon} contentFit="contain" />
            )}
            <TextInput
              value={url}
              onChangeText={setUrl}
              placeholder={t.profile.pasteLinkHere}
              placeholderTextColor="#9A9A9A"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="done"
              onSubmitEditing={handleDone}
              style={styles.input}
            />
          </View>

          {hasText && detected && detected !== 'website' ? (
            <Text style={styles.detected}>
              {t.profile.linkRecognized.replace('{platform}', socialPlatformLabel(t, detected))}
            </Text>
          ) : hasText && detected === 'website' ? (
            <Text style={styles.detectedMuted}>{t.profile.unrecognizedLink}</Text>
          ) : hasText ? (
            <Text style={styles.detectedMuted}>{t.profile.invalidLink}</Text>
          ) : (
            <View style={styles.detectedSpacer} />
          )}

          <Pressable
            onPress={handleDone}
            disabled={!detected}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.doneBtn,
              pressed && { opacity: 0.9 },
              !detected && { opacity: 0.45 },
            ]}
          >
            <LinearGradient
              colors={['#3D0AB3', '#190448']}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Text style={styles.doneLabel}>{t.profile.done}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  card: {
    width: CARD_WIDTH,
    borderRadius: 26,
    backgroundColor: '#07040D',
    paddingTop: 28,
    paddingBottom: 28,
    paddingHorizontal: 24,
    shadowColor: '#7809E3',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.68,
    shadowRadius: 13,
    elevation: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    direction: 'ltr',
    marginBottom: 10,
  },
  closeHit: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'right',
  },
  hint: {
    color: '#B7B7B7',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'right',
    marginBottom: 16,
  },
  inputShell: {
    width: INNER_WIDTH,
    height: 73,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: '#2B2638',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 12,
    alignSelf: 'center',
  },
  linkIcon: {
    width: 24,
    height: 24,
  },
  brandIcon: {
    width: 28,
    height: 28,
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    paddingVertical: 0,
  },
  detected: {
    marginTop: 10,
    color: '#C4B5FD',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
  },
  detectedMuted: {
    marginTop: 10,
    color: '#8C8C8C',
    fontSize: 12,
    textAlign: 'right',
  },
  detectedSpacer: {
    height: 22,
  },
  doneBtn: {
    width: INNER_WIDTH,
    alignSelf: 'center',
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 21,
    marginTop: 16,
  },
  doneLabel: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    width: '100%',
  },
});
