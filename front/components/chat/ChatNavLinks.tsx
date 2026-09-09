import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight, Trophy, User, CalendarDays, CircleDot } from 'lucide-react-native';
import { useTranslation } from '../../src/i18n';
import { pushPlayerCareer } from '../../utils/openPlayerProfile';
import { resolveChatNavAvatar, type ChatNavLink } from '../../utils/chatNavLinks';
import CachedAthletePhoto from '../common/CachedAthletePhoto';
import TeamBadge from '../common/TeamBadge';
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
  view: 'شاهد البروفايل',
  choose: 'قصدك الأهلي المصري ولا السعودي؟',
};

const AVATAR_SIZE = 40;

function iconFor(type: ChatNavLink['type']) {
  const color = '#F5F3FF';
  if (type === 'player') return <User size={17} color={color} strokeWidth={2.2} />;
  if (type === 'club') return <Trophy size={17} color={color} strokeWidth={2.2} />;
  if (type === 'match') return <CircleDot size={17} color={color} strokeWidth={2.2} />;
  return <CalendarDays size={17} color={color} strokeWidth={2.2} />;
}

function NavAvatar({ link }: { link: ChatNavLink }) {
  const media = resolveChatNavAvatar(link);
  if (media.kind === 'player') {
    return (
      <View style={styles.avatarWrap} pointerEvents="none">
        <CachedAthletePhoto uri={media.uri} size={AVATAR_SIZE} recyclingKey={link.id ?? media.uri} />
      </View>
    );
  }
  if (media.kind === 'club') {
    return (
      <View style={styles.avatarWrap} pointerEvents="none">
        <TeamBadge name={link.label} logo={media.uri} size={AVATAR_SIZE} color="transparent" />
      </View>
    );
  }
  return <View style={styles.iconWrap}>{iconFor(link.type)}</View>;
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

function ViewPill({ label, onPress }: { label: string; onPress?: () => void }) {
  const inner = (
    <View style={styles.viewPill}>
      <Text style={styles.viewPillText}>{label}</Text>
    </View>
  );
  if (!onPress) return inner;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      {inner}
    </Pressable>
  );
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
                    <TeamBadge name={link.label} logo={logo} size={64} color="transparent" />
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
        const showView = link.type === 'player' || link.type === 'club';
        return (
          <Pressable
            key={`${link.type}:${link.id ?? link.query ?? link.label}`}
            onPress={() => onPress(link)}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`${copy.title}. ${copy.viewLabel}`}
          >
            <NavAvatar link={link} />
            <View style={styles.textCol}>
              <Text style={styles.title} numberOfLines={1}>
                {copy.title}
              </Text>
            </View>
            {showView ? (
              <ViewPill label={copy.viewLabel} />
            ) : (
              <View style={styles.arrowWrap}>
                <ChevronRight size={16} color="#F5F3FF" strokeWidth={2.6} />
              </View>
            )}
          </Pressable>
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
  choiceCard: {
    minHeight: 56,
    paddingHorizontal: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(124,58,237,0.16)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(167,139,250,0.28)',
  },
  pressed: {
    opacity: 0.88,
  },
  avatarWrap: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: 20,
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
  subtitle: {
    color: 'rgba(216,180,254,0.88)',
    fontSize: 12,
    fontWeight: '600',
  },
  viewPill: {
    flexShrink: 0,
    minHeight: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  viewPillText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '800',
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
