/**
 * Competition detail. Entry happens in the Figma sheet `955:2744`, opened from
 * the card CTA ("شارك بتوقعك الان"), not as a second form under the card.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CompetitionDetailCard } from '../../components/predictAndWin/CompetitionDetailCard';
import { PredictScoreModal } from '../../components/predictAndWin/PredictScoreModal';
import { PWHeader } from '../../components/predictAndWin/PWHeader';
import { PWFieldLabel } from '../../components/predictAndWin/fields';
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
  const { semibold, regular } = usePWFonts();
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
  const { formatRemaining } = usePWLocalize();
  const detail = t.predictAndWin.detail;

  const { competition, loading, submitting, refresh } = useCompetition(id);
  const [remaining, setRemaining] = useState('—');
  const [sheetOpen, setSheetOpen] = useState(false);

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
            onCtaPress={() => {
              if (!canEdit) {
                toast.showError(closedReason, '');
                return;
              }
              setSheetOpen(true);
            }}
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

        {competition.rules ? (
          <View style={{ marginTop: s(28), marginHorizontal: s(22), gap: s(8) }}>
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
      </ScrollView>

      <PredictScoreModal
        visible={sheetOpen}
        competition={competition}
        onClose={() => setSheetOpen(false)}
        onSubmitted={() => {
          setSheetOpen(false);
          void refresh();
        }}
      />
    </View>
  );
}
