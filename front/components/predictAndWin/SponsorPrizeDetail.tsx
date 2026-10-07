/**
 * Sponsor prize page — Figma `1311:17041` (404×703).
 *
 * Every value comes from what the advertiser entered in the create wizard:
 * store name, trade line, logo, country, address and delivery; the prize (name
 * or cash amount), winners count and prediction mode; the match; social links.
 *
 * Figma is drawn in Arabic. Rows use `figmaRow`, which keeps Figma's
 * left-to-right child order in Arabic and mirrors it in English.
 */

import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View, type FlexStyle } from 'react-native';

import TeamBadge from '../common/TeamBadge';
import { useTranslation } from '../../src/i18n';
import type { CompetitionInfo } from '../../services/competitions.service';
import { getSponsorCountryName, sponsorAddressWithoutCountry } from '../../utils/sponsorCountry';
import { PWGradientText } from './GradientText';
import {
  IconCaretDown,
  IconCrown,
  IconDeliveryTruck,
  IconFacebook,
  IconGiftFilled,
  IconInstagram,
  IconLocationFilled,
  IconOpenInNewTab,
  IconShareSolid,
  IconStore,
  IconTimeFill,
  IconTrophy,
  IconUsersSolid,
  IconWhatsapp,
} from './icons';
import { usePWLocalize } from './localize';
import { hasSponsorSocialLinks, PRIZE_CTA_GLASS, prizeCtaKind } from './prizeCta';
import { prizeArtSource } from './PrizeCategoryGrid';
import { shouldShowSponsorLogo, sponsorLogoSource } from './pwAssets';
import { SponsorCountryFlag } from './SponsorCountryFlag';
import { sponsorContactLine } from './sponsorPhone';
import {
  PW,
  PW_GRADIENTS,
  usePWContentWidth,
  usePWDirection,
  usePWFonts,
  usePWScale,
} from './theme';

function useMetrics() {
  const { contentWidth, cardScale } = usePWContentWidth();
  const scale = Number.isFinite(cardScale) && cardScale > 0 ? cardScale : 1;
  return { width: contentWidth, c: (designValue: number) => Math.round(designValue * scale) };
}

function openExternal(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return;
  const href = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  Linking.openURL(href).catch(() => undefined);
}

function openWhatsapp(value: string) {
  const trimmed = value.trim();
  const digits = trimmed.replace(/[^\d]/g, '');
  if (digits.length >= 8 && !/^https?:\/\//i.test(trimmed)) {
    Linking.openURL(`https://wa.me/${digits}`).catch(() => undefined);
    return;
  }
  openExternal(trimmed);
}

function Pill({
  label,
  icon,
  minWidth,
  colors,
  locations,
  start,
  end,
  row,
}: {
  label: string;
  icon?: React.ReactNode;
  minWidth: number;
  colors: readonly [string, string];
  locations?: readonly [number, number];
  start: { x: number; y: number };
  end: { x: number; y: number };
  row: FlexStyle['flexDirection'];
}) {
  const { f } = usePWScale();
  const { c } = useMetrics();
  const { medium } = usePWFonts();
  return (
    <View
      style={{
        minWidth,
        height: c(28),
        paddingHorizontal: c(12),
        borderRadius: 999,
        borderWidth: 0.5,
        borderColor: PW.spPillBorder,
        overflow: 'hidden',
        flexDirection: row,
        alignItems: 'center',
        justifyContent: 'center',
        gap: c(4),
      }}
    >
      <LinearGradient
        colors={[...colors]}
        locations={locations ? [...locations] : undefined}
        start={start}
        end={end}
        style={StyleSheet.absoluteFill}
      />
      <Text style={{ fontFamily: medium, fontSize: f(12), color: PW.spPillText }} numberOfLines={1}>
        {label}
      </Text>
      {icon}
    </View>
  );
}

function Chip({
  label,
  icon,
  row,
  onPress,
}: {
  label: string;
  icon: React.ReactNode;
  row: FlexStyle['flexDirection'];
  onPress?: () => void;
}) {
  const { f } = usePWScale();
  const { c } = useMetrics();
  const { regular } = usePWFonts();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      hitSlop={6}
      style={{ flexDirection: row, alignItems: 'center', gap: c(4), flexShrink: 1, maxWidth: '100%' }}
    >
      <Text
        style={{ fontFamily: regular, fontSize: f(12), color: PW.spChipText, flexShrink: 1 }}
        numberOfLines={1}
      >
        {label}
      </Text>
      {icon}
    </Pressable>
  );
}

function Stat({
  label,
  value,
  icon,
  row,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  row: FlexStyle['flexDirection'];
}) {
  const { f } = usePWScale();
  const { c } = useMetrics();
  const { regular, semibold } = usePWFonts();
  return (
    <View style={{ flexDirection: row, alignItems: 'center', gap: c(4), flexShrink: 1 }}>
      <View style={{ gap: c(4), alignItems: 'center', flexShrink: 1 }}>
        <Text style={{ fontFamily: regular, fontSize: f(7), color: PW.statLabel }} numberOfLines={1}>
          {label}
        </Text>
        <Text style={{ fontFamily: semibold, fontSize: f(10), color: PW.statValue }} numberOfLines={1}>
          {value}
        </Text>
      </View>
      {icon}
    </View>
  );
}

function TeamColumn({ name, logo }: { name: string; logo: string | null }) {
  const { f } = usePWScale();
  const { c } = useMetrics();
  const { medium } = usePWFonts();
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: c(11) }}>
      <TeamBadge name={name} logo={logo ?? undefined} size={c(55)} color="transparent" highQuality />
      <Text
        style={{ fontFamily: medium, fontSize: f(11), color: PW.text, textAlign: 'center' }}
        numberOfLines={1}
      >
        {name}
      </Text>
    </View>
  );
}

export function SponsorPrizeDetail({
  competition,
  remaining,
  ctaLabel,
  ctaDisabled = false,
  onCtaPress,
  onOpenMap,
  onShare,
}: {
  competition: CompetitionInfo;
  remaining: string;
  ctaLabel: string;
  /** Entry is closed (settled/locked/cancelled/past deadline) or in flight. */
  ctaDisabled?: boolean;
  onCtaPress: () => void;
  onOpenMap?: () => void;
  onShare?: () => void;
}) {
  const { f } = usePWScale();
  const { width, c } = useMetrics();
  const { regular, medium, semibold, bold } = usePWFonts();
  const dir = usePWDirection();
  const { locale, formatTime } = usePWLocalize();
  const { t, language } = useTranslation();
  const detail = t.predictAndWin.detail;
  const [expanded, setExpanded] = useState(true);

  const figmaRow: FlexStyle['flexDirection'] = dir.isRTL ? 'row' : 'row-reverse';
  const sponsor = competition.sponsor;
  const links = sponsor.socialLinks;
  const showSocial = hasSponsorSocialLinks(links);
  const showLogo = shouldShowSponsorLogo(sponsor.logoUrl, sponsor.socialLinks);
  const logo = sponsorLogoSource(sponsor.logoUrl, sponsor.socialLinks);
  const countryName = useMemo(() => getSponsorCountryName(sponsor, language), [sponsor, language]);
  const address = sponsorAddressWithoutCountry(sponsor.address);
  const tradeLine = sponsor.description?.trim() || sponsorContactLine(sponsor);

  const kickoff = new Date(competition.matchDate);
  const day = kickoff.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
  const time = formatTime(kickoff);

  const isCash = competition.prizeCashAmount != null && competition.prizeCashAmount > 0;
  const prizeHeadline = isCash
    ? detail.prizeCash.replace('{amount}', String(competition.prizeCashAmount))
    : competition.prizeName;
  const rules = [
    competition.predictionMode === 'WINNER' ? detail.ruleWinner : detail.ruleScore,
    detail.ruleDraw,
    competition.winnersCount > 1
      ? detail.ruleManyWinners.replace('{count}', String(competition.winnersCount))
      : detail.ruleOneWinner,
  ];

  const entry = competition.myEntry;
  const myPrediction = !entry
    ? null
    : entry.predictedHomeScore != null && entry.predictedAwayScore != null
      ? `${entry.predictedHomeScore} - ${entry.predictedAwayScore}`
      : entry.predictedWinner === 'home'
        ? competition.homeTeam
        : entry.predictedWinner === 'away'
          ? competition.awayTeam
          : entry.predictedWinner === 'draw'
            ? detail.draw
            : null;

  const ctaKind = prizeCtaKind(competition);
  const shownCtaLabel =
    ctaKind === 'waiting'
      ? detail.waitingForWinner
      : ctaKind === 'ended'
        ? t.predictAndWin.card.ended
        : ctaKind === 'correct'
          ? detail.correctPrediction
          : ctaKind === 'wrong'
            ? detail.wrongPrediction
            : ctaLabel;
  const ctaInert = ctaDisabled && ctaKind === 'predict';
  const ctaColors = ctaKind === 'predict' ? PW_GRADIENTS.spCta : PRIZE_CTA_GLASS[ctaKind].tint;
  const ctaText = ctaKind === 'predict' ? PW.text : PRIZE_CTA_GLASS[ctaKind].text;

  const divider = <View style={{ width: 1, height: c(29), backgroundColor: PW.statBorder }} />;

  return (
    <View
      style={{
        width,
        alignSelf: 'center',
        backgroundColor: PW.spPageBg,
        borderRadius: c(24),
        paddingHorizontal: c(19),
        paddingTop: c(47),
        paddingBottom: c(25),
      }}
    >
      {/* Pills — Figma `1311:17038`. */}
      <View style={{ flexDirection: figmaRow, alignItems: 'center', justifyContent: 'space-between' }}>
        <Pill
          label={detail.prizeFromStore}
          minWidth={c(135)}
          colors={PW_GRADIENTS.spPillPrize}
          locations={PW_GRADIENTS.spPillPrizeLocations}
          start={{ x: dir.isRTL ? 1 : 0, y: 0 }}
          end={{ x: dir.isRTL ? 0 : 1, y: 0 }}
          row={figmaRow}
        />
        <Pill
          label={detail.sponsoredBy}
          icon={<IconCrown width={c(16)} height={c(16)} />}
          minWidth={c(102)}
          colors={PW_GRADIENTS.spPillSponsor}
          start={{ x: 0, y: 1 }}
          end={{ x: 0, y: 0 }}
          row={figmaRow}
        />
      </View>

      {/* Store row — Figma `1311:16233`: prize art, store copy, store logo. */}
      <View style={{ flexDirection: figmaRow, alignItems: 'center', gap: c(8), marginTop: c(11) }}>
        <Image
          source={prizeArtSource(competition)}
          style={{ width: c(56), height: c(50) }}
          contentFit="contain"
          transition={150}
        />
        <View
          style={{
            flex: 1,
            flexDirection: figmaRow,
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: c(12),
          }}
        >
          <View style={{ flexShrink: 1, alignItems: dir.alignStart, gap: c(10) }}>
            <View style={{ alignItems: dir.alignStart, gap: c(2) }}>
              <Text
                style={{ fontFamily: bold, fontSize: f(16), color: PW.text, textAlign: dir.textAlign }}
                numberOfLines={1}
              >
                {sponsor.name}
              </Text>
              {tradeLine ? (
                <Text
                  style={{
                    fontFamily: regular,
                    fontSize: f(11),
                    color: PW.spStoreDesc,
                    textAlign: dir.textAlign,
                  }}
                  numberOfLines={2}
                >
                  {tradeLine}
                </Text>
              ) : null}
            </View>
            <View
              style={{
                flexDirection: figmaRow,
                flexWrap: 'wrap',
                justifyContent: 'flex-end',
                alignItems: 'center',
                columnGap: c(12),
                rowGap: c(4),
              }}
            >
              {countryName ? (
                <Chip
                  label={countryName}
                  icon={<SponsorCountryFlag sponsor={sponsor} size={c(14)} />}
                  row={figmaRow}
                />
              ) : null}
              {address ? (
                <Chip
                  label={address}
                  icon={<IconLocationFilled width={c(14)} height={c(14)} />}
                  row={figmaRow}
                  onPress={onOpenMap}
                />
              ) : null}
              <Chip
                label={sponsor.hasDelivery ? detail.deliveryChip : detail.pickupChip}
                icon={
                  sponsor.hasDelivery ? (
                    <IconDeliveryTruck width={c(14)} height={c(14)} />
                  ) : (
                    <IconStore width={c(14)} height={c(14)} />
                  )
                }
                row={figmaRow}
              />
            </View>
          </View>
          {showLogo && logo ? (
            <Image
              source={logo}
              style={{ width: c(58), height: c(59) }}
              contentFit="contain"
              transition={150}
            />
          ) : null}
        </View>
      </View>

      {/* Info tiles — Figma `1311:16250`. */}
      <View style={{ flexDirection: figmaRow, gap: c(12), marginTop: c(24) }}>
        <View style={[styles.tile, { minHeight: c(113), borderRadius: c(14), paddingHorizontal: c(13), gap: c(11) }]}>
          <LinearGradient colors={[...PW_GRADIENTS.spTile]} style={StyleSheet.absoluteFill} />
          <View style={{ flexDirection: figmaRow, alignSelf: 'stretch', justifyContent: 'flex-end', gap: c(8) }}>
            <Text style={{ fontFamily: semibold, fontSize: f(11), color: PW.vsTop }}>{detail.howToWin}</Text>
            <IconTrophy width={c(16)} height={c(16)} />
          </View>
          <View style={{ alignSelf: 'stretch', alignItems: dir.alignStart, gap: c(11) }}>
            {rules.map((rule) => (
              <View key={rule} style={{ flexDirection: figmaRow, alignItems: 'center', gap: c(6) }}>
                <Text
                  style={{ fontFamily: medium, fontSize: f(11), color: PW.spTileBody, flexShrink: 1 }}
                  numberOfLines={1}
                >
                  {rule}
                </Text>
                <Text style={{ fontFamily: medium, fontSize: f(11), color: PW.spTileBody }}>•</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.tile, { minHeight: c(113), borderRadius: c(14), paddingHorizontal: c(10), gap: c(11) }]}>
          <LinearGradient colors={[...PW_GRADIENTS.spTile]} style={StyleSheet.absoluteFill} />
          <Text style={{ fontFamily: medium, fontSize: f(11), color: PW.text, textAlign: 'center' }}>
            {detail.prizeLabel}
          </Text>
          <Text
            style={{ fontFamily: bold, fontSize: f(20), color: PW.vsTop, textAlign: 'center' }}
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {prizeHeadline}
          </Text>
          <Text style={{ fontFamily: medium, fontSize: f(11), color: PW.text, textAlign: 'center' }}>
            {competition.winnersCount > 1 ? detail.prizeForEachWinner : detail.prizeForWinner}
          </Text>
        </View>
      </View>

      {/* Match card — Figma `1311:16311`. The caret folds the match away. */}
      <View
        style={{
          marginTop: c(22),
          backgroundColor: PW.spPanel,
          borderRadius: c(16),
          paddingVertical: c(19),
        }}
      >
        <Pressable
          onPress={() => setExpanded((open) => !open)}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          style={{ height: c(24), justifyContent: 'center', paddingHorizontal: c(14) }}
        >
          <Text style={{ fontFamily: medium, fontSize: f(12), color: PW.text, textAlign: 'center' }}>
            {competition.predictionMode === 'WINNER' ? detail.ruleWinner : detail.sheetTitle}
          </Text>
          <View
            style={{
              position: 'absolute',
              [dir.isRTL ? 'left' : 'right']: c(14),
              transform: [{ rotate: expanded ? '0deg' : '180deg' }],
            }}
          >
            <IconCaretDown width={c(24)} height={c(24)} />
          </View>
        </Pressable>

        {expanded ? (
          <View style={{ marginTop: c(37), paddingHorizontal: c(19) }}>
            <View
              style={{
                // Same home/away sides as the hub card and the prediction sheet.
                flexDirection: dir.isRTL ? 'row' : 'row-reverse',
                alignItems: 'center',
                gap: c(24),
              }}
            >
              <TeamColumn name={competition.homeTeam} logo={competition.homeTeamLogo} />
              <View style={{ minWidth: c(71), alignItems: 'center', gap: c(6) }}>
                <Text style={{ fontFamily: regular, fontSize: f(11), color: PW.spDay }} numberOfLines={1}>
                  {day}
                </Text>
                <PWGradientText
                  colors={[PW.vsTop, PW.vsBottom]}
                  style={{ fontFamily: medium, fontSize: f(36), color: PW.vsTop, textAlign: 'center' }}
                >
                  VS
                </PWGradientText>
                <Text style={{ fontFamily: semibold, fontSize: f(13), color: PW.spTime }} numberOfLines={1}>
                  {time}
                </Text>
                {myPrediction ? (
                  <Text style={{ fontFamily: medium, fontSize: f(10), color: PW.statLabel }} numberOfLines={1}>
                    {`${detail.yourPrediction}: ${myPrediction}`}
                  </Text>
                ) : null}
              </View>
              <TeamColumn name={competition.awayTeam} logo={competition.awayTeamLogo} />
            </View>

            <View
              style={{
                marginTop: c(11),
                minHeight: c(47),
                backgroundColor: PW.statBg,
                borderWidth: 0.5,
                borderColor: PW.statBorder,
                borderRadius: c(10),
                paddingLeft: dir.isRTL ? c(23) : c(13),
                paddingRight: dir.isRTL ? c(13) : c(23),
                paddingVertical: c(6),
                flexDirection: figmaRow,
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: c(4),
              }}
            >
              <Stat
                label={detail.participants}
                value={String(competition.participantsCount)}
                icon={<IconUsersSolid width={c(23.75)} height={c(19)} />}
                row={figmaRow}
              />
              {divider}
              <Stat
                label={detail.prizesAvailable}
                value={String(competition.winnersCount)}
                icon={<IconGiftFilled width={c(19)} height={c(19)} />}
                row={figmaRow}
              />
              {divider}
              <Stat
                label={detail.timeLeft}
                value={remaining}
                icon={<IconTimeFill width={c(19)} height={c(19)} />}
                row={figmaRow}
              />
            </View>

            <Pressable
              onPress={onCtaPress}
              disabled={ctaInert}
              accessibilityRole="button"
              accessibilityState={{ disabled: ctaInert }}
              accessibilityLabel={shownCtaLabel}
              style={{
                marginTop: c(23),
                height: c(48),
                borderRadius: c(16),
                overflow: 'hidden',
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: c(23),
                opacity: ctaInert ? 0.45 : 1,
              }}
            >
              <LinearGradient colors={[...ctaColors]} style={StyleSheet.absoluteFill} />
              <Text
                style={{ fontFamily: bold, fontSize: f(14), color: ctaText, textAlign: 'center' }}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                {shownCtaLabel}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      {/* Action bar — Figma `1311:17042`. */}
      <View
        style={{
          marginTop: c(12),
          backgroundColor: PW.spPanel,
          borderRadius: c(12),
          paddingVertical: c(9),
          paddingHorizontal: c(12),
          flexDirection: figmaRow,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Pressable
          onPress={onOpenMap}
          // Sponsors are not required to have an address; without one there is nothing to open.
          disabled={!sponsor.address}
          accessibilityRole="button"
          accessibilityState={{ disabled: !sponsor.address }}
          hitSlop={6}
          style={{
            flexDirection: figmaRow,
            alignItems: 'center',
            gap: c(4),
            paddingHorizontal: c(14),
            minHeight: c(20),
            opacity: sponsor.address ? 1 : 0.45,
          }}
        >
          <Text style={{ fontFamily: medium, fontSize: f(12), color: PW.spAction }}>{detail.openMap}</Text>
          <IconOpenInNewTab width={c(16)} height={c(16)} />
        </Pressable>

        {showSocial ? (
          <View style={{ flexDirection: figmaRow, alignItems: 'center', gap: c(14) }}>
            {links?.facebook ? (
              <Pressable
                onPress={() => openExternal(links.facebook!)}
                hitSlop={8}
                accessibilityRole="link"
                accessibilityLabel="Facebook"
              >
                <IconFacebook width={c(18)} height={c(18)} />
              </Pressable>
            ) : null}
            {links?.instagram ? (
              <Pressable
                onPress={() => openExternal(links.instagram!)}
                hitSlop={8}
                accessibilityRole="link"
                accessibilityLabel="Instagram"
              >
                <IconInstagram width={c(18)} height={c(18)} />
              </Pressable>
            ) : null}
            {links?.whatsapp ? (
              <Pressable
                onPress={() => openWhatsapp(links.whatsapp!)}
                hitSlop={8}
                accessibilityRole="link"
                accessibilityLabel="WhatsApp"
              >
                <IconWhatsapp width={c(18)} height={c(18)} />
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <Pressable
          onPress={onShare}
          disabled={!onShare}
          accessibilityRole="button"
          hitSlop={6}
          style={{ flexDirection: figmaRow, alignItems: 'center', gap: c(4), paddingHorizontal: c(14) }}
        >
          <Text style={{ fontFamily: medium, fontSize: f(12), color: PW.spAction }}>{detail.share}</Text>
          <IconShareSolid width={c(20)} height={c(20)} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: PW.spTileBorder,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
});
