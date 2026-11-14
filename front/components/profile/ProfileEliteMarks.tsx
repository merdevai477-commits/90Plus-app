import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import BadgeIcon from '../identity/BadgeIcon';
import { getApiUrl } from '../../config/api.config';
import { SURFACE_BG } from '../../constants/ui';
import { useTranslation } from '../../src/i18n';

interface Award {
  id: string;
  key: string;
  nameAr: string;
  nameEn: string;
  accent: string;
  title: string;
  description: string | null;
  active: boolean;
}

export default function ProfileEliteMarks({ userId }: { userId?: string | null }) {
  const { t, language, isRTL } = useTranslation();
  const [rows, setRows] = useState<Award[]>([]);
  const [selected, setSelected] = useState<Award | null>(null);

  useEffect(() => {
    if (!userId || userId.startsWith('user_')) {
      setRows([]);
      return;
    }
    let alive = true;
    fetch(`${getApiUrl()}/elite-badges/users/${userId}`)
      .then((res) => res.json())
      .then((json) => {
        if (!alive) return;
        const list = Array.isArray(json?.data) ? (json.data as Award[]) : [];
        setRows(list.filter((row) => row.active));
      })
      .catch(() => {
        if (alive) setRows([]);
      });
    return () => {
      alive = false;
    };
  }, [userId]);

  if (!rows.length) return null;
  const nameOf = (row: Award) => (language === 'ar' ? row.nameAr : row.nameEn);
  const meaning = selected?.description?.trim() || t.profile.eliteBadgeMeaningFallback;

  return (
    <>
      {rows.slice(0, 3).map((row) => (
        <TouchableOpacity
          key={row.id}
          onPress={() => setSelected(row)}
          activeOpacity={0.85}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={nameOf(row)}
        >
          <BadgeIcon badgeKey={row.key} accent={row.accent} size={18} variant="inline" />
        </TouchableOpacity>
      ))}
      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <View style={styles.overlay}>
          <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelected(null)} />
          {selected ? (
            <View style={styles.card}>
              <LinearGradient colors={['#1A1206', '#0B0614', '#140C04']} style={StyleSheet.absoluteFill} />
              <BadgeIcon badgeKey={selected.key} accent={selected.accent} variant="detail" />
              <Text style={[styles.title, isRTL && styles.rtl]}>{nameOf(selected)}</Text>
              <View style={[styles.divider, { backgroundColor: selected.accent }]} />
              <Text style={[styles.subtitle, { color: selected.accent }]}>{selected.title}</Text>
              <Text style={[styles.body, isRTL && styles.rtl]}>{meaning}</Text>
              <TouchableOpacity style={styles.ctaWrap} onPress={() => setSelected(null)} activeOpacity={0.88}>
                <LinearGradient colors={[selected.accent, '#8A6A12']} style={styles.cta}>
                  <Text style={styles.ctaText}>{t.profile.eliteBadgeClose}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 22,
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(245,185,66,0.35)',
    backgroundColor: SURFACE_BG,
    gap: 8,
  },
  title: { color: '#fff', fontSize: 22, fontWeight: '800', textAlign: 'center' },
  divider: { width: 48, height: 3, borderRadius: 2, marginVertical: 4 },
  subtitle: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  body: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 10,
  },
  rtl: { writingDirection: 'rtl' },
  ctaWrap: { width: '100%', borderRadius: 14, overflow: 'hidden', marginTop: 6 },
  cta: { height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
