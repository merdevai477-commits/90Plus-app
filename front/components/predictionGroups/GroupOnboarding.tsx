/**
 * Hub — create, join by code, and suggested groups (most members first).
 */

import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { ChevronLeft, Plus, Search } from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';

import { useToast } from '../../contexts/ToastContext';
import { useTranslation } from '../../src/i18n';
import type { RankedGroupRow } from '../../services/predictionGroups.service';
import { parseGroupCodeFromUrl } from '../../services/predictionGroups.service';
import { GroupAvatar } from './GroupAvatar';
import { GroupBanBanner } from './GroupBanBanner';
import { PG, PG_GRADIENTS, PG_GLOW_PURPLE, PG_RADII, usePGFonts } from './theme';

const GROUP_HERO = require('../../assets/images/groub pr.jpg');

export function GroupOnboarding({
  isRTL,
  topInset = 0,
  onBack,
  onCreatePress,
  onJoinByCode,
  groupBan,
  suggestions,
  suggestionsLoading,
  joiningCode,
}: {
  isRTL: boolean;
  topInset?: number;
  onBack?: () => void;
  onCreatePress: () => void;
  onJoinByCode: (code: string) => Promise<void>;
  groupBan?: { until: string } | null;
  suggestions: RankedGroupRow[];
  suggestionsLoading?: boolean;
  joiningCode?: string | null;
}) {
  const { medium, bold, extra } = usePGFonts();
  const { t } = useTranslation();
  const ob = t.predictionGroups.onboarding;
  const common = t.predictionGroups.common;
  const toast = useToast();
  const row: ViewStyle = { flexDirection: isRTL ? 'row-reverse' : 'row' };
  const align = isRTL ? 'right' : 'left';

  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const isBanned = Boolean(groupBan?.until && new Date(groupBan.until) > new Date());

  const ranked = useMemo(
    () => [...suggestions].sort((a, b) => (b.members ?? 0) - (a.members ?? 0)),
    [suggestions],
  );

  const submitCode = useCallback(
    async (raw: string) => {
      if (isBanned) {
        toast.showError(ob.bannedTitle, ob.bannedJoin);
        return;
      }
      const normalized = parseGroupCodeFromUrl(raw) ?? raw.trim().toUpperCase();
      if (!/^90PLUS[A-Z0-9]+$/.test(normalized)) {
        toast.showError(ob.invalidCodeTitle, ob.invalidCodeBody);
        return;
      }
      setBusy(true);
      setActiveCode(normalized);
      try {
        await onJoinByCode(normalized);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setCode('');
      } catch (e: any) {
        toast.showError(ob.joinFailed, e?.message ?? ob.joinFailedHint);
      } finally {
        setBusy(false);
        setActiveCode(null);
      }
    },
    [isBanned, ob, onJoinByCode, toast],
  );

  return (
    <View style={styles.wrap}>
      {groupBan?.until ? <GroupBanBanner untilIso={groupBan.until} /> : null}

      <View style={[styles.heroShell, { height: 360 + topInset }]}>
        <ImageBackground source={GROUP_HERO} style={styles.heroBg} resizeMode="cover">
          <LinearGradient
            colors={['rgba(3,3,3,0.12)', 'transparent', 'rgba(3,3,3,0.55)', PG.bg]}
            locations={[0, 0.18, 0.72, 1]}
            style={StyleSheet.absoluteFill}
          />
          {onBack ? (
            <Pressable
              onPress={onBack}
              style={[styles.backBtn, { top: topInset + 6, left: 12 }]}
              hitSlop={8}
              accessibilityRole="button"
            >
              <ChevronLeft size={22} color="#fff" strokeWidth={2.25} />
            </Pressable>
          ) : null}
          <View style={styles.heroInner}>
            <Text style={[styles.title, { fontFamily: extra }]}>{ob.heroTitle}</Text>
            <Text style={[styles.sub, { fontFamily: medium }]}>{ob.heroSubtitle}</Text>
          </View>
        </ImageBackground>
      </View>

      <Pressable
        onPress={() => {
          if (isBanned) {
            toast.showError(ob.bannedTitle, ob.bannedCreate);
            return;
          }
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          onCreatePress();
        }}
        style={({ pressed }) => [pressed && { opacity: 0.92 }]}
      >
        <LinearGradient
          colors={[...PG_GRADIENTS.purple]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.primaryCard, row]}
        >
          <Plus size={20} color="#fff" />
          <Text style={[styles.primaryTxt, { fontFamily: bold }]}>{ob.createGroup}</Text>
        </LinearGradient>
      </Pressable>

      <View style={[styles.orRow, row]}>
        <View style={styles.orLine} />
        <Text style={[styles.orTxt, { fontFamily: medium }]}>{ob.or}</Text>
        <View style={styles.orLine} />
      </View>

      <View style={[styles.joinField, row]}>
        <Search size={18} color={PG.textMuted} />
        <TextInput
          value={code}
          onChangeText={setCode}
          placeholder={ob.joinPlaceholder}
          placeholderTextColor={PG.textMuted}
          autoCapitalize="characters"
          returnKeyType="go"
          onSubmitEditing={() => void submitCode(code)}
          editable={!busy && !isBanned}
          style={[styles.joinInput, { fontFamily: medium, textAlign: align }]}
        />
        {busy ? <ActivityIndicator color={PG.primaryLight} size="small" /> : null}
      </View>

      <View style={styles.suggestHead}>
        <View style={styles.suggestBar} />
        <Text style={[styles.suggestTitle, { fontFamily: extra, textAlign: align }]}>{ob.suggestions}</Text>
      </View>

      {suggestionsLoading && ranked.length === 0 ? (
        <ActivityIndicator color={PG.primaryLight} style={{ marginTop: 12 }} />
      ) : ranked.length === 0 ? (
        <Text style={[styles.empty, { fontFamily: medium, textAlign: align }]}>{ob.emptySuggestions}</Text>
      ) : (
        ranked.map((g) => {
          const joining = activeCode === g.inviteCode || joiningCode === g.inviteCode;
          return (
            <Pressable
              key={g.id}
              disabled={joining || isBanned}
              onPress={() => void submitCode(g.inviteCode)}
              style={({ pressed }) => [styles.suggestCard, row, pressed && { opacity: 0.9 }]}
            >
              <GroupAvatar imageUri={g.avatarUrl} size={46} />
              <View style={[styles.suggestMeta, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
                <Text style={[styles.suggestName, { fontFamily: bold, textAlign: align }]} numberOfLines={1}>
                  {g.name}
                </Text>
                <Text style={[styles.suggestMembers, { fontFamily: medium }]}>
                  {common.members.replace('{count}', String(g.members))}
                </Text>
              </View>
              <View style={styles.joinChip}>
                {joining ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={[styles.joinChipTxt, { fontFamily: medium }]}>{common.join}</Text>
                )}
              </View>
            </Pressable>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, paddingBottom: 28, gap: 16 },
  heroShell: {
    marginHorizontal: -20,
    marginTop: 0,
    overflow: 'hidden',
  },
  heroBg: { flex: 1, justifyContent: 'flex-end' },
  backBtn: {
    position: 'absolute',
    zIndex: 4,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroInner: { alignItems: 'center', gap: 8, paddingBottom: 10, paddingHorizontal: 24 },
  title: { fontSize: 26, color: PG.text, textAlign: 'center' },
  sub: { fontSize: 15, color: PG.textSecondary, textAlign: 'center' },
  primaryCard: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 10,
    justifyContent: 'center',
    borderRadius: PG_RADII.xl,
    minHeight: 54,
    ...PG_GLOW_PURPLE,
  },
  primaryTxt: { color: '#fff', fontSize: 16 },
  orRow: { alignItems: 'center', gap: 10, paddingHorizontal: 8 },
  orLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.18)' },
  orTxt: { color: PG.textMuted, fontSize: 13 },
  joinField: {
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 14,
    borderRadius: PG_RADII.lg,
    backgroundColor: PG.card,
    borderWidth: 1,
    borderColor: PG.borderBright,
  },
  joinInput: { flex: 1, color: PG.text, fontSize: 14, paddingVertical: 12 },
  suggestHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  suggestBar: { width: 3, height: 16, borderRadius: 2, backgroundColor: PG.primary },
  suggestTitle: { flex: 1, color: PG.text, fontSize: 16 },
  empty: { color: PG.textMuted, fontSize: 13, paddingVertical: 8 },
  suggestCard: {
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: PG_RADII.lg,
    backgroundColor: PG.card,
    borderWidth: 1,
    borderColor: PG.border,
  },
  suggestMeta: { flex: 1, minWidth: 0 },
  suggestName: { color: PG.text, fontSize: 15 },
  suggestMembers: { color: PG.textMuted, fontSize: 12, marginTop: 2 },
  joinChip: {
    minWidth: 64,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: PG.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinChipTxt: { color: '#fff', fontSize: 12 },
});
