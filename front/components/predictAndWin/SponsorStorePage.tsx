/**
 * Sponsor store page — Figma `1318:17057` (448×1191).
 *
 * Opened when the user taps the store/sponsor block on a hub card.
 * Prediction stays on the hub via `PredictScoreModal`.
 */

import { useAuth } from '@clerk/clerk-expo';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
  type FlexStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTranslation } from '../../src/i18n';
import { CompetitionsService, type CompetitionInfo } from '../../services/competitions.service';
import { getSponsorCountryName, sponsorAddressWithoutCountry } from '../../utils/sponsorCountry';
import { logger } from '../../utils/logger';
import { IconArrowBack, IconFacebook, IconInstagram, IconLocationFilled, IconShareSolid, IconWhatsapp } from './icons';
import { hasSponsorSocialLinks } from './prizeCta';
import { shouldShowSponsorLogo, sponsorLogoSource } from './pwAssets';
import { sponsorPhoneLine } from './sponsorPhone';
import { STORE_HERO, STORE_MAP_PREVIEW } from './storePageAssets';
import {
  IconStoreAlt,
  IconStoreAuthentic,
  IconStoreCash,
  IconStoreFollow,
  IconStoreMapBtn,
  IconStoreMapPinLg,
  IconStoreMenu,
  IconStorePhone,
  IconStorePhoneTitle,
  IconStoreShoes,
  IconStoreStar,
  IconStoreTime,
  IconStoreTruckGreen,
  IconStoreVerified,
} from './storePageIcons';
import {
  PW,
  usePWContentWidth,
  usePWDirection,
  usePWFonts,
  usePWScale,
} from './theme';

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

function openTel(phone: string) {
  const digits = phone.replace(/[^\d+]/g, '');
  if (!digits) return;
  Linking.openURL(`tel:${digits}`).catch(() => undefined);
}

function FeatureChip({
  label,
  icon,
  row,
  tone,
}: {
  label: string;
  icon: React.ReactNode;
  row: FlexStyle['flexDirection'];
  tone: 'delivery' | 'neutral';
}) {
  const { f } = usePWScale();
  const { medium } = usePWFonts();
  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        backgroundColor: tone === 'delivery' ? '#040F03' : '#160C2D',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 9,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View style={{ flexDirection: row, alignItems: 'center', gap: 4 }}>
        <Text
          style={{
            fontFamily: medium,
            fontSize: f(12),
            color: tone === 'delivery' ? '#3DA437' : '#D7D7D7',
            textAlign: 'right',
          }}
          numberOfLines={1}
        >
          {label}
        </Text>
        {icon}
      </View>
    </View>
  );
}

function SocialSquare({
  onPress,
  label,
  children,
  width,
}: {
  onPress: () => void;
  label: string;
  children: React.ReactNode;
  width: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={label}
      style={{
        width,
        height: 42,
        borderRadius: 8,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#250A3F',
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <LinearGradient colors={['#200D44', '#170D2B']} style={StyleSheet.absoluteFill} />
      {children}
    </Pressable>
  );
}

export function SponsorStorePage({
  competition,
  onBack,
  onShare,
  onOpenMap,
}: {
  competition: CompetitionInfo;
  onBack: () => void;
  onShare?: () => void;
  onOpenMap?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { f } = usePWScale();
  const { contentWidth, cardScale } = usePWContentWidth();
  const c = (n: number) => Math.round(n * (Number.isFinite(cardScale) && cardScale > 0 ? cardScale : 1));
  const { regular, medium, semibold, bold } = usePWFonts();
  const dir = usePWDirection();
  const { t, language } = useTranslation();
  const store = t.predictAndWin.store;
  const detail = t.predictAndWin.detail;
  const { getToken, isSignedIn } = useAuth();
  const router = useRouter();

  const figmaRow: FlexStyle['flexDirection'] = dir.isRTL ? 'row' : 'row-reverse';
  const sponsor = competition.sponsor;
  const links = sponsor.socialLinks;
  const showSocial = hasSponsorSocialLinks(links);
  const showLogo = shouldShowSponsorLogo(sponsor.logoUrl, sponsor.socialLinks);
  const logo = sponsorLogoSource(sponsor.logoUrl, sponsor.socialLinks);
  const countryName = useMemo(() => getSponsorCountryName(sponsor, language), [sponsor, language]);
  const addressLine = sponsorAddressWithoutCountry(sponsor.address);
  const phone = sponsorPhoneLine(links);
  const about = sponsor.description?.trim() || null;

  const locationSummary = useMemo(() => {
    const bits = [countryName, addressLine].filter(Boolean);
    if (bits.length) return bits.join(' - ');
    return sponsor.address?.trim() || null;
  }, [countryName, addressLine, sponsor.address]);

  const [following, setFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isSignedIn) {
        if (!cancelled) setFollowing(false);
        return;
      }
      try {
        const token = await getToken();
        if (!token || cancelled) return;
        const status = await CompetitionsService.getSponsorFollow(token, sponsor.id);
        if (!cancelled) setFollowing(Boolean(status.following));
      } catch (err) {
        logger.warn('[SponsorStorePage] follow status failed:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, isSignedIn, sponsor.id]);

  const onFollowPress = useCallback(async () => {
    if (followBusy) return;
    if (!isSignedIn) {
      router.push('/auth');
      return;
    }
    setFollowBusy(true);
    const next = !following;
    setFollowing(next);
    try {
      const token = await getToken();
      if (!token) throw new Error('AUTH_REQUIRED');
      if (next) await CompetitionsService.followSponsor(token, sponsor.id);
      else await CompetitionsService.unfollowSponsor(token, sponsor.id);
    } catch (err) {
      setFollowing(!next);
      logger.warn('[SponsorStorePage] follow toggle failed:', err);
    } finally {
      setFollowBusy(false);
    }
  }, [followBusy, following, getToken, isSignedIn, router, sponsor.id]);

  const followLabel = !isSignedIn
    ? store.follow
    : following
      ? store.following
      : store.follow;

  const width = contentWidth;

  return (
    <View style={{ width, alignSelf: 'center' }}>
      {/* Hero */}
      <View style={{ height: c(371), marginHorizontal: c(-22), overflow: 'hidden' }}>
        <Image source={STORE_HERO} style={StyleSheet.absoluteFillObject} contentFit="cover" />
        <LinearGradient
          colors={['rgba(233,233,233,0)', '#030303']}
          locations={[0, 0.77]}
          style={StyleSheet.absoluteFill}
        />

        {/* Top chrome — Figma `1318:17125`. */}
        <View
          style={{
            paddingTop: Math.max(insets.top, 10) + c(10),
            paddingHorizontal: c(24),
            height: Math.max(insets.top, 10) + c(66),
            justifyContent: 'center',
          }}
        >
          <View style={{ flexDirection: dir.row, alignItems: 'center', justifyContent: 'space-between' }}>
            <Pressable onPress={onBack} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
              <IconArrowBack width={c(38)} height={c(38)} />
            </Pressable>
            <View style={{ flexDirection: dir.row, alignItems: 'center', gap: c(24) }}>
              <Pressable onPress={onShare} disabled={!onShare} hitSlop={8} accessibilityRole="button">
                <IconShareSolid width={c(24)} height={c(24)} />
              </Pressable>
              <Pressable onPress={onShare} disabled={!onShare} hitSlop={8} accessibilityRole="button">
                <IconStoreMenu width={c(24)} height={c(24)} />
              </Pressable>
            </View>
          </View>
        </View>
      </View>

      {/* Identity + actions — overlays the lower hero. */}
      <View style={{ marginTop: c(-120), paddingHorizontal: 0, gap: c(21) }}>
        <View style={{ flexDirection: figmaRow, alignItems: 'flex-start', gap: c(12) }}>
          <View style={{ flex: 1, alignItems: dir.alignStart, gap: c(12) }}>
            <View style={{ alignItems: dir.alignStart, gap: c(6) }}>
              <View style={{ flexDirection: figmaRow, alignItems: 'center', gap: c(8) }}>
                {sponsor.isVerified ? <IconStoreVerified width={c(16)} height={c(16)} /> : null}
                <Text
                  style={{ fontFamily: bold, fontSize: f(16), color: PW.text, textAlign: dir.textAlign }}
                  numberOfLines={1}
                >
                  {sponsor.name}
                </Text>
              </View>
              <View
                style={{
                  flexDirection: figmaRow,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: c(4),
                  height: c(26),
                  paddingHorizontal: c(10),
                  borderRadius: 91,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: 'rgba(79,48,143,0.39)',
                  overflow: 'hidden',
                }}
              >
                <LinearGradient
                  colors={['rgba(139,92,246,0.14)', 'rgba(62,12,176,0.14)']}
                  style={StyleSheet.absoluteFill}
                />
                <Text style={{ fontFamily: medium, fontSize: f(12), color: '#C58BFC' }}>{store.categoryBadge}</Text>
                <IconStoreShoes width={c(16)} height={c(16)} />
              </View>
            </View>

            <View style={{ alignItems: dir.alignStart, gap: c(8) }}>
              <View style={{ flexDirection: figmaRow, alignItems: 'center', gap: c(4) }}>
                <Text style={{ fontFamily: medium, fontSize: f(14), color: '#CECECE' }}>{store.ratingLabel}</Text>
                <Text style={{ fontFamily: medium, fontSize: f(15), color: PW.text }}>(4.5)</Text>
                <IconStoreStar width={c(16)} height={c(16)} />
              </View>
              {locationSummary ? (
                <Pressable
                  onPress={onOpenMap}
                  disabled={!onOpenMap || !sponsor.address}
                  style={{ flexDirection: figmaRow, alignItems: 'center', gap: c(4) }}
                >
                  <Text
                    style={{
                      fontFamily: regular,
                      fontSize: f(14),
                      color: '#D7AFFE',
                      textAlign: dir.textAlign,
                      flexShrink: 1,
                    }}
                    numberOfLines={2}
                  >
                    {locationSummary}
                  </Text>
                  <IconLocationFilled width={c(18)} height={c(18)} />
                </Pressable>
              ) : null}
            </View>
          </View>

          {showLogo && logo ? (
            <Image
              source={logo}
              style={{ width: c(88), height: c(91), borderRadius: c(12) }}
              contentFit="cover"
              transition={150}
            />
          ) : null}
        </View>

        <View style={{ flexDirection: figmaRow, alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable
            onPress={onFollowPress}
            disabled={followBusy}
            accessibilityRole="button"
            accessibilityLabel={followLabel}
            accessibilityState={{ selected: following }}
            style={{
              width: c(159),
              height: c(42),
              borderRadius: c(12),
              overflow: 'hidden',
              opacity: followBusy ? 0.7 : 1,
              flexDirection: figmaRow,
              alignItems: 'center',
              justifyContent: 'center',
              gap: c(6),
              paddingHorizontal: c(23),
            }}
          >
            <LinearGradient
              colors={following ? ['#2E146A', '#170D2B'] : ['#8B5CF6', '#2E146A']}
              style={StyleSheet.absoluteFill}
            />
            <Text style={{ fontFamily: bold, fontSize: f(12), color: PW.text }}>{followLabel}</Text>
            <IconStoreFollow width={c(16)} height={c(16)} />
          </Pressable>

          {showSocial ? (
            <View style={{ flexDirection: figmaRow, alignItems: 'center', gap: c(8) }}>
              {links?.whatsapp ? (
                <SocialSquare
                  width={c(47)}
                  label="WhatsApp"
                  onPress={() => openWhatsapp(links.whatsapp!)}
                >
                  <IconWhatsapp width={c(24)} height={c(27)} />
                </SocialSquare>
              ) : null}
              {links?.instagram ? (
                <SocialSquare
                  width={c(46)}
                  label="Instagram"
                  onPress={() => openExternal(links.instagram!)}
                >
                  <IconInstagram width={c(24)} height={c(24)} />
                </SocialSquare>
              ) : null}
              {links?.facebook ? (
                <SocialSquare
                  width={c(47)}
                  label="Facebook"
                  onPress={() => openExternal(links.facebook!)}
                >
                  <IconFacebook width={c(24)} height={c(24)} />
                </SocialSquare>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>

      {/* About + contact */}
      <View style={{ marginTop: c(40), gap: c(58) }}>
        <View style={{ gap: c(24) }}>
          <View style={{ gap: c(19) }}>
            <View style={{ flexDirection: figmaRow, alignItems: 'center', gap: c(12) }}>
              <Text
                style={{
                  flex: 1,
                  fontFamily: semibold,
                  fontSize: f(20),
                  color: '#D7D7D7',
                  textAlign: dir.textAlign,
                }}
              >
                {store.aboutTitle}
              </Text>
              <IconStoreAlt width={c(30)} height={c(24)} />
            </View>
            {about ? (
              <Text
                style={{
                  fontFamily: regular,
                  fontSize: f(15),
                  lineHeight: f(15) * 1.56,
                  color: '#ADADAD',
                  textAlign: dir.textAlign,
                }}
              >
                {about}
              </Text>
            ) : null}
          </View>

          <View style={{ flexDirection: figmaRow, alignItems: 'center', gap: c(7) }}>
            <FeatureChip
              label={sponsor.hasDelivery ? store.deliveryAvailable : detail.pickupChip}
              icon={
                sponsor.hasDelivery ? (
                  <IconStoreTruckGreen width={c(20)} height={c(20)} />
                ) : (
                  <IconStoreAlt width={c(20)} height={c(16)} />
                )
              }
              row={figmaRow}
              tone={sponsor.hasDelivery ? 'delivery' : 'neutral'}
            />
            <FeatureChip
              label={store.cashOnDelivery}
              icon={<IconStoreCash width={c(20)} height={c(20)} />}
              row={figmaRow}
              tone="neutral"
            />
            <FeatureChip
              label={store.authenticProducts}
              icon={<IconStoreAuthentic width={c(20)} height={c(20)} />}
              row={figmaRow}
              tone="neutral"
            />
          </View>
        </View>

        <View style={{ alignItems: dir.alignStart, gap: c(20) }}>
          <View style={{ flexDirection: figmaRow, alignItems: 'center', gap: c(10), alignSelf: 'stretch' }}>
            <Text
              style={{
                flex: 1,
                fontFamily: semibold,
                fontSize: f(20),
                color: '#D7D7D7',
                textAlign: dir.textAlign,
              }}
            >
              {store.contactTitle}
            </Text>
            <IconStorePhoneTitle width={c(34)} height={c(28)} />
          </View>

          <View style={{ alignItems: dir.alignStart, gap: c(12), maxWidth: c(280) }}>
            {phone ? (
              <Pressable
                onPress={() => openTel(phone)}
                style={{ flexDirection: figmaRow, alignItems: 'center', gap: c(4) }}
              >
                <Text style={{ fontFamily: regular, fontSize: f(14), color: '#B46CF9' }}>{phone}</Text>
                <IconStorePhone width={c(22)} height={c(18)} />
              </Pressable>
            ) : null}
            {sponsor.address ? (
              <Pressable
                onPress={onOpenMap}
                disabled={!onOpenMap}
                style={{ flexDirection: figmaRow, alignItems: 'center', gap: c(4) }}
              >
                <Text
                  style={{
                    fontFamily: regular,
                    fontSize: f(14),
                    color: '#B46CF9',
                    textAlign: dir.textAlign,
                    flexShrink: 1,
                  }}
                  numberOfLines={2}
                >
                  {sponsor.address}
                </Text>
                <IconLocationFilled width={c(18)} height={c(18)} />
              </Pressable>
            ) : null}
            <View style={{ flexDirection: figmaRow, alignItems: 'center', gap: c(4) }}>
              <Text style={{ fontFamily: regular, fontSize: f(14), color: '#B46CF9' }}>
                {store.hoursLabel}
              </Text>
              <IconStoreTime width={c(18)} height={c(18)} />
            </View>
          </View>
        </View>
      </View>

      {/* Map card */}
      <Pressable
        onPress={onOpenMap}
        disabled={!sponsor.address || !onOpenMap}
        accessibilityRole="button"
        accessibilityLabel={store.showOnMap}
        style={{
          marginTop: c(40),
          height: c(182),
          borderRadius: c(20),
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: sponsor.address ? 1 : 0.55,
        }}
      >
        <Image source={STORE_MAP_PREVIEW} style={StyleSheet.absoluteFillObject} contentFit="cover" />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(14,2,25,0.66)' }]} />
        <View style={{ width: c(251), alignItems: 'center', gap: c(15) }}>
          <IconStoreMapPinLg width={c(44)} height={c(44)} />
          <View
            style={{
              alignSelf: 'stretch',
              flexDirection: figmaRow,
              alignItems: 'center',
              justifyContent: 'center',
              gap: c(10),
              padding: c(10),
              borderRadius: 65,
              backgroundColor: 'rgba(139,92,246,0.33)',
            }}
          >
            <Text style={{ fontFamily: semibold, fontSize: f(16), color: '#B798FE' }}>{store.showOnMap}</Text>
            <IconStoreMapBtn width={c(22)} height={c(20)} />
          </View>
        </View>
      </Pressable>
    </View>
  );
}
