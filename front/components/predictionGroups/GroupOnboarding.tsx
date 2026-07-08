/**
 * Onboarding — create or join a prediction group when user has none.
 */

import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Plus, Users } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';

import { useToast } from '../../contexts/ToastContext';
import { GroupBanBanner } from './GroupBanBanner';
import { LiquidGlassSurface } from './LiquidGlassSurface';
import { PG, PG_GRADIENTS, PG_RADII, usePGFonts } from './theme';
import { parseGroupCodeFromUrl } from '../../services/predictionGroups.service';

export function GroupOnboarding({
  isRTL,
  onCreate,
  onJoinByCode,
  groupBan,
}: {
  isRTL: boolean;
  onCreate: (name: string) => Promise<void>;
  onJoinByCode: (code: string) => Promise<void>;
  groupBan?: { until: string } | null;
}) {
  const { medium, bold, extra } = usePGFonts();
  const toast = useToast();
  const row: ViewStyle = { flexDirection: isRTL ? 'row-reverse' : 'row' };
  const align = isRTL ? 'right' : 'left';

  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const isBanned = Boolean(groupBan?.until && new Date(groupBan.until) > new Date());

  const handleCreate = useCallback(async () => {
    if (isBanned) {
      toast.showError('موقوف مؤقتاً', 'لا يمكنك إنشاء مجموعة حتى ينتهي الحظر');
      return;
    }
    if (name.trim().length < 2) {
      toast.showError('خطأ', 'اكتب اسم المجموعة (حرفين على الأقل)');
      return;
    }
    setBusy(true);
    try {
      await onCreate(name.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setCreateOpen(false);
      setName('');
    } catch (e: any) {
      toast.showError('تعذر الإنشاء', e?.message ?? 'حاول مرة أخرى');
    } finally {
      setBusy(false);
    }
  }, [isBanned, name, onCreate, toast]);

  const handleJoin = useCallback(async () => {
    if (isBanned) {
      toast.showError('موقوف مؤقتاً', 'لا يمكنك الانضمام حتى ينتهي الحظر');
      return;
    }
    const normalized = parseGroupCodeFromUrl(code) ?? code.trim().toUpperCase();
    if (!/^90PLUS[A-Z0-9]+$/.test(normalized)) {
      toast.showError('كود غير صالح', 'الكود يبدأ بـ 90PLUS');
      return;
    }
    setBusy(true);
    try {
      await onJoinByCode(normalized);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setJoinOpen(false);
      setCode('');
    } catch (e: any) {
      toast.showError('تعذر الانضمام', e?.message ?? 'تحقق من الكود');
    } finally {
      setBusy(false);
    }
  }, [code, isBanned, onJoinByCode, toast]);

  return (
    <View style={styles.wrap}>
      {groupBan?.until ? <GroupBanBanner untilIso={groupBan.until} /> : null}
      <Text style={[styles.title, { fontFamily: extra, textAlign: 'center' }]}>
        ملك التوقعات
      </Text>
      <Text style={[styles.sub, { fontFamily: medium, textAlign: 'center' }]}>
        أنشئ مجموعتك أو انضم لمجموعة أصدقائك وتنافسوا على التوقعات اليومية
      </Text>

      <View style={styles.actions}>
        <LiquidGlassSurface borderRadius={PG_RADII.lg} onPress={() => !isBanned && setCreateOpen(true)}>
          <View style={[styles.actionBtn, row]}>
            <Plus size={22} color={PG.primaryLight} />
            <Text style={[styles.actionTxt, { fontFamily: bold }]}>إنشاء مجموعة</Text>
          </View>
        </LiquidGlassSurface>

        <LiquidGlassSurface borderRadius={PG_RADII.lg} onPress={() => !isBanned && setJoinOpen(true)}>
          <View style={[styles.actionBtn, row]}>
            <Users size={22} color={PG.gold} />
            <Text style={[styles.actionTxt, { fontFamily: bold }]}>الانضمام لمجموعة</Text>
          </View>
        </LiquidGlassSurface>
      </View>

      <Modal visible={createOpen} transparent animationType="fade">
        <Pressable style={styles.backdrop} onPress={() => !busy && setCreateOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.sheetTitle, { fontFamily: bold, textAlign: align }]}>اسم المجموعة</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="مثال: شلة الكورة"
              placeholderTextColor={PG.textMuted}
              style={[styles.input, { fontFamily: medium, textAlign: align }]}
              maxLength={40}
            />
            <Pressable disabled={busy} onPress={() => void handleCreate()}>
              <LinearGradient colors={PG_GRADIENTS.purple} style={styles.primaryBtn}>
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={[styles.primaryTxt, { fontFamily: bold }]}>إنشاء</Text>
                )}
              </LinearGradient>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={joinOpen} transparent animationType="fade">
        <Pressable style={styles.backdrop} onPress={() => !busy && setJoinOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.sheetTitle, { fontFamily: bold, textAlign: align }]}>كود الدعوة</Text>
            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder="90PLUSXXXX"
              placeholderTextColor={PG.textMuted}
              autoCapitalize="characters"
              style={[styles.input, { fontFamily: medium, textAlign: align }]}
            />
            <Pressable disabled={busy} onPress={() => void handleJoin()}>
              <LinearGradient colors={PG_GRADIENTS.purple} style={styles.primaryBtn}>
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={[styles.primaryTxt, { fontFamily: bold }]}>انضمام</Text>
                )}
              </LinearGradient>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 24, paddingTop: 48, gap: 16 },
  title: { fontSize: 26, color: PG.text },
  sub: { fontSize: 14, color: PG.textSecondary, lineHeight: 22 },
  actions: { gap: 12, marginTop: 24 },
  actionBtn: {
    paddingVertical: 18,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 12,
    justifyContent: 'center',
  },
  actionTxt: { color: PG.text, fontSize: 16 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    backgroundColor: PG.card,
    borderRadius: 20,
    padding: 20,
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.25)',
  },
  sheetTitle: { fontSize: 18, color: PG.text },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: PG.text,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  primaryBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryTxt: { color: '#fff', fontSize: 16 },
});
