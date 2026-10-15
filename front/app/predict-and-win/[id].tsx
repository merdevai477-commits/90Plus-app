/**
 * Sponsor store detail — Figma `1318:17057`.
 *
 * Hub store taps land here. Prediction stays on the hub via PredictScoreModal.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SponsorStorePage } from '../../components/predictAndWin/SponsorStorePage';
import { PW, usePWFonts, usePWScale } from '../../components/predictAndWin/theme';
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
  const { t } = useTranslation();
  const detail = t.predictAndWin.detail;

  const { competition, loading, refresh } = useCompetition(id);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: PW.screen, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={PW.ctaTop} size="large" />
      </View>
    );
  }

  if (!competition) {
    return (
      <View style={{ flex: 1, backgroundColor: PW.screen }}>
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

  const openMap = () => {
    if (!competition.sponsor.address) return;
    const q = encodeURIComponent(competition.sponsor.address);
    Linking.openURL(`https://maps.google.com/?q=${q}`).catch(() => undefined);
  };

  const share = () => {
    const message = detail.shareMessage
      .replace('{prize}', competition.prizeName)
      .replace('{sponsor}', competition.sponsor.name)
      .replace('{home}', competition.homeTeam)
      .replace('{away}', competition.awayTeam);
    Share.share({ message }).catch(() => undefined);
  };

  return (
    <View style={{ flex: 1, backgroundColor: PW.screen }}>
      <ScrollView
        contentContainerStyle={{
          paddingBottom: insets.bottom + s(40),
          paddingHorizontal: s(22),
        }}
        showsVerticalScrollIndicator={false}
      >
        <SponsorStorePage
          competition={competition}
          onBack={() => router.back()}
          onOpenMap={openMap}
          onShare={share}
        />
      </ScrollView>
    </View>
  );
}
