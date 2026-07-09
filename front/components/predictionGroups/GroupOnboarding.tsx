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
import { useTranslation } from '../../src/i18n';
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
  const { t } = useTranslation();
  const ob = t.predictionGroups.onboarding;
  const common = t.predictionGroups.common;
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
      toast.showError(ob.bannedTitle, ob.bannedCreate);
      return;
    }
    if (name.trim().length < 2) {
      toast.showError(ob.nameError, ob.nameRequired);
      return;
    }
    setBusy(true);
    try {
      await onCreate(name.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setCreateOpen(false);
      setName('');
    } catch (e: any) {
      toast.showError(ob.createFailed, e?.message ?? ob.tryAgain);
    } finally {
      setBusy(false);
    }
  }, [isBanned, name, ob, onCreate, toast]);

  const handleJoin = useCallback(async () => {
    if (isBanned) {
      toast.showError(ob.bannedTitle, ob.bannedJoin);
      return;
    }
    const normalized = parseGroupCodeFromUrl(code) ?? code.trim().toUpperCase();
    if (!/^90PLUS[A-Z0-9]+$/.test(normalized)) {
      toast.showError(ob.invalidCodeTitle, ob.invalidCodeBody);
      return;
    }
    setBusy(true);
    try {
      await onJoinByCode(normalized);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setJoinOpen(false);
      setCode('');
    } catch (e: any) {
      toast.showError(ob.joinFailed, e?.message ?? ob.joinFailedHint);
    } finally {
      setBusy(false);
    }
  }, [code, isBanned, ob, onJoinByCode, toast]);

  return (
    <View style={styles.wrap}>
      {groupBan?.until ? <GroupBanBanner untilIso={groupBan.until} /> : null}
      <Text style={[styles.title, { fontFamily: extra, textAlign: 'center' }]}>
        {ob.heroTitle}
      </Text>
      <Text style={[styles.sub, { fontFamily: medium, textAlign: 'center' }]}>
        {ob.heroSubtitle}
      </Text>

      <View style={styles.actions}>
        <LiquidGlassSurface borderRadius={PG_RADII.lg} onPress={() => !isBanned && setCreateOpen(true)}>
          <View style={[styles.actionBtn, row]}>
            <Plus size={22} color={PG.primaryLight} />
            <Text style={[styles.actionTxt, { fontFamily: bold }]}>{ob.createGroup}</Text>
          </View>
        </LiquidGlassSurface>

        <LiquidGlassSurface borderRadius={PG_RADII.lg} onPress={() => !isBanned && setJoinOpen(true)}>
          <View style={[styles.actionBtn, row]}>
            <Users size={22} color={PG.gold} />
            <Text style={[styles.actionTxt, { fontFamily: bold }]}>{ob.joinGroup}</Text>
          </View>
        </LiquidGlassSurface>
      </View>

      <Modal visible={createOpen} transparent animationType="fade">
        <Pressable style={styles.backdrop} onPress={() => !busy && setCreateOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.sheetTitle, { fontFamily: bold, textAlign: align }]}>{ob.groupName}</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={ob.groupNamePlaceholder}
              placeholderTextColor={PG.textMuted}
              style={[styles.input, { fontFamily: medium, textAlign: align }]}
              maxLength={40}
            />
            <Pressable disabled={busy} onPress={() => void handleCreate()}>
              <LinearGradient colors={PG_GRADIENTS.purple} style={styles.primaryBtn}>
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={[styles.primaryTxt, { fontFamily: bold }]}>{common.create}</Text>
                )}
              </LinearGradient>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={joinOpen} transparent animationType="fade">
        <Pressable style={styles.backdrop} onPress={() => !busy && setJoinOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.sheetTitle, { fontFamily: bold, textAlign: align }]}>{ob.inviteCode}</Text>
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
                  <Text style={[styles.primaryTxt, { fontFamily: bold }]}>{common.join}</Text>
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
