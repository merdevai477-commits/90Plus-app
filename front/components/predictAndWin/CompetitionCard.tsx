/**
 * Hub competition card — Figma `Component 16` (`650:5320`), 404×199.
 *
 * Prize photo fills the card; a horizontal wash darkens the sponsor half so the
 * name reads. Sponsor logo sits at (268,17) 91×94, the sponsor block at
 * (258,120) w112, and the delivery badge at (14,16).
 *
 * Inner coordinates are Figma units scaled by the card's own width so the
 * 404×199 proportions hold at every viewport, and the whole layout mirrors with
 * the reading direction. See `PW_GRADIENTS.cardWash` for why the wash is
 * expressed in alpha rather than Figma's `mix-blend-mode: darken`.
 */

import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTranslation } from '../../src/i18n';
import type { CompetitionInfo } from '../../services/competitions.service';
import { IconLocation, IconPickupPin, IconVespaGreen } from './icons';
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
const CARD_H = 199;

/**
 * Every inner coordinate on this card is an absolute Figma offset inside the
 * 404-wide artboard, so they have to scale with the card's *actual* width, not
 * with the global design scale — those diverge below ~350pt where the scale
 * clamp bottoms out but the viewport keeps shrinking.
 */
function useCardMetrics() {
  const { contentWidth, cardScale } = usePWContentWidth();
  return {
    width: contentWidth,
    height: Math.round(CARD_H * cardScale),
    c: (designValue: number) => Math.round(designValue * cardScale),
  };
}

function DeliveryBadge({
  hasDelivery,
  side,
}: {
  hasDelivery: boolean;
  /** Leading edge of the card in the current reading direction. */
  side: { left: number } | { right: number };
}) {
  const { f } = usePWScale();
  const { c } = useCardMetrics();
  const { semibold, medium } = usePWFonts();
  const { t } = useTranslation();
  const badge = t.predictAndWin.badge;

  if (hasDelivery) {
    // Figma `699:2408` — 68×22, #030e02 / #052b0c, radius 17, opacity .63.
    return (
      <View
        style={{
          position: 'absolute',
          ...side,
          top: c(16),
          minWidth: c(68),
          height: c(22),
          paddingHorizontal: c(6),
          borderRadius: c(17),
          backgroundColor: PW.badgeDeliveryBg,
          borderWidth: 1,
          borderColor: PW.badgeDeliveryBorder,
          opacity: 0.63,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: c(2),
        }}
      >
        <Text style={{ fontFamily: medium, fontSize: f(7), color: PW.badgeDeliveryText }}>
          {badge.delivery}
        </Text>
        <IconVespaGreen width={c(12)} height={c(12) * (7.00235 / 10.0004)} />
      </View>
    );
  }

  // Figma `650:5300` — 68×22, rgba(255,255,255,0.06), radius 20.
  return (
    <View
      style={{
        position: 'absolute',
        ...side,
        top: c(16),
        // The English label ("Pickup in store") is wider than the Arabic one
        // Figma sized the pill against, so 68 is a floor rather than a fixed
        // width — the fixed width clipped the label.
        minWidth: c(68),
        height: c(22),
        paddingHorizontal: c(6),
        borderRadius: c(PW_RADII.badge),
        backgroundColor: PW.badgePickupBg,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: c(4),
        overflow: 'hidden',
      }}
    >
      <Text style={{ fontFamily: semibold, fontSize: f(6), color: PW.badgePickupText }}>
        {badge.pickup}
      </Text>
      <IconPickupPin width={c(10.11)} height={c(9.1)} />
    </View>
  );
}

/**
 * Review state, shown only when the competition is not live.
 *
 * `PUBLISHED` (and the later `LOCKED`/`SETTLED`, which the detail screen
 * already explains) draw nothing, so a normal card is untouched.
 */
function StatusBadge({
  status,
  side,
}: {
  status: CompetitionInfo['status'];
  side: { left: number } | { right: number };
}) {
  const { f } = usePWScale();
  const { c } = useCardMetrics();
  const { semibold } = usePWFonts();
  const { t } = useTranslation();

  const copy =
    status === 'DRAFT'
      ? t.predictAndWin.statusState.draft
      : status === 'REJECTED'
        ? t.predictAndWin.statusState.rejected
        : null;
  if (!copy) return null;

  const rejected = status === 'REJECTED';

  return (
    <View
      style={{
        position: 'absolute',
        ...side,
        top: c(16),
        height: c(22),
        paddingHorizontal: c(8),
        borderRadius: c(PW_RADII.badge),
        backgroundColor: rejected ? PW.badgeNoDeliveryBg : 'rgba(107,17,212,0.55)',
        borderWidth: 1,
        borderColor: rejected ? PW.badgeNoDeliveryBorder : PW.medallionBorder,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          fontFamily: semibold,
          fontSize: f(7),
          color: rejected ? PW.badgeNoDeliveryText : PW.text,
        }}
        numberOfLines={1}
      >
        {copy}
      </Text>
    </View>
  );
}

export function CompetitionCard({
  competition,
  onPress,
}: {
  competition: CompetitionInfo;
  onPress: () => void;
}) {
  const { f } = usePWScale();
  const { width, height, c } = useCardMetrics();
  const { bold, regular } = usePWFonts();
  const dir = usePWDirection();
  const sponsor = competition.sponsor;

  /**
   * Figma is drawn in Arabic, where the sponsor block sits on the right and the
   * photo bleeds in from the left. In English the reading order flips, so the
   * whole card is mirrored — the wash direction included — instead of leaving
   * the sponsor block stranded on the wrong side of a left-to-right screen.
   */
  const flip = !dir.isRTL;
  const blockLeft = flip ? width - c(258) - c(112) : c(258);
  const logoLeft = flip ? width - c(268) - c(91) : c(268);
  const badgeSide = flip ? { right: c(14) } : { left: c(14) };

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={sponsor.name}
      style={({ pressed }) => [
        styles.shadow,
        {
          width,
          height,
          borderRadius: c(PW_RADII.card),
          alignSelf: 'center',
          opacity: pressed ? 0.94 : 1,
        },
      ]}
    >
      <View
        collapsable={false}
        style={{
          flex: 1,
          borderRadius: c(PW_RADII.card),
          overflow: 'hidden',
          backgroundColor: PW.detailBg,
        }}
      >
        {competition.prizeImageUrl ? (
          <Image
            source={{ uri: competition.prizeImageUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={150}
            // Without a placeholder colour the card flashes the photo in over a
            // transparent hole while Glide decodes on Android.
            placeholderContentFit="cover"
            recyclingKey={competition.id}
          />
        ) : null}

        {/* See `PW_GRADIENTS.cardWash` for why this no longer uses a blend
            mode: `mixBlendMode` is a no-op below Android API 29, which hid the
            photo behind the wash's opaque stops on every such device. */}
        <LinearGradient
          colors={[...PW_GRADIENTS.cardWash]}
          locations={[...PW_GRADIENTS.cardWashLocations]}
          start={{ x: flip ? 1 : 0, y: 0.5 }}
          end={{ x: flip ? 0 : 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* Sponsor logo — Figma 91×94 at (268,17). */}
        {sponsor.logoUrl ? (
          <Image
            source={{ uri: sponsor.logoUrl }}
            style={{
              position: 'absolute',
              left: logoLeft,
              top: c(17),
              width: c(91),
              height: c(94),
            }}
            contentFit="contain"
            transition={150}
            recyclingKey={sponsor.id}
          />
        ) : null}

        {/* Sponsor block — Figma w112 at (258,120). */}
        <View
          style={{
            position: 'absolute',
            left: blockLeft,
            top: c(120),
            width: c(112),
            gap: c(4),
            alignItems: 'center',
          }}
        >
          <View style={{ width: '100%', gap: c(4) }}>
            <Text
              style={{ fontFamily: bold, fontSize: f(16), color: PW.text, textAlign: 'center' }}
              numberOfLines={1}
            >
              {sponsor.name}
            </Text>
            {sponsor.description ? (
              <Text
                style={{
                  fontFamily: regular,
                  fontSize: f(10),
                  color: PW.textOnCardMuted,
                  textAlign: 'center',
                }}
                numberOfLines={1}
              >
                {sponsor.description}
              </Text>
            ) : null}
          </View>

          {sponsor.address ? (
            <View style={[styles.locationRow, { gap: c(2) }]}>
              <Text
                style={{
                  fontFamily: regular,
                  fontSize: f(10),
                  color: PW.textOnCardMuted,
                  textAlign: 'center',
                  flexShrink: 1,
                }}
                numberOfLines={1}
              >
                {sponsor.address}
              </Text>
              <IconLocation width={c(14)} height={c(14)} />
            </View>
          ) : null}
        </View>

        <DeliveryBadge hasDelivery={sponsor.hasDelivery} side={badgeSide} />

        {/* A sponsor's own submission is created as DRAFT and only they can see
            it (the "تحدياتي" tab). Without saying so the card is indistinguish-
            able from a live challenge, and tapping it would offer a prediction
            on something nobody can enter yet. */}
        <StatusBadge status={competition.status} side={flip ? { left: c(14) } : { right: c(14) }} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Figma `drop-shadow(0 0 8.95px #360763)`.
  shadow: {
    shadowColor: '#360763',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8.95,
    elevation: 8,
  },
  locationRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
});
