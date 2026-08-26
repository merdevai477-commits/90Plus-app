/**
 * Competition detail / preview card — Figma `Component 16` variant
 * `Frame 360` (`650:5319`), 404×355.
 *
 * bg #06030c, 1px #1a1a1a, radius 24, shadow 0 4 4 rgba(0,0,0,.25).
 * Layout (raw Figma units, scaled at render):
 *   title block   centred, y43,  w143 — 8/21/8 stack, headline #700bd0
 *   prize art     (26,18)  78×80, tripled behind itself with a 6.05 blur glow
 *   sponsor logo  (291,8)  101.57×102
 *   sponsor block (8,109)  w112
 *   "فتح الموقع"  (9,175)  109×27   ·  delivery (11,207) 109×55
 *   social        (11,250) 109×55   ·  match row (128,128) 259×68
 *   stats bar     (128.6,208.1) 265.4×47.3
 *   CTA           (128.6,262.3) 265.4×47.2
 *   wide map btn  (12,315)  379×27
 */

import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import TeamBadge from '../common/TeamBadge';
import { PWGradientText } from './GradientText';
import { useTranslation } from '../../src/i18n';
import type { CompetitionInfo } from '../../services/competitions.service';
import {
  IconFacebook,
  IconGiftFilled,
  IconInstagram,
  IconLocation,
  IconMapFill,
  IconTimeFill,
  IconUsersSolid,
  IconVespaDetail,
  IconWhatsapp,
} from './icons';
import { usePWLocalize } from './localize';
import {
  PW,
  PW_CONTENT_W,
  PW_GRADIENTS,
  PW_RADII,
  usePWContentWidth,
  usePWDirection,
  usePWFonts,
  usePWScale,
} from './theme';

const CARD_W = PW_CONTENT_W;
const CARD_H = 355;

/**
 * The card is a fixed 404×355 Figma frame whose children are absolutely
 * positioned, so both the sizes and the offsets have to scale with the card's
 * real width — and the offsets have to mirror when the app reads left to
 * right, or the sponsor column ends up on the wrong edge in English.
 */
function useDetailMetrics() {
  const { contentWidth, cardScale } = usePWContentWidth();
  const { isRTL } = usePWDirection();
  const c = (designValue: number) => Math.round(designValue * cardScale);
  return {
    width: contentWidth,
    height: Math.round(CARD_H * cardScale),
    c,
    /** Mirrors a Figma `left` offset for a child of the given design width. */
    x: (left: number, childWidth: number) =>
      isRTL ? c(left) : contentWidth - c(left) - c(childWidth),
  };
}

function Stat({
  label,
  value,
  icon,
  width,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  width: number;
}) {
  const { s, f } = usePWScale();
  const { regular, semibold } = usePWFonts();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4) }}>
      <View style={{ width: s(width), gap: s(4) }}>
        <Text
          style={{ fontFamily: regular, fontSize: f(7), color: PW.statLabel, textAlign: 'center' }}
          numberOfLines={1}
        >
          {label}
        </Text>
        <Text
          style={{ fontFamily: semibold, fontSize: f(10), color: PW.statValue, textAlign: 'center' }}
          numberOfLines={1}
        >
          {value}
        </Text>
      </View>
      {icon}
    </View>
  );
}

export function CompetitionDetailCard({
  competition,
  remaining,
  onCtaPress,
  ctaLabel,
  /** Entry is closed (settled/locked/cancelled/past deadline) or in flight. */
  ctaDisabled = false,
  onOpenMap,
}: {
  competition: CompetitionInfo;
  remaining: string;
  onCtaPress: () => void;
  ctaLabel: string;
  ctaDisabled?: boolean;
  onOpenMap?: () => void;
}) {
  const { s, f } = usePWScale();
  const { width: cardWidth, height: cardHeight, c, x } = useDetailMetrics();
  const { regular, medium, semibold } = usePWFonts();
  const dir = usePWDirection();
  const { formatDayMonth, formatTime } = usePWLocalize();
  const { t } = useTranslation();
  const detail = t.predictAndWin.detail;
  const sponsor = competition.sponsor;

  const kickoff = new Date(competition.matchDate);
  // `'ar-EG'` was hardcoded here, so the English build printed Arabic month
  // names and Arabic-Indic digits for every kickoff.
  const day = formatDayMonth(kickoff);
  const time = formatTime(kickoff);

  const divider = (
    <View style={{ width: 1, height: s(29), backgroundColor: PW.statBorder }} />
  );

  return (
    <View
      style={[
        styles.card,
        {
          width: cardWidth,
          height: cardHeight,
          borderRadius: c(PW_RADII.detail),
          alignSelf: 'center',
        },
      ]}
    >
      {/* Prize artwork with the tripled blur glow (Figma `640:4817`). */}
      {competition.prizeImageUrl ? (
        <>
          <Image
            source={{ uri: competition.prizeImageUrl }}
            style={{
              position: 'absolute',
              left: x(26, 78),
              top: c(18),
              width: c(78),
              height: c(80),
              opacity: 0.9,
            }}
            contentFit="contain"
            blurRadius={6}
          />
          <Image
            source={{ uri: competition.prizeImageUrl }}
            style={{
              position: 'absolute',
              left: x(26, 78),
              top: c(18),
              width: c(78),
              height: c(80),
            }}
            contentFit="contain"
          />
        </>
      ) : null}

      {/* Sponsor logo — Figma 101.57×102 at (291,8). */}
      {sponsor.logoUrl ? (
        <Image
          source={{ uri: sponsor.logoUrl }}
          style={{
            position: 'absolute',
            left: x(291, 101.57),
            top: c(8),
            width: c(101.57),
            height: c(102),
          }}
          contentFit="contain"
        />
      ) : null}

      {/* Headline stack — centred, y43, w143. */}
      <View
        style={{
          position: 'absolute',
          top: c(43),
          alignSelf: 'center',
          width: c(143),
          gap: s(3),
          alignItems: 'center',
        }}
      >
        <Text style={{ fontFamily: regular, fontSize: f(8), color: '#999', textAlign: 'center' }}>
          {detail.predictTitle}
        </Text>
        <Text
          style={{
            fontFamily: semibold,
            fontSize: f(21),
            color: PW.detailTitle,
            textAlign: 'center',
          }}
          numberOfLines={2}
        >
          {competition.prizeName}
        </Text>
        <Text
          style={{ fontFamily: medium, fontSize: f(8), color: '#d8d8d8', textAlign: 'center' }}
          numberOfLines={1}
        >
          {t.predictAndWin.card.by.replace('{sponsor}', sponsor.name)}
        </Text>
      </View>

      {/* Sponsor block — Figma w112 at (8,109). */}
      <View
        style={{
          position: 'absolute',
          left: x(8, 112),
          top: c(109),
          width: c(112),
          gap: s(4),
          alignItems: 'center',
        }}
      >
        <Text
          style={{ fontFamily: semibold, fontSize: f(13), color: PW.text, textAlign: 'center' }}
          numberOfLines={1}
        >
          {sponsor.name}
        </Text>
        {sponsor.description ? (
          <Text
            style={{
              fontFamily: regular,
              fontSize: f(11),
              color: PW.textOnCardMuted,
              textAlign: 'center',
            }}
            numberOfLines={1}
          >
            {sponsor.description}
          </Text>
        ) : null}
        {sponsor.address ? (
          <View style={[styles.locationRow, { flexDirection: 'row' }]}>
            <Text
              style={{
                fontFamily: regular,
                fontSize: f(11),
                color: PW.textOnCardMuted,
                flexShrink: 1,
                textAlign: 'center',
              }}
              numberOfLines={1}
            >
              {sponsor.address}
            </Text>
            <IconLocation width={s(14)} height={s(14)} />
          </View>
        ) : null}
      </View>

      {/* "فتح الموقع" — Figma 109×27 at (9,175). */}
      <Pressable
        onPress={onOpenMap}
        style={[
          styles.chip,
          {
            left: x(9, 109),
            top: c(175),
            width: c(109),
            height: c(27),
            borderRadius: c(PW_RADII.chip),
            gap: c(4),
          },
        ]}
      >
        <Text style={{ fontFamily: medium, fontSize: f(9), color: PW.textOnCardMuted }}>
          {detail.openMap}
        </Text>
        <IconMapFill width={s(14)} height={s(14)} />
      </Pressable>

      {/* Delivery block — Figma 109×55 at (11,207). */}
      <View
        style={{
          position: 'absolute',
          left: x(11, 109),
          top: c(207),
          width: c(109),
          height: c(55),
          backgroundColor: PW.detailDeliveryBg,
          borderWidth: 1,
          borderColor: PW.detailDeliveryBorder,
          borderTopLeftRadius: s(10),
          borderTopRightRadius: s(10),
          borderBottomLeftRadius: s(PW_RADII.chip),
          borderBottomRightRadius: s(PW_RADII.chip),
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View style={{ width: s(66), gap: s(2) }}>
          <Text style={styles.tiny(f(7), '#dfdfdf', medium)} numberOfLines={1}>
            {detail.deliveryLabel}
          </Text>
          <Text
            style={styles.tiny(
              f(7),
              sponsor.hasDelivery ? PW.badgeDeliveryText : PW.detailDeliveryOff,
              medium,
            )}
            numberOfLines={1}
          >
            {sponsor.hasDelivery ? detail.deliveryOn : detail.deliveryOff}
          </Text>
          <Text style={styles.tiny(f(7), '#dfdfdf', medium)} numberOfLines={2}>
            {sponsor.hasDelivery ? detail.deliveryNote : detail.pickupNote}
          </Text>
        </View>
        <IconVespaDetail width={s(33)} height={s(33) * (19.2565 / 27.5011)} />
      </View>

      {/* Social block — Figma 109×55 at (11,250). */}
      <View
        style={{
          position: 'absolute',
          left: x(11, 109),
          top: c(250),
          width: c(109),
          height: c(55),
          backgroundColor: PW.detailSocialBg,
          borderLeftWidth: 1,
          borderRightWidth: 1,
          borderBottomWidth: 1,
          borderColor: PW.detailChipBorder,
          borderBottomLeftRadius: s(10),
          borderBottomRightRadius: s(10),
          paddingBottom: s(7),
          gap: s(9),
          alignItems: 'center',
          justifyContent: 'flex-end',
        }}
      >
        <Text style={styles.tiny(f(7), '#dfdfdf', medium)}>{detail.socialLinks}</Text>
        <View style={styles.socialRow(s(14))}>
          <IconFacebook width={s(14)} height={s(14)} />
          <IconInstagram width={s(14)} height={s(14)} />
          <IconWhatsapp width={s(14)} height={s(14)} />
        </View>
      </View>

      {/* Match row — Figma 259×68 at (128,128). */}
      <View
        style={{
          position: 'absolute',
          left: x(128, 259),
          top: c(128),
          width: c(259),
          height: c(68),
          borderRadius: c(PW_RADII.card),
          paddingHorizontal: c(12),
          // Figma is drawn in Arabic, where home is the right-hand crest.
          flexDirection: dir.isRTL ? 'row' : 'row-reverse',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View style={{ width: s(53), gap: s(9), alignItems: 'center' }}>
          <TeamBadge
            name={competition.homeTeam}
            logo={competition.homeTeamLogo ?? undefined}
            size={s(32)}
            color="transparent"
          />
          <Text style={styles.tiny(f(9), PW.text, regular)} numberOfLines={1}>
            {competition.homeTeam}
          </Text>
        </View>

        <View style={{ width: s(64), gap: s(4), alignItems: 'center' }}>
          <Text style={styles.tiny(f(9), '#c2c2c2', medium)} numberOfLines={1}>
            {day}
          </Text>
          <PWGradientText colors={[PW.vsTop, PW.vsBottom]} style={styles.tiny(f(11), PW.vsTop, semibold)}>
            VS
          </PWGradientText>
          <Text style={styles.tiny(f(14), PW.text, semibold)} numberOfLines={1}>
            {time}
          </Text>
        </View>

        <View style={{ width: s(45), gap: s(9), alignItems: 'center' }}>
          <TeamBadge
            name={competition.awayTeam}
            logo={competition.awayTeamLogo ?? undefined}
            size={s(32)}
            color="transparent"
          />
          <Text style={styles.tiny(f(9), PW.text, regular)} numberOfLines={1}>
            {competition.awayTeam}
          </Text>
        </View>
      </View>

      {/* Stats bar — Figma 265.4×47.3 at (128.6,208.1). */}
      <View
        style={{
          position: 'absolute',
          left: x(128.6, 265.4),
          top: c(208.1),
          width: c(265.4),
          height: c(47.3),
          backgroundColor: PW.statBg,
          borderWidth: 1,
          borderColor: PW.statBorder,
          borderRadius: s(10),
          paddingLeft: s(23),
          paddingRight: s(13),
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: s(4),
        }}
      >
        <Stat
          label={detail.participants}
          value={String(competition.participantsCount)}
          width={32}
          icon={<IconUsersSolid width={s(23.75)} height={s(19)} />}
        />
        {divider}
        <Stat
          label={detail.prizesAvailable}
          value={String(competition.winnersCount)}
          width={41}
          icon={<IconGiftFilled width={s(19)} height={s(19)} />}
        />
        {divider}
        <Stat
          label={detail.timeLeft}
          value={remaining}
          width={78}
          icon={<IconTimeFill width={s(19)} height={s(19)} />}
        />
      </View>

      {/* CTA — Figma 265.4×47.2 at (128.6,262.3). */}
      <Pressable
        onPress={onCtaPress}
        disabled={ctaDisabled}
        accessibilityRole="button"
        accessibilityState={{ disabled: ctaDisabled }}
        accessibilityLabel={ctaLabel}
        style={{
          position: 'absolute',
          left: x(128.6, 265.4),
          top: c(262.3),
          width: c(265.4),
          height: c(47.2),
          // A closed competition still draws the CTA (Figma has no separate
          // frame for it) but must not look or behave tappable.
          opacity: ctaDisabled ? 0.45 : 1,
        }}
      >
        <LinearGradient
          colors={[...PW_GRADIENTS.cta]}
          style={{
            flex: 1,
            borderRadius: s(10),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{ fontFamily: semibold, fontSize: f(13), color: PW.text }}
            numberOfLines={1}
          >
            {ctaLabel}
          </Text>
        </LinearGradient>
      </Pressable>

      {/* Wide map button — Figma 379×27 at (12,315). */}
      <Pressable
        onPress={onOpenMap}
        // Sponsors are not required to have an address; without one the button
        // would open nothing, so it is inert rather than silently broken.
        disabled={!sponsor.address}
        accessibilityRole="button"
        accessibilityState={{ disabled: !sponsor.address }}
        style={[
          styles.chip,
          {
            left: x(12, 379),
            top: c(315),
            width: c(379),
            height: c(27),
            borderRadius: c(PW_RADII.chip),
            gap: c(4),
            opacity: sponsor.address ? 1 : 0.45,
          },
        ]}
      >
        <Text style={{ fontFamily: medium, fontSize: f(9), color: PW.textOnCardMuted }}>
          {detail.openMap}
        </Text>
        <IconMapFill width={s(14)} height={s(14)} />
      </Pressable>
    </View>
  );
}

const styles = {
  card: {
    backgroundColor: PW.detailBg,
    borderWidth: 1,
    borderColor: PW.detailBorder,
    overflow: 'hidden' as const,
    shadowColor: 'rgba(0,0,0,0.25)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 4,
  },
  locationRow: {
    width: '100%' as const,
    alignItems: 'center' as const,
    justifyContent: 'flex-end' as const,
    gap: 2,
  },
  chip: {
    position: 'absolute' as const,
    backgroundColor: PW.detailChip,
    borderWidth: 0.5,
    borderColor: PW.detailChipBorder,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  socialRow: (size: number) => ({
    width: '100%' as const,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: size,
  }),
  tiny: (fontSize: number, color: string, fontFamily: string) => ({
    fontSize,
    color,
    fontFamily,
    textAlign: 'center' as const,
    width: '100%' as const,
  }),
};
