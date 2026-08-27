/**
 * Competition detail + prediction entry.
 *
 * The card itself is the Figma preview card (`650:5319`, 404×355) whose CTA is
 * "شارك بتوقعك الان". Figma has no dedicated score-entry frame for this feature,
 * so the entry sheet below the card is composed from the same design system
 * (wizard box, segmented pair, primary CTA) rather than invented styling.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CompetitionDetailCard } from '../../components/predictAndWin/CompetitionDetailCard';
import { PWHeader } from '../../components/predictAndWin/PWHeader';
import { PWBox, PWFieldLabel, PWPrimaryButton } from '../../components/predictAndWin/fields';
import { usePWLocalize } from '../../components/predictAndWin/localize';
import {
  PW,
  usePWDirection,
  usePWFonts,
  usePWScale,
} from '../../components/predictAndWin/theme';
import { useToast } from '../../contexts/ToastContext';
import { isEntryOpen } from '../../services/competitions.service';
import { useCompetition } from '../../hooks/useCompetition';
import { useTranslation } from '../../src/i18n';
import { useScreenFont } from '../../utils/fontSetup';

export default function CompetitionDetailScreen() {
  useScreenFont();
  const { s, f } = usePWScale();
  const { semibold, regular, medium } = usePWFonts();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { t } = useTranslation();
  const dir = usePWDirection();
  /**
   * The countdown's unit suffixes used to be hardcoded Arabic letters, so the
   * English build read "10 س 42 د 45 ث"; and the API's error prose is Arabic
   * only, so it was surfaced verbatim in English toasts. Both come from the
   * active locale now.
   */
  const { errorMessage, formatRemaining } = usePWLocalize();
  const detail = t.predictAndWin.detail;

  const { competition, loading, submitting, refresh, predict } = useCompetition(id);
  const [home, setHome] = useState('');
  const [away, setAway] = useState('');
  const [winner, setWinner] = useState<'home' | 'draw' | 'away' | null>(null);
  const [remaining, setRemaining] = useState('—');

  // Seed the controls from a previously saved prediction exactly once per
  // (competition, entry). Deriving the value inline instead would make the
  // fields un-clearable — emptying them would fall straight back to the saved
  // score. The entry id is part of the key so that an entry *appearing* later
  // still seeds: signing in while this screen is open re-fetches with a token
  // and only then does `myEntry` exist, and a competition-id-only key would
  // have marked the screen seeded during the anonymous read.
  const seededFor = useRef<string | null>(null);
  useEffect(() => {
    if (!competition) return;
    const entry = competition.myEntry;
    const key = `${competition.id}:${entry?.id ?? 'none'}`;
    if (seededFor.current === key) return;
    seededFor.current = key;
    if (!entry) return;
    setHome(entry.predictedHomeScore?.toString() ?? '');
    setAway(entry.predictedAwayScore?.toString() ?? '');
    setWinner(entry.predictedWinner ?? null);
  }, [competition]);

  // The 1s tick is what re-evaluates `isEntryOpen`, so the form closes itself
  // the moment the deadline passes without a refetch. It stops once expired —
  // an ended competition re-rendering every second for as long as the screen
  // is open is pure battery burn.
  const deadline = competition?.predictionDeadline;
  const endedLabel = t.predictAndWin.card.ended;
  useEffect(() => {
    if (!deadline) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const tick = () => {
      const ms = new Date(deadline).getTime() - Date.now();
      const next = ms <= 0 ? endedLabel : formatRemaining(ms);
      setRemaining(next);
      if (next === endedLabel && timer) clearInterval(timer);
    };
    tick();
    if (new Date(deadline).getTime() > Date.now()) {
      timer = setInterval(tick, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [deadline, endedLabel, formatRemaining]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: PW.screen }}>
        <PWHeader title={t.predictAndWin.title} onBack={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={PW.ctaTop} size="large" />
        </View>
      </View>
    );
  }

  // A failed or missing competition must land on a retryable error state —
  // rendering the spinner here would hang the screen forever.
  if (!competition) {
    return (
      <View style={{ flex: 1, backgroundColor: PW.screen }}>
        <PWHeader title={t.predictAndWin.title} onBack={() => router.back()} />
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            gap: s(10),
            paddingHorizontal: s(40),
          }}
        >
          <Text style={{ fontFamily: semibold, fontSize: f(16), color: PW.text, textAlign: 'center' }}>
            {t.predictAndWin.errorState.title}
          </Text>
          <Text
            style={{
              fontFamily: regular,
              fontSize: f(12),
              color: PW.textTileSub,
              textAlign: 'center',
            }}
          >
            {t.predictAndWin.errorState.subtitle}
          </Text>
          <Pressable onPress={refresh} hitSlop={8} style={{ marginTop: s(6) }}>
            <Text style={{ fontFamily: semibold, fontSize: f(13), color: PW.vsTop }}>
              {t.predictAndWin.errorState.retry}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Single source of truth for "can this user still predict" — mirrors the
  // backend gates (published + before deadline + before kickoff).
  const canEdit = isEntryOpen(competition);
  const isExact = competition.predictionMode === 'EXACT_SCORE';
  const selectedWinner = winner ?? competition.myEntry?.predictedWinner ?? null;

  /**
   * `DRAFT` and `REJECTED` only reach this screen for the sponsor who owns the
   * competition — it is their own submission awaiting review. Falling through
   * to "the deadline passed" told them their brand-new challenge had already
   * expired.
   */
  const closedReason =
    competition.status === 'DRAFT'
      ? t.predictAndWin.statusState.draft
      : competition.status === 'REJECTED'
        ? t.predictAndWin.statusState.rejected
        : competition.status === 'CANCELLED'
          ? t.predictAndWin.statusState.cancelled
          : competition.status === 'SETTLED'
            ? t.predictAndWin.statusState.settled
            : competition.status === 'LOCKED'
              ? t.predictAndWin.statusState.locked
              : detail.deadlinePassed;

  /**
   * The CTA label the card and the sheet button share: closed competitions say
   * why, a returning entrant is offered an edit, everyone else is invited to
   * predict. The old code hard-labelled it "شارك بتوقعك الان" and fired the
   * request regardless of state, so tapping a settled competition produced a
   * server error toast.
   */
  const ctaLabel = !canEdit ? closedReason : competition.myEntry ? detail.editHint : detail.submit;

  const submit = async () => {
    // Mirrors the backend gates. Without it the CTA on a closed competition
    // fires a request the API will always reject.
    if (!canEdit) {
      toast.showError(closedReason, '');
      return;
    }
    try {
      let entry;
      if (isExact) {
        // Silent returns here left the user tapping a dead button with no
        // explanation of what was missing.
        if (home === '' || away === '') {
          toast.showError(detail.predictTitle, detail.missingScore);
          return;
        }
        entry = await predict({
          predictedHomeScore: Number(home),
          predictedAwayScore: Number(away),
        });
      } else {
        if (!selectedWinner) {
          toast.showError(detail.predictTitle, detail.missingWinner);
          return;
        }
        entry = await predict({ predictedWinner: selectedWinner });
      }
      // `predict` returns null when it dropped the call because one was
      // already in flight (double-tap). Reporting success there would claim a
      // prediction was saved when nothing was sent.
      if (entry) toast.showSuccess(detail.submitted, '');
    } catch (err: any) {
      toast.showError(detail.submit, errorMessage(err));
      // The rejection may be the deadline passing or the competition settling
      // while the form was open — re-read so the UI stops offering entry.
      void refresh();
    }
  };

  const openMap = () => {
    if (!competition.sponsor.address) return;
    const q = encodeURIComponent(competition.sponsor.address);
    Linking.openURL(`https://maps.google.com/?q=${q}`).catch(() => undefined);
  };

  return (
    <View style={{ flex: 1, backgroundColor: PW.screen }}>
      <PWHeader title={t.predictAndWin.title} onBack={() => router.back()} />

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + s(40) }}>
        <View style={{ marginTop: s(28) }}>
          <CompetitionDetailCard
            competition={competition}
            remaining={remaining}
            ctaLabel={canEdit && !competition.myEntry ? detail.sharePrediction : ctaLabel}
            ctaDisabled={!canEdit || submitting}
            onCtaPress={submit}
            onOpenMap={openMap}
          />
        </View>

        {competition.status === 'SETTLED' && competition.myEntry ? (
          <View
            style={{
              marginTop: s(24),
              marginHorizontal: s(22),
              padding: s(16),
              borderRadius: s(16),
              backgroundColor: competition.myEntry.isWinner ? 'rgba(27,203,59,0.12)' : 'rgba(199,53,53,0.12)',
              alignItems: 'center',
              gap: s(4),
            }}
          >
            <Text style={{ fontFamily: semibold, fontSize: f(15), color: PW.text }}>
              {competition.myEntry.isWinner ? detail.won : detail.lost}
            </Text>
            {competition.myEntry.isWinner && competition.myEntry.rank ? (
              <Text style={{ fontFamily: regular, fontSize: f(12), color: PW.textTileSub }}>
                {detail.rank.replace('{rank}', String(competition.myEntry.rank))}
              </Text>
            ) : null}
          </View>
        ) : null}

        <View style={{ marginTop: s(28), marginHorizontal: s(22), gap: s(16) }}>
          <PWFieldLabel label={detail.predictTitle} style={{ alignSelf: dir.alignStart }} />

          {isExact ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(13) }}>
              <View style={{ flex: 1 }}>
                <PWBox height={73} style={{ alignItems: 'center' }}>
                  <ScoreInput value={home} onChange={setHome} editable={canEdit} />
                </PWBox>
              </View>
              <Text style={{ fontFamily: medium, fontSize: f(40), color: PW.text }}>:</Text>
              <View style={{ flex: 1 }}>
                <PWBox height={73} style={{ alignItems: 'center' }}>
                  <ScoreInput value={away} onChange={setAway} editable={canEdit} />
                </PWBox>
              </View>
            </View>
          ) : (
            /* Three outcomes — a drawn match must be predictable, otherwise a
               WINNER-mode competition on a draw can never have a winner. */
            <View style={{ flexDirection: 'row', gap: s(10) }}>
              {(
                [
                  { key: 'home', label: competition.homeTeam },
                  { key: 'draw', label: detail.draw },
                  { key: 'away', label: competition.awayTeam },
                ] as const
              ).map((option) => {
                const isOn = selectedWinner === option.key;
                return (
                  <Pressable
                    key={option.key}
                    style={{ flex: 1 }}
                    disabled={!canEdit}
                    onPress={() => setWinner(option.key)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isOn, disabled: !canEdit }}
                  >
                    <PWBox height={73} selected={isOn} style={{ alignItems: 'center' }}>
                      <Text
                        style={{
                          fontFamily: isOn ? semibold : medium,
                          fontSize: f(15),
                          color: isOn ? PW.text : PW.textSegmentIdle,
                          textAlign: 'center',
                        }}
                        numberOfLines={2}
                      >
                        {option.label}
                      </Text>
                    </PWBox>
                  </Pressable>
                );
              })}
            </View>
          )}

          {canEdit ? (
            <PWPrimaryButton
              label={ctaLabel}
              onPress={submit}
              disabled={submitting}
              loading={submitting ? <ActivityIndicator color={PW.text} /> : undefined}
            />
          ) : (
            <Text
              style={{
                fontFamily: regular,
                fontSize: f(12),
                color: PW.textTileSub,
                textAlign: 'center',
              }}
            >
              {closedReason}
            </Text>
          )}

          {competition.rules ? (
            <View style={{ marginTop: s(8), gap: s(8) }}>
              <PWFieldLabel label={t.predictAndWin.wizard.rulesLabel} style={{ alignSelf: dir.alignStart }} />
              <Text
                style={{
                  fontFamily: regular,
                  fontSize: f(13),
                  lineHeight: f(13) * 1.5,
                  color: PW.textTipBody,
                  textAlign: dir.textAlign,
                }}
              >
                {competition.rules}
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

function ScoreInput({
  value,
  onChange,
  editable,
}: {
  value: string;
  onChange: (v: string) => void;
  editable: boolean;
}) {
  const { f } = usePWScale();
  const { medium } = usePWFonts();
  return (
    <TextInput
      value={value}
      onChangeText={(raw) => onChange(raw.replace(/\D/g, '').slice(0, 2))}
      editable={editable}
      keyboardType="number-pad"
      placeholder="0"
      placeholderTextColor={PW.textTimeIdle}
      style={{
        fontFamily: medium,
        fontSize: f(40),
        color: PW.text,
        textAlign: 'center',
        width: '100%',
        padding: 0,
      }}
    />
  );
}
