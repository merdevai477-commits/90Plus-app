/**
 * Join preview sheet — from deep link, notification, or invite.
 */

import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { X } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '@clerk/clerk-expo';

import { useToast } from '../../contexts/ToastContext';
import { PredictionGroupsService } from '../../services/predictionGroups.service';
import { GroupAvatar } from './GroupAvatar';
import { SheetBlurBackdrop } from './SheetBlurBackdrop';
import { PG, PG_GRADIENTS, usePGFonts } from './theme';

export interface GroupJoinSheetProps {
  visible: boolean;
  code?: string | null;
  inviteId?: string | null;
  onClose: () => void;
  onJoined: () => void;
}

export function GroupJoinSheet({
  visible,
  code,
  inviteId,
  onClose,
  onJoined,
}: GroupJoinSheetProps) {
  const { getToken } = useAuth();
  const toast = useToast();
  const { medium, bold, extra } = usePGFonts();
  const [preview, setPreview] = useState<{
    name: string;
    avatarUrl: string | null;
    membersCount: number;
    inviteCode: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!visible || !code) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const token = await getToken();
        if (!token) return;
        const data = await PredictionGroupsService.previewByCode(token, code);
        if (!cancelled) setPreview(data);
      } catch (e: any) {
        if (!cancelled) toast.showError('مجموعة غير موجودة', e?.message ?? '');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, code, getToken, toast]);

  const handleJoin = useCallback(async () => {
    setJoining(true);
    try {
      const token = await getToken();
      if (!token) return;
      await PredictionGroupsService.join(token, { code: code ?? undefined, inviteId: inviteId ?? undefined });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onJoined();
      onClose();
    } catch (e: any) {
      toast.showError('تعذر الانضمام', e?.message ?? '');
    } finally {
      setJoining(false);
    }
  }, [code, inviteId, getToken, onClose, onJoined, toast]);

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <SheetBlurBackdrop onPress={onClose} />
        <View style={styles.sheet}>
          <Pressable onPress={onClose} style={styles.close} hitSlop={10}>
            <X size={22} color={PG.textSecondary} />
          </Pressable>

          {loading ? (
            <ActivityIndicator color={PG.primaryLight} style={{ marginVertical: 40 }} />
          ) : preview ? (
            <>
              <GroupAvatar imageUri={preview.avatarUrl} size={88} />
              <Text style={[styles.name, { fontFamily: extra }]}>{preview.name}</Text>
              <Text style={[styles.meta, { fontFamily: medium }]}>
                {preview.membersCount} عضو · {preview.inviteCode}
              </Text>
              <Pressable disabled={joining} onPress={() => void handleJoin()}>
                <LinearGradient colors={PG_GRADIENTS.purple} style={styles.joinBtn}>
                  {joining ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={[styles.joinTxt, { fontFamily: bold }]}>انضمام للمجموعة</Text>
                  )}
                </LinearGradient>
              </Pressable>
            </>
          ) : (
            <Text style={[styles.meta, { fontFamily: medium }]}>تعذر تحميل المجموعة</Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: 'rgba(12,8,20,0.98)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.2)',
  },
  close: { alignSelf: 'flex-end' },
  name: { fontSize: 22, color: PG.text, textAlign: 'center' },
  meta: { fontSize: 13, color: PG.textMuted, textAlign: 'center' },
  joinBtn: {
    marginTop: 16,
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 14,
    minWidth: 220,
    alignItems: 'center',
  },
  joinTxt: { color: '#fff', fontSize: 16 },
});
