import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
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
  type ChatNavLink,
} from '../../utils/chatNavLinks';
import { isArabicText } from './chatTextUtils';
import { chatColors } from './chatTheme';

type Props = {
  links: ChatNavLink[];
  onChoose?: (text: string) => void;
};

const AR = {
  playerTitle: 'اللاعب',
  clubTitle: 'الفريق',
  matchTitle: 'المباراة',
  matchesTitle: 'المباريات',
  playerSub: 'بروفايل اللاعب في 90Plus',
  clubSub: 'بروفايل الفريق في 90Plus',
  matchSub: 'تفاصيل المباراة في 90Plus',
  matchesSub: 'صفحة المباريات في 90Plus',
  view: 'عرض البروفايل',
  visitPlayer: 'تابع بروفايل اللاعب',
  visitClub: 'تابع بروفايل النادي',
  a11yPlayer: 'عرض بروفايل اللاعب',
  a11yClub: 'عرض بروفايل النادي',
  choose: 'قصدك الأهلي المصري ولا السعودي؟',
};

const PHOTO = 64;
const BADGE = 24;
const CARD_BG = '#080410';

function iconFor(type: ChatNavLink['type']) {
  const color = '#F5F3FF';
  if (type === 'player') return <User size={17} color={color} strokeWidth={2.2} />;
  if (type === 'club') return <Trophy size={17} color={color} strokeWidth={2.2} />;
  if (type === 'match') return <CircleDot size={17} color={color} strokeWidth={2.2} />;
  return <CalendarDays size={17} color={color} strokeWidth={2.2} />;
}

function visitLabel(link: ChatNavLink, preferAr: boolean, t: { chat: Record<string, string> }): string {
  if (link.type === 'club') return preferAr ? AR.visitClub : t.chat.navVisitClub;
  if (link.type === 'player') return preferAr ? AR.visitPlayer : t.chat.navVisitPlayer;
  return preferAr ? AR.view : t.chat.navViewProfile;
}

function ctaLabel(preferAr: boolean, t: { chat: Record<string, string> }): string {
  return preferAr ? AR.view : t.chat.navViewProfile;
}

function ClubBadge({ uri }: { uri: string | null }) {
  const [failed, setFailed] = useState(false);
  const showImg = !!uri && !failed;
  return (
    <View
      style={styles.clubBadge}
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      <View style={styles.clubBadgeInner}>
        {showImg ? (
          <Image
            source={{ uri }}
            style={styles.clubBadgeImg}
            contentFit="contain"
            cachePolicy="memory-disk"
            onError={() => setFailed(true)}
          />
        ) : (
          <Shield size={11} color="#F5C518" strokeWidth={2.2} />
        )}
      </View>
    </View>
  );
}

function FollowAvatar({
  photoUri,
  photoKind,
  badgeUri,
}: {
  photoUri: string | null;
  photoKind: 'player' | 'club';
  badgeUri: string | null;
}) {
  return (
    <View style={styles.avatarWrap} pointerEvents="none" accessible={false}>
      <View style={styles.avatarRing}>
        {photoUri ? (
          <Image
            source={{ uri: photoUri }}
            style={styles.photoFill}
            contentFit={photoKind === 'club' ? 'contain' : 'cover'}
            cachePolicy="memory-disk"
          />
        ) : (
          iconFor(photoKind)
        )}
      </View>
      {photoKind === 'player' ? <ClubBadge uri={badgeUri} /> : null}
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
  const media = resolveChatNavAvatar(link);
  const photoUri = media.kind === 'icon' ? null : media.uri;
  const badgeUri = link.type === 'player' ? resolveChatNavClubBadge(link) : null;
  const Chevron = rtl ? ChevronLeft : ChevronRight;
  return (
    <View style={[styles.profileCard, rtl && styles.profileCardRtl]}>
      <FollowAvatar
        photoUri={photoUri}
        photoKind={link.type === 'club' ? 'club' : 'player'}
        badgeUri={badgeUri}
      />
      <Text style={[styles.followLabel, rtl && styles.followLabelRtl]} numberOfLines={1}>
        {followLabel}
      </Text>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.ctaBtn, rtl && styles.ctaBtnRtl, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
      >
        <Text style={styles.ctaBtnText}>{buttonLabel}</Text>
        <Chevron size={16} color="#F5F3FF" strokeWidth={2.6} />
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

function copyFor(link: ChatNavLink, language: string, t: { chat: Record<string, string> }) {
  const named = isNamed(link.label, link.type) ? link.label.trim() : '';
  const preferAr = language === 'ar' || isArabicText(named || link.label);
  const viewLabel = preferAr ? AR.view : t.chat.navViewProfile;
  if (preferAr) {
    const title =
      named ||
      (link.type === 'player'
        ? AR.playerTitle
        : link.type === 'club'
          ? AR.clubTitle
          : link.type === 'match'
            ? AR.matchTitle
            : AR.matchesTitle);
    const subtitle = link.subtitle?.trim()
      || (named
        ? ''
        : link.type === 'player'
          ? AR.playerSub
          : link.type === 'club'
            ? AR.clubSub
            : link.type === 'match'
              ? AR.matchSub
              : AR.matchesSub);
    return { title, subtitle, viewLabel, preferAr };
  }
  const title =
    named ||
    (link.type === 'player'
      ? t.chat.navOpenPlayer
      : link.type === 'club'
        ? t.chat.navOpenClub
        : link.type === 'match'
          ? t.chat.navOpenMatch
          : t.chat.navOpenMatches);
  const subtitle = link.subtitle?.trim()
    || (named
      ? ''
      : link.type === 'player'
        ? t.chat.navCtaPlayer
        : link.type === 'club'
          ? t.chat.navCtaClub
          : link.type === 'match'
            ? t.chat.navCtaMatch
            : t.chat.navCtaMatches);
  return { title, subtitle, viewLabel, preferAr };
}

export function ChatNavLinks({ links, onChoose }: Props) {
  const router = useRouter();
  const { t, language } = useTranslation();

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
  const preferAr = language === 'ar' || primary.some((l) => isArabicText(l.label));

  if (isSelection) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.chooseHint}>{preferAr ? AR.choose : t.chat.navChooseClub}</Text>
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
        const copy = copyFor(link, language, t as { chat: Record<string, string> });
        const isProfile = link.type === 'player' || link.type === 'club';
        if (!isProfile) {
          return (
            <Pressable
              key={`${link.type}:${link.id ?? link.query ?? link.label}`}
              onPress={() => onPress(link)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={copy.title}
            >
              <View style={styles.iconWrap}>{iconFor(link.type)}</View>
              <View style={styles.textCol}>
                <Text style={styles.title} numberOfLines={1}>{copy.title}</Text>
              </View>
              <View style={styles.arrowWrap}>
                <ChevronRight size={16} color="#F5F3FF" strokeWidth={2.6} />
              </View>
            </Pressable>
          );
        }
        const follow = visitLabel(link, copy.preferAr, t as { chat: Record<string, string> });
        const button = ctaLabel(copy.preferAr, t as { chat: Record<string, string> });
        const a11y = copy.preferAr
          ? (link.type === 'club' ? AR.a11yClub : AR.a11yPlayer)
          : button;
        return (
          <FollowProfileCard
            key={`${link.type}:${link.id ?? link.query ?? link.label}`}
            link={link}
            followLabel={follow}
            buttonLabel={button}
            a11yLabel={a11y}
            rtl={copy.preferAr}
            onPress={() => onPress(link)}
          />
        );
      })}
      {extraMatches.map((link) => {
        return (
          <Pressable
            key={`${link.type}:${link.id ?? link.label}`}
            onPress={() => onPress(link)}
            style={({ pressed }) => [styles.compact, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={link.label}
          >
            {iconFor('match')}
            <Text style={styles.compactLabel} numberOfLines={1}>
              {link.label}
            </Text>
            <ChevronRight size={16} color={chatColors.accentSoft} strokeWidth={2.4} />
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
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 10,
    minHeight: 88,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: CARD_BG,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(124, 58, 237, 0.35)',
  },
  profileCardRtl: {
    flexDirection: 'row-reverse',
  },
  followLabel: {
    flex: 1,
    minWidth: 0,
    color: '#C4B5FD',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'left',
  },
  followLabelRtl: {
    textAlign: 'right',
  },
  ctaBtn: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 36,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#7C3AED',
  },
  ctaBtnRtl: {
    flexDirection: 'row-reverse',
  },
  ctaBtnText: {
    color: '#F5F3FF',
    fontSize: 13,
    fontWeight: '800',
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
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoFill: {
    width: PHOTO,
    height: PHOTO,
  },
  clubBadge: {
    position: 'absolute',
    left: -2,
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
  clubBadgeInner: {
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    borderWidth: 1,
    borderColor: '#F5C518',
    backgroundColor: '#12081C',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  clubBadgeImg: {
    width: BADGE - 4,
    height: BADGE - 4,
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
    flexDirection: 'row',
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
