import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';

import LuckyWheelCard from '../ShareWin/components/LuckyWheelCard';
import { useDailySpin } from '../../hooks/useDailySpin';
import { useTranslation } from '../../src/i18n';
import { runSafeModalClose } from '../../utils/safeModalClose';

interface ProfileSpinAndWinProps {
  visible: boolean;
  onClose: () => void;
  button: React.ReactNode;
}

/**
 * Profile "لف واربح" — same daily-spin wheel as Share & Win.
 * Visible only while the account can still spin (server 24h cooldown).
 * After a real win, the button hides as soon as the popup is dismissed,
 * and stays gone until the next spin window.
 */
const ProfileSpinAndWin = memo(function ProfileSpinAndWin({
  visible,
  onClose,
  button,
}: ProfileSpinAndWinProps) {
  const { t } = useTranslation();
  const { status, canSpin, reloadStatus } = useDailySpin();
  const [busy, setBusy] = useState(false);
  const [wonThisWindow, setWonThisWindow] = useState(false);
  const wonRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      void reloadStatus();
    }, [reloadStatus]),
  );

  useEffect(() => {
    if (canSpin && status) {
      wonRef.current = false;
      setWonThisWindow(false);
    }
  }, [canSpin, status]);

  const showButton = !!status?.canSpin && !wonThisWindow;

  const closeWheel = useCallback(() => {
    if (busy) return;
    runSafeModalClose(() => {
      onClose();
      setBusy(false);
      if (wonRef.current) setWonThisWindow(true);
      void reloadStatus();
    });
  }, [busy, onClose, reloadStatus]);

  const handleSettled = useCallback(() => {
    wonRef.current = true;
  }, []);

  if (!showButton && !visible) return null;

  return (
    <>
      {showButton ? button : null}

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
        statusBarTranslucent
        onRequestClose={closeWheel}
      >
        <View
          style={[
            styles.overlay,
            Platform.OS === 'android' && { backgroundColor: 'rgba(0,0,0,0.88)' },
          ]}
        >
          <BlurView
            intensity={Platform.OS === 'ios' ? 30 : 100}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={closeWheel}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={t.common.close}
          />

          <View style={styles.sheet} pointerEvents="box-none">
            <Pressable
              onPress={closeWheel}
              disabled={busy}
              style={[styles.closeBtn, busy && styles.closeBtnDisabled]}
              accessibilityRole="button"
              accessibilityLabel={t.common.close}
              hitSlop={10}
            >
              <Ionicons name="close" size={22} color="#fff" />
            </Pressable>

            <ScrollView
              bounces={false}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.sheetContent}
            >
              <LuckyWheelCard
                style={styles.wheel}
                onBusyChange={setBusy}
                onSpinSettled={handleSettled}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
});

export default ProfileSpinAndWin;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 8,
  },
  sheet: {
    width: '100%',
    maxHeight: '92%',
    alignItems: 'center',
  },
  sheetContent: {
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 24,
  },
  wheel: {
    marginTop: 0,
  },
  closeBtn: {
    position: 'absolute',
    top: 0,
    end: 12,
    zIndex: 2,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnDisabled: {
    opacity: 0.4,
  },
});
