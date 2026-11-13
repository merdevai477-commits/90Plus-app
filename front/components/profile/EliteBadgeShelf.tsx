import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import BadgeIcon from '../identity/BadgeIcon';
import { getApiUrl } from '../../config/api.config';
import { useTranslation } from '../../src/i18n';

interface Award {
  id: string;
  key: string;
  nameAr: string;
  nameEn: string;
  accent: string;
  title: string;
  description: string | null;
  competitionName: string | null;
  startsAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  active: boolean;
  permanent: boolean;
}

export default function EliteBadgeShelf({ userId }: { userId?: string | null }) {
  const { t, language } = useTranslation();
  const copy = (t as { profile?: Record<string, string> }).profile || {};
  const [rows, setRows] = useState<Award[] | null>(null);
  const [selected, setSelected] = useState<Award | null>(null);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    fetch(`${getApiUrl()}/elite-badges/users/${userId}`)
      .then((res) => res.json())
      .then((json) => {
        if (alive) setRows(Array.isArray(json?.data) ? json.data : []);
      })
      .catch(() => {
        if (alive) setRows([]);
      });
    return () => {
      alive = false;
    };
  }, [userId]);

  if (!userId) return null;
  if (rows === null) return <ActivityIndicator color="#f5b942" style={{ marginTop: 12 }} />;
  const active = rows.filter((row) => row.active);
  const past = rows.filter((row) => !row.active);
  const nameOf = (row: Award) => (language === 'ar' ? row.nameAr : row.nameEn);

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>{copy.eliteBadgesTitle || 'Badges'}</Text>
      {rows.length === 0 ? <Text style={styles.empty}>{copy.eliteBadgesEmpty || 'No badges yet'}</Text> : null}
      <View style={styles.grid}>
        {active.map((row) => (
          <Pressable key={row.id} style={styles.card} onPress={() => setSelected(row)}>
            <BadgeIcon badgeKey={row.key} accent={row.accent} variant="card" />
            <Text style={styles.cardTitle} numberOfLines={1}>{row.title}</Text>
          </Pressable>
        ))}
      </View>
      {past.length ? <Text style={styles.sub}>{copy.eliteBadgesPast || 'Past'}</Text> : null}
      {past.map((row) => (
        <Pressable key={row.id} onPress={() => setSelected(row)}>
          <Text style={styles.past}>{nameOf(row)} · {row.title}</Text>
        </Pressable>
      ))}
      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <Pressable style={styles.modal} onPress={() => setSelected(null)}>
          {selected ? (
            <View style={styles.sheet}>
              <BadgeIcon badgeKey={selected.key} accent={selected.accent} variant="detail" />
              <Text style={styles.sheetTitle}>{nameOf(selected)}</Text>
              <Text style={styles.sheetCustom}>{selected.title}</Text>
              {selected.description ? <Text style={styles.sheetBody}>{selected.description}</Text> : null}
              {selected.competitionName ? <Text style={styles.sheetBody}>{selected.competitionName}</Text> : null}
              <Text style={styles.sheetBody}>
                {selected.permanent
                  ? copy.eliteBadgePermanent
                  : selected.expiresAt
                    ? (copy.eliteBadgeUntil || 'Until {date}').replace('{date}', new Date(selected.expiresAt).toLocaleDateString())
                    : selected.revokedAt
                      ? copy.eliteBadgeRevoked
                      : copy.eliteBadgeExpired}
              </Text>
            </View>
          ) : null}
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 16, paddingHorizontal: 16 },
  heading: { color: '#f5f5f5', fontSize: 16, fontWeight: '800', marginBottom: 8 },
  empty: { color: '#9a9a9a' },
  sub: { color: '#9a9a9a', marginTop: 10, marginBottom: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: { width: 92, alignItems: 'center', gap: 6 },
  cardTitle: { color: '#f5b942', fontSize: 11, textAlign: 'center' },
  past: { color: '#d4d4d4', marginBottom: 4 },
  modal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  sheet: { width: '100%', maxWidth: 320, backgroundColor: '#0a0a0a', borderRadius: 24, padding: 20, alignItems: 'center', gap: 8 },
  sheetTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  sheetCustom: { color: '#f5b942', fontSize: 16 },
  sheetBody: { color: '#d4d4d4', textAlign: 'center' },
});
