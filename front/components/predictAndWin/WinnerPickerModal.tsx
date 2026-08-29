/**
 * Sponsor winner picker — Figma `953:2475` (404×462).
 *
 * Stats row + earliest-correct leaderboard. Tapping a row opens a confirm
 * sheet: award the prize or open the public profile.
 */

import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { useAuth } from '@clerk/clerk-expo';
import { useTranslation } from '../../src/i18n';
import {
  CompetitionsService,
  type OwnerLeaderboard,
  type OwnerLeaderboardCandidate,
} from '../../services/competitions.service';
import { getClerkBearerToken } from '../../utils/clerkAuthToken';
import { PW, PW_RADII, usePWDirection, usePWFonts, usePWScale } from './theme';

function StatTile({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  const { s, f } = usePWScale();
  const { medium, bold } = usePWFonts();
  return (
    <View
      style={{
        flex: 1,
        minWidth: s(72),
        height: s(90),
        borderRadius: s(16),
        backgroundColor: '#050010',
        borderWidth: 0.5,
        borderColor: '#120330',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: s(8),
        gap: s(2),
      }}
    >
      <Text style={{ fontFamily: medium, fontSize: f(8), color: '#4F4F52' }}>{label}</Text>
      <Text style={{ fontFamily: bold, fontSize: f(15), color: '#D4D4D4' }}>{value}</Text>
      <Ionicons name={icon} size={s(22)} color="#9B8FB0" />
    </View>
  );
}

function scoreLabel(c: OwnerLeaderboardCandidate, fallback: string) {
  if (c.predictedHomeScore != null && c.predictedAwayScore != null) {
    return `${c.predictedHomeScore}-${c.predictedAwayScore}`;
  }
  if (c.predictedWinner === 'home') return fallback;
  if (c.predictedWinner === 'away') return fallback;
  if (c.predictedWinner === 'draw') return fallback;
  return '—';
}

export function WinnerPickerModal({
  visible,
  competitionId,
  onClose,
}: {
  visible: boolean;
  competitionId: string | null;
  onClose: () => void;
}) {
  const { s, f } = usePWScale();
    const { semibold, regular } = usePWFonts();
  const dir = usePWDirection();
  const { t } = useTranslation();
  const w = t.predictAndWin.winnerPicker;
  const { getToken } = useAuth();
  const router = useRouter();

  const [board, setBoard] = useState<OwnerLeaderboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<OwnerLeaderboardCandidate | null>(null);
  const [awarding, setAwarding] = useState(false);

  const load = useCallback(async () => {
    if (!competitionId) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getClerkBearerToken(getToken, { retries: 2, baseDelayMs: 150 });
      if (!token) throw new Error('AUTH_REQUIRED');
      setBoard(await CompetitionsService.getLeaderboard(token, competitionId));
    } catch {
      setError(t.predictAndWin.errors.GENERIC);
    } finally {
      setLoading(false);
    }
  }, [competitionId, getToken, t.predictAndWin.errors.GENERIC]);

  useEffect(() => {
    if (visible && competitionId) {
      setPicked(null);
      void load();
    }
  }, [visible, competitionId, load]);

  const award = async () => {
    if (!competitionId || !picked) return;
    setAwarding(true);
    try {
      const token = await getClerkBearerToken(getToken, { retries: 2, baseDelayMs: 150 });
      if (!token) return;
      const next = await CompetitionsService.awardWinner(token, competitionId, picked.entryId);
      setBoard(next);
      setPicked(null);
    } catch {
      setError(t.predictAndWin.errors.GENERIC);
    } finally {
      setAwarding(false);
    }
  };

  const openProfile = () => {
    if (!picked) return;
    const username = picked.username;
    setPicked(null);
    onClose();
    router.push(`/user/${username}`);
  };

  const displayName = (c: OwnerLeaderboardCandidate) =>
    c.displayName?.trim() || c.username;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: 'rgba(4,1,10,0.72)',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: s(16),
        }}
      >
        <Pressable
          onPress={() => undefined}
          style={{
            width: '100%',
            maxWidth: s(404),
            maxHeight: '88%',
            backgroundColor: '#080512',
            borderRadius: s(30),
            borderWidth: 0.5,
            borderColor: 'rgba(222,191,252,0.39)',
            paddingVertical: s(21),
            shadowColor: '#590FA0',
            shadowOpacity: 0.36,
            shadowRadius: 52.5,
          }}
        >
          <View
            style={{
              flexDirection: dir.row,
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: s(28),
              marginBottom: s(18),
              height: s(35),
            }}
          >
            <Text style={{ fontFamily: semibold, fontSize: f(18), color: PW.text }}>
              {w.title}
            </Text>
            <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel={w.close}>
              <Ionicons name="close" size={s(22)} color="#EDE4F7" />
            </Pressable>
          </View>

          {loading ? (
            <ActivityIndicator color="#A44AF9" style={{ marginVertical: s(48) }} />
          ) : error ? (
            <Text style={{ color: '#fda4af', textAlign: 'center', padding: s(20), fontFamily: regular }}>
              {error}
            </Text>
          ) : board ? (
            <ScrollView
              style={{ maxHeight: s(380) }}
              contentContainerStyle={{ paddingBottom: s(8) }}
              showsVerticalScrollIndicator={false}
            >
              <View
                style={{
                  flexDirection: dir.row,
                  gap: s(4),
                  paddingHorizontal: s(21),
                  height: s(90),
                  marginBottom: s(12),
                }}
              >
                <StatTile label={w.wrong} value={String(board.stats.wrong)} icon="close-circle-outline" />
                <StatTile label={w.correct} value={String(board.stats.correct)} icon="checkmark-circle-outline" />
                <StatTile label={w.predictions} value={String(board.stats.predictions)} icon="football-outline" />
                <StatTile label={w.views} value={String(board.stats.views)} icon="eye-outline" />
              </View>

              {!board.matchFinished ? (
                <Text
                  style={{
                    color: '#9B8FB0',
                    textAlign: 'center',
                    fontFamily: regular,
                    fontSize: f(13),
                    paddingHorizontal: s(24),
                    paddingTop: s(16),
                  }}
                >
                  {w.waitingResult}
                </Text>
              ) : board.candidates.length === 0 ? (
                <Text
                  style={{
                    color: '#9B8FB0',
                    textAlign: 'center',
                    fontFamily: regular,
                    fontSize: f(13),
                    paddingHorizontal: s(24),
                    paddingTop: s(16),
                  }}
                >
                  {w.emptyCorrect}
                </Text>
              ) : (
                <View style={{ width: s(371), alignSelf: 'center', gap: s(8) }}>
                  {board.candidates.map((c) => (
                    <Pressable
                      key={c.entryId}
                      onPress={() => setPicked(c)}
                      disabled={c.isWinner}
                      style={{
                        height: s(58),
                        borderRadius: s(16),
                        backgroundColor: '#0A0514',
                        borderWidth: 0.5,
                        borderColor: '#140F1F',
                        flexDirection: dir.row,
                        alignItems: 'center',
                        paddingHorizontal: s(20),
                        opacity: c.isWinner ? 0.55 : 1,
                        gap: s(12),
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: semibold,
                          fontSize: f(22),
                          color: '#4ABF45',
                          minWidth: s(48),
                        }}
                      >
                        {scoreLabel(c, w.outcome)}
                      </Text>
                      <View style={{ flex: 1, flexDirection: dir.row, alignItems: 'center', gap: s(8) }}>
                        <Text
                          numberOfLines={1}
                          style={{ flex: 1, fontFamily: regular, fontSize: f(20), color: '#fff', textAlign: dir.textAlign }}
                        >
                          {displayName(c)}
                        </Text>
                        {c.avatar ? (
                          <Image
                            source={{ uri: c.avatar }}
                            style={{
                              width: s(38),
                              height: s(38),
                              borderRadius: s(19),
                              borderWidth: 0.5,
                              borderColor: 'rgba(194,194,194,0.92)',
                            }}
                          />
                        ) : (
                          <View
                            style={{
                              width: s(38),
                              height: s(38),
                              borderRadius: s(19),
                              backgroundColor: 'rgba(128,59,69,0.5)',
                              borderWidth: 0.5,
                              borderColor: 'rgba(194,194,194,0.92)',
                            }}
                          />
                        )}
                      </View>
                      <Text style={{ fontFamily: regular, fontSize: f(16), color: '#fff', width: s(22), textAlign: 'center' }}>
                        {c.isWinner ? '✓' : c.displayRank}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </ScrollView>
          ) : null}
        </Pressable>
      </Pressable>

      <Modal visible={Boolean(picked)} transparent animationType="fade" onRequestClose={() => setPicked(null)}>
        <Pressable
          onPress={() => setPicked(null)}
          style={{
            flex: 1,
            backgroundColor: 'rgba(4,1,10,0.78)',
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: s(24),
          }}
        >
          <Pressable
            onPress={() => undefined}
            style={{
              width: '100%',
              maxWidth: s(340),
              backgroundColor: '#12081f',
              borderRadius: s(PW_RADII.fab),
              borderWidth: 0.5,
              borderColor: 'rgba(222,191,252,0.32)',
              padding: s(22),
              gap: s(14),
            }}
          >
            <Text style={{ fontFamily: semibold, fontSize: f(18), color: '#fff', textAlign: 'center' }}>
              {picked
                ? w.confirm
                    .replace('{name}', displayName(picked))
                    .replace('{username}', picked.username)
                : ''}
            </Text>
            <Pressable
              onPress={() => void award()}
              disabled={awarding}
              style={{
                backgroundColor: '#008000',
                borderRadius: s(16),
                paddingVertical: s(14),
                alignItems: 'center',
              }}
            >
              {awarding ? (
                <ActivityIndicator color="#9EFF9E" />
              ) : (
                <Text style={{ fontFamily: semibold, fontSize: f(16), color: '#9EFF9E' }}>{w.award}</Text>
              )}
            </Pressable>
            <Pressable
              onPress={openProfile}
              style={{
                backgroundColor: '#1a0b30',
                borderRadius: s(16),
                paddingVertical: s(14),
                alignItems: 'center',
                borderWidth: 0.5,
                borderColor: '#2a1844',
              }}
            >
              <Text style={{ fontFamily: semibold, fontSize: f(16), color: '#EDE4F7' }}>{w.viewProfile}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </Modal>
  );
}
