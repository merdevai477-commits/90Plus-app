import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Minus, Plus, RefreshCw } from 'lucide-react-native';
import { useAuth } from '@clerk/clerk-expo';
import {
  adjustSeedXp,
  fetchSeedXpTarget,
  type SeedXpTarget,
} from '../../services/adminXp.service';
import { toastManager } from '../../services/toastManager';
import { useResolvedAppScheme } from '@/hooks/useResolvedAppScheme';
import {
  TEXT_PRIMARY,
  TEXT_MUTED,
  PURPLE_SOFT,
  PURPLE_GLOW_SM,
  BORDER_ARENA,
  RADIUS_LG,
  PURPLE_PRIMARY,
} from '../../constants/tokens';
import { canMakeAuthenticatedRequests } from '../../utils/clerkAuthToken';

const QUICK_DELTAS = [-50, -10, -5, -1, 1, 5, 10, 50] as const;

type Labels = {
  section: string;
  subtitle: string;
  xpLabel: string;
  levelLabel: string;
  customPlaceholder: string;
  apply: string;
  refresh: string;
  adjusted: string;
  adjustFailed: string;
  loadFailed: string;
};

export function SeedXpControlPanel({ labels }: { labels: Labels }) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { isDark } = useResolvedAppScheme();
  const [target, setTarget] = useState<SeedXpTarget | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [custom, setCustom] = useState('');
  const [visible, setVisible] = useState(false);

  const ink = isDark ? TEXT_PRIMARY : '#24104E';
  const muted = isDark ? TEXT_MUTED : '#6B7280';

  const load = useCallback(async () => {
    if (!isLoaded || !isSignedIn || !canMakeAuthenticatedRequests()) {
      setVisible(false);
      setTarget(null);
      return;
    }
    setLoading(true);
    try {
      const token = await getToken();
      const data = await fetchSeedXpTarget(token);
      if (!data) {
        setVisible(false);
        setTarget(null);
        return;
      }
      setTarget(data);
      setVisible(true);
    } catch {
      setVisible(false);
      setTarget(null);
    } finally {
      setLoading(false);
    }
  }, [getToken, isLoaded, isSignedIn]);

  useEffect(() => {
    void load();
  }, [load]);

  const applyDelta = useCallback(
    async (delta: number) => {
      if (!delta || busy) return;
      setBusy(true);
      try {
        const token = await getToken();
        const result = await adjustSeedXp(token, delta);
        setTarget((prev) =>
          prev
            ? { ...prev, xp: result.xp, level: result.level }
            : prev,
        );
        const sign = result.awarded >= 0 ? '+' : '';
        toastManager.showSuccess(
          labels.adjusted,
          `${sign}${result.awarded} XP → ${result.xp}`,
        );
      } catch {
        toastManager.showError(labels.adjustFailed, labels.adjustFailed);
      } finally {
        setBusy(false);
      }
    },
    [busy, getToken, labels.adjustFailed, labels.adjusted],
  );

  const applyCustom = useCallback(() => {
    const parsed = Number.parseInt(custom.trim(), 10);
    if (!Number.isFinite(parsed) || parsed === 0) return;
    void applyDelta(parsed);
    setCustom('');
  }, [applyDelta, custom]);

  if (!visible && !loading) return null;

  return (
    <View style={styles.group}>
      <Text style={[styles.sectionLabel, !isDark && { color: '#6B7280' }]}>
        {labels.section}
      </Text>
      <View
        style={[
          styles.card,
          !isDark && {
            backgroundColor: '#FFFFFF',
            borderColor: 'rgba(106,43,217,0.14)',
          },
        ]}
      >
        {loading && !target ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={PURPLE_SOFT} />
          </View>
        ) : target ? (
          <>
            <View style={styles.profileRow}>
              {target.avatar ? (
                <Image source={{ uri: target.avatar }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarLetter}>
                    {(target.displayName || target.username || '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: ink }]} numberOfLines={1}>
                  {target.displayName || target.username}
                </Text>
                <Text style={[styles.handle, { color: muted }]} numberOfLines={1}>
                  @{target.username}
                </Text>
                <Text style={[styles.subtitle, { color: muted }]}>{labels.subtitle}</Text>
              </View>
              <TouchableOpacity
                onPress={() => void load()}
                disabled={loading || busy}
                style={styles.refreshBtn}
                accessibilityRole="button"
                accessibilityLabel={labels.refresh}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={PURPLE_SOFT} />
                ) : (
                  <RefreshCw size={16} color={PURPLE_SOFT} strokeWidth={2.2} />
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={[styles.statValue, { color: ink }]}>{target.xp}</Text>
                <Text style={[styles.statLabel, { color: muted }]}>{labels.xpLabel}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text style={[styles.statValue, { color: ink }]}>{target.level}</Text>
                <Text style={[styles.statLabel, { color: muted }]}>{labels.levelLabel}</Text>
              </View>
            </View>

            <View style={styles.chips}>
              {QUICK_DELTAS.map((d) => {
                const negative = d < 0;
                return (
                  <TouchableOpacity
                    key={d}
                    style={[
                      styles.chip,
                      negative ? styles.chipNeg : styles.chipPos,
                      (busy || loading) && styles.chipDisabled,
                    ]}
                    disabled={busy || loading}
                    onPress={() => void applyDelta(d)}
                    accessibilityRole="button"
                    accessibilityLabel={`${d > 0 ? '+' : ''}${d} XP`}
                  >
                    {negative ? (
                      <Minus size={12} color="#fca5a5" strokeWidth={2.4} />
                    ) : (
                      <Plus size={12} color="#86efac" strokeWidth={2.4} />
                    )}
                    <Text
                      style={[
                        styles.chipText,
                        { color: negative ? '#fca5a5' : '#86efac' },
                      ]}
                    >
                      {Math.abs(d)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.customRow}>
              <TextInput
                value={custom}
                onChangeText={setCustom}
                placeholder={labels.customPlaceholder}
                placeholderTextColor={muted}
                keyboardType="numbers-and-punctuation"
                style={[
                  styles.input,
                  {
                    color: ink,
                    borderColor: isDark ? BORDER_ARENA : 'rgba(106,43,217,0.2)',
                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8F5FF',
                  },
                ]}
                editable={!busy}
                returnKeyType="done"
                onSubmitEditing={applyCustom}
              />
              <TouchableOpacity
                style={[styles.applyBtn, (busy || !custom.trim()) && styles.chipDisabled]}
                disabled={busy || !custom.trim()}
                onPress={applyCustom}
                accessibilityRole="button"
                accessibilityLabel={labels.apply}
              >
                {busy ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.applyText}>{labels.apply}</Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { marginBottom: 20 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: TEXT_MUTED,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginStart: 4,
  },
  card: {
    borderRadius: RADIUS_LG,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER_ARENA,
    backgroundColor: 'rgba(255,255,255,0.045)',
    padding: 14,
    gap: 14,
  },
  loadingRow: { paddingVertical: 20, alignItems: 'center' },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 14 },
  avatarFallback: {
    backgroundColor: PURPLE_GLOW_SM,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { color: PURPLE_SOFT, fontWeight: '800', fontSize: 18 },
  name: { fontSize: 15, fontWeight: '800' },
  handle: { fontSize: 12, marginTop: 1 },
  subtitle: { fontSize: 11, marginTop: 4, lineHeight: 15 },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PURPLE_GLOW_SM,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 11, fontWeight: '700', marginTop: 2, letterSpacing: 0.4 },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: BORDER_ARENA,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipPos: {
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderColor: 'rgba(34,197,94,0.35)',
  },
  chipNeg: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderColor: 'rgba(239,68,68,0.35)',
  },
  chipDisabled: { opacity: 0.45 },
  chipText: { fontSize: 13, fontWeight: '800' },
  customRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: '600',
  },
  applyBtn: {
    height: 42,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: PURPLE_PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 88,
  },
  applyText: { color: '#fff', fontWeight: '800', fontSize: 13 },
});
