import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { coachKingService, type CkCoach, type CkLine, type CkPlayer } from '../../services/coachKing.service';
import { useTranslation } from '../../src/i18n';
import { useAppFont } from '../../utils/fontSetup';

const PLACEHOLDER = require('../../assets/images/plear 90Plus.jpg');

type Props = {
  token: string;
  lang: string;
  line: CkLine | 'COACH' | null;
  onClose: () => void;
  onPickPlayer: (player: CkPlayer) => void;
  onPickCoach: (coach: CkCoach) => void;
};

export function CoachKingPicker({ token, lang, line, onClose, onPickPlayer, onPickCoach }: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const copy = t.coachKingGame;
  const fontSemi = useAppFont(600);
  const fontMed = useAppFont(500);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [players, setPlayers] = useState<CkPlayer[]>([]);
  const [coaches, setCoaches] = useState<CkCoach[]>([]);

  useEffect(() => {
    if (!line) return;
    let alive = true;
    const handle = setTimeout(() => {
      setLoading(true);
      const run = line === 'COACH'
        ? coachKingService.getCoaches(token, lang, query).then((rows) => {
          if (alive) setCoaches(rows);
        })
        : coachKingService.getPlayers(token, line, lang, query).then((rows) => {
          if (alive) setPlayers(rows);
        });
      run.catch(() => {
        if (alive) {
          setPlayers([]);
          setCoaches([]);
        }
      }).finally(() => {
        if (alive) setLoading(false);
      });
    }, 250);
    return () => {
      alive = false;
      clearTimeout(handle);
    };
  }, [line, query, token, lang]);

  const rows = line === 'COACH' ? coaches : players;

  return (
    <Modal visible={line != null} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
        <View style={styles.top}>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button">
            <Ionicons name="close" size={26} color="#fff" />
          </Pressable>
          <Text style={[styles.title, { fontFamily: fontSemi }]}>
            {line === 'COACH' ? copy.pickCoach : copy.pickPlayer}
          </Text>
          <View style={{ width: 26 }} />
        </View>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={copy.search}
          placeholderTextColor="rgba(255,255,255,0.4)"
          style={[styles.search, { fontFamily: fontMed }]}
          autoCorrect={false}
        />
        {loading ? <ActivityIndicator color="#8C5CF6" style={{ marginTop: 24 }} /> : null}
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          ListEmptyComponent={loading ? null : (
            <Text style={[styles.empty, { fontFamily: fontMed }]}>{copy.poolEmpty}</Text>
          )}
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => {
                if (line === 'COACH') onPickCoach(item as CkCoach);
                else onPickPlayer(item as CkPlayer);
              }}
            >
              <Image source={item.photo ? { uri: item.photo } : PLACEHOLDER} style={styles.photo} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { fontFamily: fontSemi }]} numberOfLines={1}>{item.name}</Text>
                <Text style={[styles.club, { fontFamily: fontMed }]} numberOfLines={1}>{item.club}</Text>
              </View>
              <Text style={[styles.price, { fontFamily: fontSemi }]}>{item.priceLabel}</Text>
            </Pressable>
          )}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#07040F', paddingHorizontal: 16 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  title: { color: '#fff', fontSize: 18 },
  search: {
    height: 46,
    borderRadius: 14,
    backgroundColor: '#120A22',
    color: '#fff',
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  photo: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#2A1540' },
  name: { color: '#fff', fontSize: 15 },
  club: { color: '#BBA1F6', fontSize: 12, marginTop: 2 },
  price: { color: '#fff', fontSize: 16 },
  empty: { color: 'rgba(255,255,255,0.55)', textAlign: 'center', marginTop: 32 },
});
