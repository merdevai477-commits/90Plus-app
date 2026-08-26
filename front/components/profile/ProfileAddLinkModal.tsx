import React, { useCallback, useEffect, useState } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from '../../src/i18n';
import { runSafeModalClose } from '../../utils/safeModalClose';
import { PROFILE_ICONS } from './profileV2Assets';

const CARD_WIDTH = Math.min(404, Dimensions.get('window').width - 32);
const INNER_WIDTH = Math.min(337, CARD_WIDTH - 66);

export function ProfileAddLinkModal({
  visible,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (url: string) => void;
}) {
  const { t } = useTranslation();
  const [url, setUrl] = useState('');

  useEffect(() => {
    if (visible) setUrl('');
  }, [visible]);

  const safeClose = useCallback(() => {
    runSafeModalClose(onClose);
  }, [onClose]);

  const handleDone = useCallback(() => {
    const trimmed = url.trim();
    if (trimmed) onSubmit(trimmed);
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
              <Image source={PROFILE_ICONS.close} style={styles.closeIcon} contentFit="contain" />
            </Pressable>
            <Text style={styles.title}>{t.profile.pasteLink}</Text>
          </View>

          <View style={styles.inputShell}>
            <LinearGradient
              colors={['#07040D', '#0C051A']}
              start={{ x: 0.5, y: 1 }}
              end={{ x: 0.5, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
            <Image source={PROFILE_ICONS.link} style={styles.linkIcon} contentFit="contain" />
            <TextInput
              value={url}
              onChangeText={setUrl}
              placeholder={t.profile.pasteLinkHere}
              placeholderTextColor="#E3E3E3"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="done"
              onSubmitEditing={handleDone}
              style={styles.input}
            />
          </View>

          <Pressable
            onPress={handleDone}
            accessibilityRole="button"
            style={({ pressed }) => [styles.doneBtn, pressed && { opacity: 0.9 }]}
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
    height: 287,
    borderRadius: 26,
    backgroundColor: '#07040D',
    paddingTop: 29,
    paddingBottom: 32,
    paddingHorizontal: 33,
    justifyContent: 'space-between',
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
  },
  closeHit: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    width: 24,
    height: 24,
  },
  title: {
    flex: 1,
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'right',
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
    paddingHorizontal: 24,
    gap: 12,
    alignSelf: 'center',
  },
  linkIcon: {
    width: 24,
    height: 24,
  },
  input: {
    flex: 1,
    color: '#E3E3E3',
    fontSize: 16,
    paddingVertical: 0,
  },
  doneBtn: {
    width: INNER_WIDTH,
    alignSelf: 'center',
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 21,
  },
  doneLabel: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
