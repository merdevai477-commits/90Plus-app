/**
 * Prediction entry sheet — Figma `955:2744` (415×508, radius 44).
 *
 * Opens from the hub/detail CTA ("شارك بتوقعك الان"). Score boxes are 95×74
 * with a purple VS between them; confirm is the same CTA gradient as the rest
 * of the feature (`#3d0ab3` → `#190448`).
 */

import { useAuth } from '@clerk/clerk-expo';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import TeamBadge from '../common/TeamBadge';
import { useToast } from '../../contexts/ToastContext';
import { useTranslation } from '../../src/i18n';
import {
  CompetitionsService,
  isEntryOpen,
  type CompetitionEntryInfo,
  type CompetitionInfo,
} from '../../services/competitions.service';
import { PWGradientText } from './GradientText';
import { PWPrimaryButton } from './fields';
import { IconInfoOutline, IconSheetClose } from './icons';
import { usePWLocalize } from './localize';
import { PW, PW_GRADIENTS, usePWDirection, usePWFonts, usePWScale } from './theme';

export function PredictScoreModal({
  visible,
  competition,
  onClose,
  onSubmitted,
  onSubmitSettled,
  onSubmitFailed,
}: {
  visible: boolean;
  competition: CompetitionInfo | null;
  onClose: () => void;
  onSubmitted?: (entry: CompetitionEntryInfo, competitionId: string) => void;
  onSubmitSettled?: (entry: CompetitionEntryInfo, competitionId: string) => void;
  onSubmitFailed?: (competitionId: string) => void;
}) {
  const { s, f } = usePWScale();
  const { width: winW } = useWindowDimensions();
  const { semibold, medium, regular } = usePWFonts();
  const dir = usePWDirection();
  const { t } = useTranslation();
  const { formatTime, errorMessage } = usePWLocalize();
  const { getToken, isSignedIn } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const detail = t.predictAndWin.detail;

  const [home, setHome] = useState('');
  const [away, setAway] = useState('');
  const [winner, setWinner] = useState<'home' | 'draw' | 'away' | null>(null);

  const tokenRef = useRef<string | null>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!competition) return;
    const entry = competition.myEntry;
    setHome(entry?.predictedHomeScore?.toString() ?? '');
    setAway(entry?.predictedAwayScore?.toString() ?? '');
    setWinner(entry?.predictedWinner ?? null);
    inFlight.current = false;
  }, [competition]);

  // Warm the session token while the user types so Confirm does not wait on Clerk.
  useEffect(() => {
    if (!visible || !isSignedIn) return;
    let cancelled = false;
    void getToken()
      .then((t) => {
        if (!cancelled && t) tokenRef.current = t;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [visible, isSignedIn, getToken]);

  if (!competition) return null;

  const isExact = competition.predictionMode === 'EXACT_SCORE';
  const kickoff = new Date(competition.matchDate);
  const sheetW = Math.min(s(415), Math.max(280, winW - 24));

  const submit = () => {
    if (inFlight.current) return;
    if (!isEntryOpen(competition)) {
      toast.showError(detail.deadlinePassed, '');
      return;
    }
    if (!isSignedIn) {
      onClose();
      router.push('/auth');
      return;
    }
    if (isExact) {
      if (home === '' || away === '') {
        toast.showError(detail.sheetTitle, detail.missingScore);
        return;
      }
    } else if (!winner) {
      toast.showError(detail.sheetTitle, detail.missingWinner);
      return;
    }

    inFlight.current = true;
    const competitionId = competition.id;
    const optimistic: CompetitionEntryInfo = isExact
      ? {
          id: competition.myEntry?.id ?? `local-${competitionId}`,
          predictedHomeScore: Number(home),
          predictedAwayScore: Number(away),
          predictedWinner: null,
          isCorrect: null,
          isWinner: false,
          rank: null,
          createdAt: competition.myEntry?.createdAt ?? new Date().toISOString(),
        }
      : {
          id: competition.myEntry?.id ?? `local-${competitionId}`,
          predictedHomeScore: null,
          predictedAwayScore: null,
          predictedWinner: winner!,
          isCorrect: null,
          isWinner: false,
          rank: null,
          createdAt: competition.myEntry?.createdAt ?? new Date().toISOString(),
        };
    const prediction = isExact
      ? { predictedHomeScore: Number(home), predictedAwayScore: Number(away) }
      : { predictedWinner: winner! };

    Keyboard.dismiss();
    onSubmitted?.(optimistic, competitionId);
    onClose();
    toast.showSuccess(detail.submitted, '');

    void (async () => {
      try {
        const token = tokenRef.current ?? (await getToken());
        if (!token) {
          onSubmitFailed?.(competitionId);
          router.push('/auth');
          return;
        }
        const entry = await CompetitionsService.predict(token, competitionId, prediction);
        if (entry) onSubmitSettled?.(entry, competitionId);
      } catch (err) {
        onSubmitFailed?.(competitionId);
        toast.showError(detail.confirmPrediction, errorMessage(err));
      } finally {
        inFlight.current = false;
      }
    })();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" />
        <LinearGradient
          colors={[...PW_GRADIENTS.input]}
          style={[
            styles.sheet,
            {
              width: sheetW,
              borderRadius: s(44),
              paddingVertical: s(16),
              shadowColor: '#5A129E',
              shadowOpacity: 0.36,
              shadowRadius: s(52.5),
              elevation: 16,
            },
          ]}
        >
          <View
            style={{
              height: s(35),
              paddingHorizontal: s(28),
              flexDirection: dir.row,
              alignItems: 'center',
              width: '100%',
            }}
          >
            <Pressable
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={detail.closeSheet}
            >
              <IconSheetClose width={s(36)} height={s(36)} />
            </Pressable>
          </View>

          <View style={{ width: s(331), maxWidth: '90%', alignItems: 'center', alignSelf: 'center' }}>
            <Text
              style={{
                fontFamily: semibold,
                fontSize: f(24),
                color: PW.text,
                textAlign: 'center',
                marginBottom: s(16),
              }}
            >
              {detail.sheetTitle}
            </Text>

            <View
              style={{
                height: s(101),
                width: '100%',
                paddingHorizontal: s(12),
                flexDirection: dir.row,
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <TeamCol name={competition.homeTeam} logo={competition.homeTeamLogo} />
              <View style={{ width: s(105), alignItems: 'center', gap: s(4) }}>
                <PWGradientText
                  colors={[PW.vsTop, PW.vsBottom]}
                  style={{ fontFamily: semibold, fontSize: f(21), textAlign: 'center' }}
                >
                  VS
                </PWGradientText>
                <Text
                  style={{
                    fontFamily: medium,
                    fontSize: f(13),
                    color: PW.textVsTime,
                    textAlign: 'center',
                  }}
                >
                  {formatTime(kickoff)}
                </Text>
              </View>
              <TeamCol name={competition.awayTeam} logo={competition.awayTeamLogo} />
            </View>

            <Text
              style={{
                fontFamily: semibold,
                fontSize: f(23),
                color: PW.text,
                textAlign: 'center',
                marginTop: s(24),
                marginBottom: s(16),
              }}
            >
              {detail.matchResult}
            </Text>

            {isExact ? (
              <View
                style={{
                  width: '100%',
                  paddingHorizontal: s(6),
                  flexDirection: dir.row,
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <ScoreBox value={home} onChange={setHome} />
                <PWGradientText
                  colors={[PW.vsTop, PW.vsBottom]}
                  style={{ fontFamily: semibold, fontSize: f(26), textAlign: 'center' }}
                >
                  VS
                </PWGradientText>
                <ScoreBox value={away} onChange={setAway} />
              </View>
            ) : (
              <View
                style={{
                  width: '100%',
                  flexDirection: dir.row,
                  gap: s(10),
                }}
              >
                {(
                  [
                    { key: 'home' as const, label: competition.homeTeam },
                    { key: 'draw' as const, label: detail.draw },
                    { key: 'away' as const, label: competition.awayTeam },
                  ] as const
                ).map((option) => {
                  const on = winner === option.key;
                  return (
                    <Pressable
                      key={option.key}
                      onPress={() => setWinner(option.key)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      style={{
                        flex: 1,
                        height: s(74),
                        borderRadius: s(16),
                        backgroundColor: on ? PW.controlTop : '#07040d',
                        borderWidth: 0.5,
                        borderColor: on ? PW.controlTop : '#241731',
                        alignItems: 'center',
                        justifyContent: 'center',
                        paddingHorizontal: s(6),
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: on ? semibold : medium,
                          fontSize: f(13),
                          color: on ? PW.text : PW.textSegmentIdle,
                          textAlign: 'center',
                        }}
                        numberOfLines={2}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            <View style={{ width: '100%', marginTop: s(48), gap: s(6) }}>
              <PWPrimaryButton
                label={detail.confirmPrediction}
                onPress={submit}
              />
              <View
                style={{
                  flexDirection: dir.row,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: s(2),
                }}
              >
                <Text
                  style={{
                    fontFamily: regular,
                    fontSize: f(12),
                    color: '#6B6B6B',
                    textAlign: 'center',
                  }}
                >
                  {detail.editBeforeKickoff}
                </Text>
                <IconInfoOutline width={s(16)} height={s(16)} />
              </View>
            </View>
          </View>
        </LinearGradient>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function TeamCol({ name, logo }: { name: string; logo: string | null }) {
  const { s, f } = usePWScale();
  const { semibold } = usePWFonts();
  return (
    <View style={{ width: s(81), alignItems: 'center', gap: s(9) }}>
      <TeamBadge name={name} logo={logo ?? undefined} size={s(61)} color="transparent" />
      <Text
        style={{
          fontFamily: semibold,
          fontSize: f(18),
          color: PW.text,
          textAlign: 'center',
        }}
        numberOfLines={2}
      >
        {name}
      </Text>
    </View>
  );
}

function ScoreBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { s, f } = usePWScale();
  const { medium } = usePWFonts();
  return (
    <View
      style={{
        width: s(95),
        height: s(74),
        borderRadius: s(16),
        backgroundColor: '#07040d',
        borderWidth: 0.5,
        borderColor: '#241731',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <TextInput
        value={value}
        onChangeText={(raw) => onChange(raw.replace(/\D/g, '').slice(0, 2))}
        keyboardType="number-pad"
        placeholder="—"
        placeholderTextColor={PW.textTimeIdle}
        accessibilityLabel="score"
        style={{
          fontFamily: medium,
          fontSize: f(28),
          color: PW.text,
          textAlign: 'center',
          width: '100%',
          padding: 0,
        }}
      />
    </View>
  );
}

const styles = {
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.62)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  backdrop: {
    ...({ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 } as const),
  },
  sheet: {
    overflow: 'hidden' as const,
    borderWidth: 1,
    borderColor: PW.detailBorder,
    zIndex: 1,
  },
};
