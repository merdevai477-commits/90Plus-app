/**
 * King of Coaches opponent team (Figma 1488-2888): who they are, their coach,
 * and their lineup on the pitch. Read-only; the profile card opens their
 * public profile.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CkApiError, coachKingService, type CkUserSquad } from '../../services/coachKing.service';
import { useTranslation } from '../../src/i18n';
import { useAppFont } from '../../utils/fontSetup';
import { CoachKingPitch } from './CoachKingPitch';

const PLACEHOLDER = require('../../assets/images/plear 90Plus.jpg');

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

export default function CoachKingOpponentScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ userId: string; name?: string; avatar?: string; username?: string }>();
  const userId = one(params.userId);
  const { getToken, isSignedIn } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const { t, language } = useTranslation();
  const copy = t.coachKingGame;
  const opp = copy.opponent;
  const isAr = language === 'ar';
  const fontSemi = useAppFont(600);
  const fontMed = useAppFont(500);
  const fontBold = useAppFont(700);
  const fontRegular = useAppFont(400);

  const [data, setData] = useState<CkUserSquad | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isSignedIn || !userId) {
      setLoading(false);
      return;
    }
    try {
      const token = await getTokenRef.current();
      if (!token) throw new CkApiError('E003', null, 'Unauthorized');
      setData(await coachKingService.getUserSquad(token, userId, language));
      setError(null);
    } catch (err) {
      const detail = err instanceof CkApiError ? `${err.code} ${err.reason ?? ''} ${err.message}` : String(err);
      console.warn('[CoachKing] opponent failed', detail);
      setError(copy.generic);
    } finally {
      setLoading(false);
    }
  }, [isSignedIn, userId, language, copy.generic]);

  useEffect(() => {
    void load();
  }, [load]);

  const user = data?.user;
  const name = user?.displayName || one(params.name) || '—';
  const avatar = user?.avatar ?? (one(params.avatar) || null);
  const username = user?.username || one(params.username);
  const row = isAr ? 'row-reverse' : 'row';
  const align = isAr ? 'flex-end' : 'flex-start';

  const openProfile = () => {
    if (!username) return;
    router.push({ pathname: '/user/[username]', params: { username } });
  };

  return (
    <View style={styles.root} testID="ck-opponent">
      <View style={[styles.header, { paddingTop: insets.top + 8, flexDirection: row }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" testID="ck-opponent-back">
          <Ionicons name={isAr ? 'arrow-forward' : 'arrow-back'} size={30} color="#fff" />
        </Pressable>
        <Text style={[styles.headerTitle, { fontFamily: fontSemi }]}>{opp.title}</Text>
        <Pressable onPress={() => router.push('/notifications' as never)} hitSlop={12} accessibilityRole="button">
          <Ionicons name="notifications-outline" size={26} color="#fff" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 24 }} showsVerticalScrollIndicator={false}>
        <Pressable
          onPress={openProfile}
          disabled={!username}
          accessibilityRole="button"
          accessibilityLabel={`${opp.openProfile} ${name}`}
          testID="ck-opponent-profile"
          style={({ pressed }) => [pressed && { opacity: 0.9 }]}
        >
          <LinearGradient
            colors={['#140533', '#09001D']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.summary, { flexDirection: row }]}
          >
            <View style={[styles.player, { flexDirection: row }]}>
              <View style={styles.avatarRing}>
                <Image source={avatar ? { uri: avatar } : PLACEHOLDER} style={styles.avatar} cachePolicy="memory-disk" />
              </View>
              <View style={{ flex: 1, alignItems: align, rowGap: 6 }}>
                <Text style={[styles.name, { fontFamily: fontSemi }]} numberOfLines={1}>{name}</Text>
                {username ? (
                  <Text style={[styles.username, { fontFamily: fontMed }]} numberOfLines={1}>@{username}</Text>
                ) : null}
                <View style={[styles.stats, { flexDirection: row }]}>
                  <View style={[styles.stat, { flexDirection: row }]}>
                    <FontAwesome5 name="crown" size={11} color="#F8C94A" />
                    <Text style={[styles.statTxt, { fontFamily: fontMed }]}>{user?.points ?? 0}</Text>
                  </View>
                  <View style={[styles.stat, { flexDirection: row }]}>
                    <Ionicons name="flash" size={13} color="#C2ABFC" />
                    <Text style={[styles.statTxt, { fontFamily: fontMed }]}>{user?.weekPoints ?? 0}</Text>
                  </View>
                </View>
              </View>
            </View>
            <View style={[styles.rankBox, { alignItems: isAr ? 'flex-start' : 'flex-end' }]}>
              <Text style={[styles.rankLabel, { fontFamily: fontRegular }]}>{opp.rank}</Text>
              <View style={[styles.rankValueRow, { flexDirection: row }]}>
                <MaterialCommunityIcons name="podium-gold" size={18} color="#C2ABFC" />
                <Text style={[styles.rankValue, { fontFamily: fontBold }]}>{user?.rank ?? '—'}</Text>
              </View>
              <View style={[styles.openRow, { flexDirection: row }]}>
                <Text style={[styles.openTxt, { fontFamily: fontMed }]}>{opp.openProfile}</Text>
                <Ionicons name={isAr ? 'chevron-back' : 'chevron-forward'} size={12} color="#8C5CF5" />
              </View>
            </View>
          </LinearGradient>
        </Pressable>

        {loading && !data ? <ActivityIndicator color="#8C5CF6" style={{ marginTop: 32 }} /> : null}
        {error ? <Text style={[styles.note, { fontFamily: fontMed, color: '#F87171' }]}>{error}</Text> : null}

        {data && !data.squad ? (
          <View style={styles.emptyBox}>
            <MaterialCommunityIcons name="soccer-field" size={34} color="#8C5CF5" />
            <Text style={[styles.note, { fontFamily: fontMed }]}>{opp.noSquad}</Text>
          </View>
        ) : null}

        {data?.squad ? (
          <View style={{ marginTop: 12 }}>
            {data.gameweek && !data.gameweek.current ? (
              <Text style={[styles.note, { fontFamily: fontMed, marginTop: 0, marginBottom: 10 }]}>{opp.lastWeek}</Text>
            ) : null}
            <CoachKingPitch
              slots={data.squad.slots}
              coach={data.squad.coach}
              coachLabel={opp.coach}
              formation={copy.formation}
              isAr={isAr}
              readOnly
            />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#030303' },
  header: {
    paddingHorizontal: 18,
    paddingBottom: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { color: '#fff', fontSize: 20 },
  summary: {
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 13,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#200E4A',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 12,
  },
  player: { flex: 1, alignItems: 'center', columnGap: 10 },
  avatarRing: {
    width: 58,
    height: 58,
    borderRadius: 29,
    padding: 2,
    borderWidth: 1,
    borderColor: '#8C5CF5',
    boxShadow: '0px 0px 12px rgba(140,92,245,0.45)',
  },
  avatar: { width: '100%', height: '100%', borderRadius: 27 },
  name: { color: '#fff', fontSize: 18 },
  username: { color: '#9E8BC9', fontSize: 12, marginTop: -4 },
  stats: { alignItems: 'center', columnGap: 16 },
  stat: { alignItems: 'center', columnGap: 4 },
  statTxt: { color: '#9C9C9C', fontSize: 12 },
  rankBox: { rowGap: 4 },
  rankLabel: { color: '#9E9E9E', fontSize: 10 },
  rankValueRow: { alignItems: 'center', columnGap: 4 },
  rankValue: { color: '#fff', fontSize: 22 },
  openRow: { alignItems: 'center', columnGap: 2 },
  openTxt: { color: '#8C5CF5', fontSize: 10 },
  note: { color: '#C2ABFC', textAlign: 'center', marginTop: 16, marginHorizontal: 24, fontSize: 13 },
  emptyBox: { alignItems: 'center', marginTop: 40, rowGap: 6 },
});
