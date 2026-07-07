/**
 * Center popup — 4 premium island stat widgets (tickets-modal style).
 */

import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { BarChart3, CheckCircle2, Target, X, XCircle } from 'lucide-react-native';
import React from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { isLiquidGlassSupported, LiquidGlassView } from '../../utils/liquidGlassSafe';
import { LiquidGlassSurface } from './LiquidGlassSurface';
import { SheetBlurBackdrop } from './SheetBlurBackdrop';
import { PG, PG_RADII, PG_SPACING, PG_TYPE, usePGFonts } from './theme';

const PopupGlass = isLiquidGlassSupported ? LiquidGlassView : BlurView;
const POPUP_GLASS = isLiquidGlassSupported
  ? { effect: 'regular' as const, tintColor: 'rgba(10,6,18,0.98)' }
  : { intensity: Platform.OS === 'android' ? 60 : 40, tint: 'dark' as const };

function StatIsland({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent: string;
}) {
  const { medium, extra } = usePGFonts();
  return (
    <LiquidGlassSurface borderRadius={PG_RADII.lg} style={styles.island} fill>
      <View style={styles.islandInner}>
        <View style={[styles.iconWrap, { backgroundColor: `${accent}22` }]}>{icon}</View>
        <Text style={[styles.islandValue, { fontFamily: extra, color: accent }]}>{value}</Text>
        <Text style={[styles.islandLabel, { fontFamily: medium }]} numberOfLines={2}>
          {label}
        </Text>
      </View>
    </LiquidGlassSurface>
  );
}

export function GroupStatsPopup({
  visible,
  onClose,
  isRTL = false,
  stats,
}: {
  visible: boolean;
  onClose: () => void;
  isRTL?: boolean;
  stats?: { totalPredictions: number; correctPredictions: number; wrongPredictions: number } | null;
}) {
  const { bold, extra } = usePGFonts();
  const row: ViewStyle = { flexDirection: isRTL ? 'row-reverse' : 'row' };

  const total = stats?.totalPredictions ?? 0;
  const wins = stats?.correctPredictions ?? 0;
  const losses = stats?.wrongPredictions ?? 0;
  const accuracyPercent = total > 0 ? Math.round((wins / total) * 100) : 0;

  const close = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.overlay}>
        <SheetBlurBackdrop onPress={close} />

        <View style={styles.cardOuter}>
          <View style={styles.cardInner}>
            <PopupGlass {...POPUP_GLASS} style={StyleSheet.absoluteFill} />
            <LinearGradient
              colors={['rgba(124,58,237,0.16)', 'rgba(0,0,0,0.55)']}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />

            <Pressable onPress={close} style={styles.closeBtn} hitSlop={10}>
              <X size={18} color={PG.textSecondary} />
            </Pressable>

            <View style={styles.head}>
              <BarChart3 size={28} color={PG.primaryLight} />
              <Text style={[styles.title, { fontFamily: extra }]}>إحصائيات المجموعة</Text>
            </View>

            <View style={styles.grid}>
              <View style={[styles.gridRow, row]}>
                <StatIsland
                  label="نسبة التوقعات الصحيحة"
                  value={`${accuracyPercent}%`}
                  accent={PG.gold}
                  icon={<Target size={20} color={PG.gold} />}
                />
                <StatIsland
                  label="إجمالي التوقعات"
                  value={String(total)}
                  accent={PG.primaryLight}
                  icon={<BarChart3 size={20} color={PG.primaryLight} />}
                />
              </View>
              <View style={[styles.gridRow, row]}>
                <StatIsland
                  label="توقعات صحيحة"
                  value={String(wins)}
                  accent={PG.win}
                  icon={<CheckCircle2 size={20} color={PG.win} />}
                />
                <StatIsland
                  label="توقعات خاطئة"
                  value={String(losses)}
                  accent={PG.lossMuted}
                  icon={<XCircle size={20} color={PG.lossMuted} />}
                />
              </View>
            </View>

            <Pressable onPress={close} style={styles.doneBtn}>
              <LinearGradient
                colors={[PG.primaryLight, PG.primary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.doneGrad}
              >
                <Text style={[styles.doneText, { fontFamily: bold }]}>حسناً</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  cardOuter: {
    width: '100%',
    maxWidth: 360,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.75,
    shadowRadius: 32,
    elevation: 24,
    zIndex: 2,
  },
  cardInner: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.35)',
    overflow: 'hidden',
    padding: PG_SPACING.lg,
    paddingTop: PG_SPACING.xl,
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 3,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PG.glassStrong,
  },
  head: {
    alignItems: 'center',
    gap: 8,
    marginBottom: PG_SPACING.lg,
  },
  title: {
    color: PG.text,
    fontSize: PG_TYPE.title,
    textAlign: 'center',
  },
  grid: { gap: 10, marginBottom: PG_SPACING.lg },
  gridRow: { gap: 10 },
  island: { flex: 1, minHeight: 108 },
  islandInner: {
    padding: PG_SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 96,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  islandValue: { fontSize: 22 },
  islandLabel: {
    color: PG.textMuted,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 15,
  },
  doneBtn: { borderRadius: PG_RADII.lg, overflow: 'hidden' },
  doneGrad: { paddingVertical: 14, alignItems: 'center' },
  doneText: { color: '#fff', fontSize: PG_TYPE.body },
});
