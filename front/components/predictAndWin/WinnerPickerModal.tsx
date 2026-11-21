/**
 * Sponsor prize stats + winner picker — Figma light `2460:1871`.
 */

import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
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
import { GlassCtaShell } from './glassCta';
import { usePWDirection, usePWFonts, usePWScale, usePWTheme, type PWTheme } from './theme';

const AWARD_GLASS_TINT = ['rgba(0,220,80,0.32)', 'rgba(0,120,40,0.14)'] as const;
const PROFILE_GLASS_TINT = ['rgba(140,40,255,0.28)', 'rgba(61,10,179,0.14)'] as const;

type MetricPalette = PWTheme['metricViews'];

function StatTile({
  label,
  value,
  icon,
  palette,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  palette: MetricPalette;
}) {
  const { s, f } = usePWScale();
  const { medium, bold } = usePWFonts();
  return (
    <View
      style={{
        flex: 1,
        minHeight: s(88),
        borderRadius: s(16),
        backgroundColor: palette.bg,
        borderWidth: 1,
        borderColor: palette.border,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: s(10),
        paddingHorizontal: s(6),
        gap: s(4),
      }}
    >
      <Ionicons name={icon} size={s(20)} color={palette.value} />
      <Text style={{ fontFamily: bold, fontSize: f(16), color: palette.value }}>{value}</Text>
      <Text style={{ fontFamily: medium, fontSize: f(9), color: palette.label, textAlign: 'center' }} numberOfLines={2}>
        {label}
      </Text>
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
  const theme = usePWTheme();
  const { s, f } = usePWScale();
  const { semibold, regular, medium } = usePWFonts();
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

  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const genericErrorRef = useRef(t.predictAndWin.errors.GENERIC);
  genericErrorRef.current = t.predictAndWin.errors.GENERIC;

  useEffect(() => {
    if (!visible || !competitionId) return;

    let cancelled = false;
    setPicked(null);
    setLoading(true);
    setError(null);
    setBoard(null);

    void (async () => {
      try {
        const token = await getClerkBearerToken(getTokenRef.current, { retries: 2, baseDelayMs: 150 });
        if (!token) throw new Error('AUTH_REQUIRED');
        const data = await CompetitionsService.getLeaderboard(token, competitionId);
        if (!cancelled) setBoard(data);
      } catch {
        if (!cancelled) setError(genericErrorRef.current);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, competitionId]);

  const award = async () => {
    if (!competitionId || !picked) return;
    setAwarding(true);
    try {
      const token = await getClerkBearerToken(getTokenRef.current, { retries: 2, baseDelayMs: 150 });
      if (!token) return;
      const next = await CompetitionsService.awardWinner(token, competitionId, picked.entryId);
      setBoard(next);
      setPicked(null);
    } catch {
      setError(genericErrorRef.current);
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

  const metricRow = (
    <>
      <View style={{ flexDirection: dir.row, gap: s(8) }}>
        <StatTile label={w.views} value={String(board?.stats.views ?? 0)} icon="eye-outline" palette={theme.metricViews} />
        <StatTile
          label={w.predictions}
          value={String(board?.stats.predictions ?? 0)}
          icon="people-outline"
          palette={theme.metricParticipants}
        />
      </View>
      <View style={{ flexDirection: dir.row, gap: s(8) }}>
        <StatTile
          label={w.correct}
          value={String(board?.stats.correct ?? 0)}
          icon="checkmark-circle-outline"
          palette={theme.metricCorrect}
        />
        <StatTile label={w.wrong} value={String(board?.stats.wrong ?? 0)} icon="close-circle-outline" palette={theme.metricWrong} />
      </View>
    </>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: theme.overlay,
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
            backgroundColor: theme.modalBg,
            borderRadius: s(30),
            borderWidth: theme.isDark ? 0.5 : 1,
            borderColor: theme.modalBorder,
            paddingVertical: s(21),
            ...theme.cardShadow,
          }}
        >
          <View style={{ paddingHorizontal: s(24), gap: s(6), marginBottom: s(14) }}>
            <View style={{ flexDirection: dir.row, alignItems: 'flex-start', justifyContent: 'space-between', gap: s(8) }}>
              <View style={{ flex: 1, gap: s(4) }}>
                <Text style={{ fontFamily: semibold, fontSize: f(18), color: theme.text }}>{w.title}</Text>
                {'subtitle' in w && w.subtitle ? (
                  <Text style={{ fontFamily: regular, fontSize: f(12), color: theme.textTileSub, textAlign: dir.textAlign }}>
                    {w.subtitle}
                  </Text>
                ) : null}
              </View>
              <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel={w.close}>
                <Ionicons name="close" size={s(22)} color={theme.muted} />
              </Pressable>
            </View>
          </View>

          {loading ? (
            <ActivityIndicator color={theme.primary} style={{ marginVertical: s(48) }} />
          ) : error ? (
            <Text style={{ color: '#fda4af', textAlign: 'center', padding: s(20), fontFamily: regular }}>{error}</Text>
          ) : board ? (
            <ScrollView
              style={{ maxHeight: s(400) }}
              contentContainerStyle={{ paddingBottom: s(12), gap: s(16) }}
              showsVerticalScrollIndicator={false}
            >
              <View style={{ paddingHorizontal: s(20), gap: s(8) }}>{metricRow}</View>

              {!board.matchFinished ? (
                <Text
                  style={{
                    color: theme.muted,
                    textAlign: 'center',
                    fontFamily: regular,
                    fontSize: f(13),
                    paddingHorizontal: s(24),
                  }}
                >
                  {w.waitingResult}
                </Text>
              ) : board.candidates.length === 0 ? (
                <Text
                  style={{
                    color: theme.muted,
                    textAlign: 'center',
                    fontFamily: regular,
                    fontSize: f(13),
                    paddingHorizontal: s(24),
                  }}
                >
                  {w.emptyCorrect}
                </Text>
              ) : (
                <View style={{ paddingHorizontal: s(20), gap: s(10) }}>
                  <Text
                    style={{
                      fontFamily: semibold,
                      fontSize: f(14),
                      color: theme.text,
                      textAlign: dir.textAlign,
                    }}
                  >
                    {w.winners}
                  </Text>
                  {board.candidates.slice(0, 4).map((c) => (
                    <Pressable
                      key={c.entryId}
                      onPress={() => setPicked(c)}
                      disabled={c.isWinner}
                      style={{
                        minHeight: s(58),
                        borderRadius: s(16),
                        backgroundColor: theme.winnerRowBg,
                        borderWidth: 1,
                        borderColor: theme.winnerRowBorder,
                        flexDirection: dir.row,
                        alignItems: 'center',
                        paddingHorizontal: s(14),
                        opacity: c.isWinner ? 0.55 : 1,
                        gap: s(10),
                        ...(theme.isDark ? {} : theme.tileShadow),
                      }}
                    >
                      <View
                        style={{
                          paddingHorizontal: s(8),
                          paddingVertical: s(4),
                          borderRadius: s(8),
                          backgroundColor: theme.correctChipBg,
                        }}
                      >
                        <Text style={{ fontFamily: medium, fontSize: f(11), color: theme.correctChipText }}>
                          {w.correctChip}
                        </Text>
                      </View>
                      <Text
                        style={{
                          fontFamily: semibold,
                          fontSize: f(16),
                          color: theme.correctChipText,
                          minWidth: s(44),
                        }}
                      >
                        {scoreLabel(c, w.outcome)}
                      </Text>
                      <View style={{ flex: 1, flexDirection: dir.row, alignItems: 'center', gap: s(8) }}>
                        <Text
                          numberOfLines={1}
                          style={{
                            flex: 1,
                            fontFamily: regular,
                            fontSize: f(15),
                            color: theme.text,
                            textAlign: dir.textAlign,
                          }}
                        >
                          {displayName(c)}
                        </Text>
                        {c.avatar ? (
                          <Image
                            source={{ uri: c.avatar }}
                            style={{
                              width: s(36),
                              height: s(36),
                              borderRadius: s(18),
                              borderWidth: 1,
                              borderColor: theme.surfaceBorder,
                            }}
                          />
                        ) : (
                          <View
                            style={{
                              width: s(36),
                              height: s(36),
                              borderRadius: s(18),
                              backgroundColor: theme.pale,
                            }}
                          />
                        )}
                      </View>
                      <Text
                        style={{
                          fontFamily: regular,
                          fontSize: f(14),
                          color: theme.muted,
                          minWidth: s(22),
                          textAlign: 'center',
                        }}
                      >
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
            backgroundColor: theme.overlay,
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
              backgroundColor: theme.modalBg,
              borderRadius: s(28),
              borderWidth: theme.isDark ? 0.5 : 1,
              borderColor: theme.modalBorder,
              padding: s(22),
              gap: s(16),
              ...theme.cardShadow,
            }}
          >
            {picked ? (
              <View style={{ alignItems: 'center', gap: s(10) }}>
                {picked.avatar ? (
                  <Image
                    source={{ uri: picked.avatar }}
                    style={{
                      width: s(64),
                      height: s(64),
                      borderRadius: s(32),
                      borderWidth: 1,
                      borderColor: theme.modalBorder,
                    }}
                  />
                ) : (
                  <View
                    style={{
                      width: s(64),
                      height: s(64),
                      borderRadius: s(32),
                      backgroundColor: theme.pale,
                    }}
                  />
                )}
                <Text style={{ fontFamily: semibold, fontSize: f(20), color: theme.text, textAlign: 'center' }}>
                  {displayName(picked)}
                </Text>
                <Text style={{ fontFamily: medium, fontSize: f(13), color: theme.muted, textAlign: 'center' }}>
                  @{picked.username}
                </Text>
              </View>
            ) : null}

            <Text
              style={{
                fontFamily: regular,
                fontSize: f(15),
                lineHeight: f(22),
                color: theme.textSubtitle,
                textAlign: 'center',
              }}
            >
              {picked
                ? w.confirm
                    .replace('{name}', displayName(picked))
                    .replace('{username}', picked.username)
                : ''}
            </Text>

            <Pressable
              onPress={() => void award()}
              disabled={awarding}
              accessibilityRole="button"
              accessibilityLabel={w.award}
            >
              <GlassCtaShell tint={AWARD_GLASS_TINT} radius={s(16)} colorScheme={theme.isDark ? 'dark' : 'light'}>
                <View
                  style={{
                    paddingVertical: s(15),
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: s(48),
                  }}
                >
                  {awarding ? (
                    <ActivityIndicator color={theme.correctChipText} />
                  ) : (
                    <Text style={{ fontFamily: semibold, fontSize: f(16), color: theme.correctChipText }}>{w.award}</Text>
                  )}
                </View>
              </GlassCtaShell>
            </Pressable>

            <Pressable onPress={openProfile} accessibilityRole="button" accessibilityLabel={w.viewProfile}>
              <GlassCtaShell tint={PROFILE_GLASS_TINT} radius={s(16)} colorScheme={theme.isDark ? 'dark' : 'light'}>
                <View
                  style={{
                    paddingVertical: s(15),
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: s(48),
                  }}
                >
                  <Text style={{ fontFamily: semibold, fontSize: f(16), color: theme.text }}>{w.viewProfile}</Text>
                </View>
              </GlassCtaShell>
            </Pressable>

            <Pressable
              onPress={() => setPicked(null)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={w.close}
              style={{ alignItems: 'center', paddingTop: s(4) }}
            >
              <Text style={{ fontFamily: medium, fontSize: f(13), color: theme.muted }}>{w.close}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </Modal>
  );
}