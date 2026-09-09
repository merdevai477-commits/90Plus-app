import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  ChevronLeft,
  ChevronRight,
  Trophy,
  User,
  CalendarDays,
  CircleDot,
  Shield,
} from 'lucide-react-native';
import { useTranslation } from '../../src/i18n';
import { pushPlayerCareer } from '../../utils/openPlayerProfile';
import {
  resolveChatNavAvatar,
  resolveChatNavClubBadge,
  resolveChatNavClubBadgeCandidates,
  resolveChatNavClubPhotos,
  resolveChatNavPlayerPhotos,
  type ChatNavLink,
} from '../../utils/chatNavLinks';
import { chatColors, chatRadii } from './chatTheme';

type Props = {
  links: ChatNavLink[];
  onChoose?: (text: string) => void;
};

const PHOTO = 64;
const BADGE = 24;
const CARD_BG = '#080410';
const FALLBACK_BG = '#2A2438';
const CTA_TEXT = '#FFFFFF';

function iconFor(type: ChatNavLink['type']) {
  const color = '#F5F3FF';
  if (type === 'player') return <User size={17} color={color} strokeWidth={2.2} />;
  if (type === 'club') return <Trophy size={17} color={color} strokeWidth={2.2} />;
  if (type === 'match') return <CircleDot size={17} color={color} strokeWidth={2.2} />;
  return <CalendarDays size={17} color={color} strokeWidth={2.2} />;
}

function PulseFill() {
  const opacity = useRef(new Animated.Value(0.32)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.78, duration: 720, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.28, duration: 720, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View pointerEvents="none" style={[styles.pulseFill, { opacity }]} />;
}

function CandidateMedia({
  uris,
  contentFit,
  fallback,
}: {
  uris: string[];
  contentFit: 'cover' | 'contain';
  fallback: React.ReactNode;
}) {
  const key = uris.join('|');
  const [idx, setIdx] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [failedAll, setFailedAll] = useState(!uris.length);

  useEffect(() => {
    setIdx(0);
    setLoaded(false);
    setFailedAll(!uris.length);
  }, [key, uris.length]);

  const uri = !failedAll ? uris[idx] : undefined;
  if (!uri) return <>{fallback}</>;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {!loaded ? <PulseFill /> : null}
      <Image
        source={{ uri }}
        style={[StyleSheet.absoluteFill, !loaded && styles.imageHidden]}
        contentFit={contentFit}
        cachePolicy="memory-disk"
        recyclingKey={uri}
        onLoad={() => setLoaded(true)}
        onError={() => {
          if (idx + 1 < uris.length) {
            setLoaded(false);
            setIdx((i) => i + 1);
          } else {
            setFailedAll(true);
          }
        }}
      />
    </View>
  );
}

function ClubBadge({ uris, rtl }: { uris: string[]; rtl: boolean }) {
  return (
    <View
      style={[styles.clubBadge, rtl ? styles.clubBadgeRtl : styles.clubBadgeLtr]}
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      <View style={styles.clubBadgeInner}>
        <CandidateMedia
          uris={uris}
          contentFit="contain"
          fallback={<Shield size={11} color="#C4B5FD" strokeWidth={2.2} />}
        />
      </View>
    </View>
  );
}

function FollowAvatar({
  photoUris,
  photoKind,
  badgeUris,
  rtl,
}: {
  photoUris: string[];
  photoKind: 'player' | 'club';
  badgeUris: string[];
  rtl: boolean;
}) {
  const fallbackIcon =
    photoKind === 'club' ? (
      <Trophy size={22} color="#C4B5FD" strokeWidth={2.1} />
    ) : (
      <User size={22} color="#C4B5FD" strokeWidth={2.1} />
    );
  return (
    <View style={styles.avatarWrap} pointerEvents="none" accessible={false}>
      <View style={styles.avatarRing}>
        <CandidateMedia
          uris={photoUris}
          contentFit={photoKind === 'club' ? 'contain' : 'cover'}
          fallback={<View style={styles.avatarFallback}>{fallbackIcon}</View>}
        />
      </View>
      {photoKind === 'player' ? <ClubBadge uris={badgeUris} rtl={rtl} /> : null}
    </View>
  );
}

function FollowProfileCard({
  link,
  followLabel,
  buttonLabel,
  a11yLabel,
  rtl,
  onPress,
}: {
  link: ChatNavLink;
  followLabel: string;
  buttonLabel: string;
  a11yLabel: string;
  rtl: boolean;
  onPress: () => void;
}) {
  const photoUris = useMemo(
    () => (link.type === 'club' ? resolveChatNavClubPhotos(link) : resolveChatNavPlayerPhotos(link)),
    [link],
  );
  const badgeUris = useMemo(
    () => (link.type === 'player' ? resolveChatNavClubBadgeCandidates(link) : []),
    [link],
  );
  const Chevron = rtl ? ChevronLeft : ChevronRight;
  return (
    <View
      style={[styles.profileCard, { flexDirection: rtl ? 'row-reverse' : 'row' }]}
    >
      <FollowAvatar
        photoUris={photoUris}
        photoKind={link.type === 'club' ? 'club' : 'player'}
        badgeUris={badgeUris}
        rtl={rtl}
      />
      <Text
        style={[styles.followLabel, { textAlign: rtl ? 'right' : 'left' }]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {followLabel}
      </Text>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.ctaHit, pressed && styles.ctaPressed]}
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
      >
        <LinearGradient
          colors={chatColors.userBubble}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.ctaFill, rtl ? styles.ctaFillRtl : styles.ctaFillLtr]}
        >
          <Text style={styles.ctaBtnText} numberOfLines={1}>
            {buttonLabel}
          </Text>
          <Chevron size={14} color={CTA_TEXT} strokeWidth={2.8} />
        </LinearGradient>
      </Pressable>
    </View>
  );
}

function isNamed(label: string, type: ChatNavLink['type']): boolean {
  const v = label.trim();
  if (!v || v === type) return false;
  const generic = new Set([
    'player',
    'club',
    'match',
    'matches',
    'Player profile',
    'Club profile',
    'Match details',
    "Today's matches",
    'بروفايل اللاعب',
    'بروفايل الفريق',
    'بروفايل النادي',
    'تفاصيل المباراة',
    'مباريات اليوم',
  ]);
  return !generic.has(v);
}

export function ChatNavLinks({ links, onChoose }: Props) {
  const router = useRouter();
  const { t, language } = useTranslation();
  const rtl = language === 'ar';

  const openLink = useCallback(
    (link: ChatNavLink) => {
      if (link.type === 'matches' || (link.type === 'match' && !link.id)) {
        router.push('/(tabs)/matches' as never);
        return;
      }
      if (link.type === 'match' && link.id) {
        router.push({
          pathname: '/(tabs)/match-details',
          params: { fixtureId: String(link.id) },
        } as never);
        return;
      }
      if (link.type === 'club' && link.id) {
        router.push({
          pathname: '/team-profile' as any,
          params: { id: String(link.id), name: link.label },
        } as never);
        return;
      }
      if (link.type === 'player' && link.id) {
        const avatar = resolveChatNavAvatar(link);
        pushPlayerCareer(router, {
          athleteId: link.id,
          name: link.label,
          photo: avatar.kind === 'player' ? avatar.uri : link.photo,
          teamName: link.teamName,
          teamLogo: resolveChatNavClubBadge(link),
          teamId: link.teamId,
        });
        return;
      }
      const q = (link.query || link.label || '').trim();
      router.push({
        pathname: '/search' as any,
        params: q ? { q } : {},
      } as never);
    },
    [router],
  );

  const onPress = useCallback(
    (link: ChatNavLink) => {
      if (link.choice && onChoose) {
        const q = (link.query || link.label || '').trim();
        if (q) onChoose(q);
        return;
      }
      openLink(link);
    },
    [onChoose, openLink],
  );

  if (!links.length) return null;

  const extraMatches = links.filter((l) => l.type === 'match' && links.some((x) => x.type !== 'match'));
  const primary = links.filter((l) => !extraMatches.includes(l));
  const choices = primary.filter((l) => l.choice);
  const isSelection = choices.length >= 2;

  if (isSelection) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.chooseHint}>{t.chat.navChooseClub}</Text>
        <View style={styles.choiceGrid}>
          {choices.map((link) => {
            const media = resolveChatNavAvatar(link);
            const logo = media.kind === 'club' ? media.uri : undefined;
            return (
              <Pressable
                key={`${link.type}:${link.id ?? link.label}`}
                onPress={() => onPress(link)}
                style={({ pressed }) => [styles.choiceTile, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={link.label}
              >
                <View style={styles.choiceCrest}>
                  {logo ? (
                    <Image source={{ uri: logo }} style={styles.choiceLogo} contentFit="contain" />
                  ) : (
                    iconFor(link.type)
                  )}
                </View>
                <Text style={styles.choiceName} numberOfLines={2}>
                  {link.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {primary.map((link) => {
        const named = isNamed(link.label, link.type) ? link.label.trim() : '';
        const isProfile = link.type === 'player' || link.type === 'club';
        if (!isProfile) {
          const title =
            named ||
            (link.type === 'match' ? t.chat.navOpenMatch : t.chat.navOpenMatches);
          const MatchChevron = rtl ? ChevronLeft : ChevronRight;
          return (
            <Pressable
              key={`${link.type}:${link.id ?? link.query ?? link.label}`}
              onPress={() => onPress(link)}
              style={({ pressed }) => [
                styles.row,
                { flexDirection: rtl ? 'row-reverse' : 'row' },
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={title}
            >
              <View style={styles.iconWrap}>{iconFor(link.type)}</View>
              <View style={styles.textCol}>
                <Text style={[styles.title, { textAlign: rtl ? 'right' : 'left' }]} numberOfLines={1}>
                  {title}
                </Text>
              </View>
              <View style={styles.arrowWrap}>
                <MatchChevron size={16} color="#F5F3FF" strokeWidth={2.6} />
              </View>
            </Pressable>
          );
        }
        const follow =
          link.type === 'club' ? t.chat.navVisitClub : t.captainAI.followProfile;
        const button = t.captainAI.viewProfile;
        const a11y = link.type === 'club' ? t.chat.navViewClubA11y : t.chat.navViewPlayerA11y;
        return (
          <FollowProfileCard
            key={`${link.type}:${link.id ?? link.query ?? link.label}`}
            link={link}
            followLabel={follow}
            buttonLabel={button}
            a11yLabel={a11y}
            rtl={rtl}
            onPress={() => onPress(link)}
          />
        );
      })}
      {extraMatches.map((link) => {
        const MatchChevron = rtl ? ChevronLeft : ChevronRight;
        return (
          <Pressable
            key={`${link.type}:${link.id ?? link.label}`}
            onPress={() => onPress(link)}
            style={({ pressed }) => [
              styles.compact,
              { flexDirection: rtl ? 'row-reverse' : 'row' },
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={link.label}
          >
            {iconFor('match')}
            <Text style={[styles.compactLabel, { textAlign: rtl ? 'right' : 'left' }]} numberOfLines={1}>
              {link.label}
            </Text>
            <MatchChevron size={16} color={chatColors.accentSoft} strokeWidth={2.4} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 2,
    gap: 8,
    alignSelf: 'stretch',
  },
  chooseHint: {
    color: '#F5F3FF',
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: 2,
    marginBottom: 4,
    lineHeight: 20,
  },
  choiceGrid: {
    flexDirection: 'row',
    gap: 10,
    alignSelf: 'stretch',
  },
  choiceTile: {
    flex: 1,
    minHeight: 128,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(124,58,237,0.16)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(167,139,250,0.35)',
  },
  choiceCrest: {
    width: 72,
    height: 72,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  choiceName: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  row: {
    flexWrap: 'nowrap',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  profileCard: {
    flexWrap: 'nowrap',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 13,
    minHeight: 88,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: CARD_BG,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(124, 58, 237, 0.35)',
  },
  followLabel: {
    flex: 1,
    minWidth: 0,
    color: '#C4B5FD',
    fontSize: 13,
    fontWeight: '600',
  },
  ctaHit: {
    flexShrink: 0,
    borderRadius: chatRadii.lg,
    ...Platform.select({
      ios: {
        shadowColor: '#7C3AED',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.45,
        shadowRadius: 8,
      },
      android: { elevation: 5 },
      default: {},
    }),
  },
  ctaFill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 42,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: chatRadii.lg,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  ctaFillLtr: {
    flexDirection: 'row',
  },
  ctaFillRtl: {
    flexDirection: 'row-reverse',
  },
  ctaPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.92,
  },
  ctaBtnText: {
    color: CTA_TEXT,
    fontSize: 13,
    fontWeight: '800',
    includeFontPadding: false,
  },
  avatarWrap: {
    width: PHOTO,
    height: PHOTO,
    flexShrink: 0,
  },
  avatarRing: {
    width: PHOTO,
    height: PHOTO,
    borderRadius: PHOTO / 2,
    borderWidth: 2,
    borderColor: '#7C3AED',
    backgroundColor: FALLBACK_BG,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarFallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: FALLBACK_BG,
  },
  pulseFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(124, 58, 237, 0.42)',
  },
  imageHidden: {
    opacity: 0,
  },
  clubBadge: {
    position: 'absolute',
    bottom: -2,
    width: BADGE + 4,
    height: BADGE + 4,
    borderRadius: (BADGE + 4) / 2,
    backgroundColor: CARD_BG,
    borderWidth: 2,
    borderColor: CARD_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clubBadgeRtl: {
    left: -2,
  },
  clubBadgeLtr: {
    right: -2,
  },
  clubBadgeInner: {
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    borderWidth: 1,
    borderColor: '#7C3AED',
    backgroundColor: FALLBACK_BG,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  choiceLogo: {
    width: 56,
    height: 56,
  },
  pressed: {
    opacity: 0.88,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124,58,237,0.45)',
    flexShrink: 0,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  arrowWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    flexShrink: 0,
  },
  compact: {
    alignItems: 'center',
    gap: 8,
    minHeight: 40,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(124,58,237,0.12)',
  },
  compactLabel: {
    flex: 1,
    minWidth: 0,
    color: '#EDE9FE',
    fontSize: 13,
    fontWeight: '600',
  },
});
