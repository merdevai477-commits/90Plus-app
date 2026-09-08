import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, Trophy, User, CalendarDays, CircleDot } from 'lucide-react-native';
import { useTranslation } from '../../src/i18n';
import { pushPlayerCareer } from '../../utils/openPlayerProfile';
import type { ChatNavLink } from '../../utils/chatNavLinks';
import { isArabicText } from './chatTextUtils';
import { chatColors } from './chatTheme';

type Props = {
  links: ChatNavLink[];
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
};

function iconFor(type: ChatNavLink['type']) {
  const color = '#F5F3FF';
  if (type === 'player') return <User size={17} color={color} strokeWidth={2.2} />;
  if (type === 'club') return <Trophy size={17} color={color} strokeWidth={2.2} />;
  if (type === 'match') return <CircleDot size={17} color={color} strokeWidth={2.2} />;
  return <CalendarDays size={17} color={color} strokeWidth={2.2} />;
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
    const subtitle =
      link.type === 'player'
        ? AR.playerSub
        : link.type === 'club'
          ? AR.clubSub
          : link.type === 'match'
            ? AR.matchSub
            : AR.matchesSub;
    return { title, subtitle, rtl: true };
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
  const subtitle =
    link.type === 'player'
      ? t.chat.navCtaPlayer
      : link.type === 'club'
        ? t.chat.navCtaClub
        : link.type === 'match'
          ? t.chat.navCtaMatch
          : t.chat.navCtaMatches;
  return { title, subtitle, rtl: false };
}

export function ChatNavLinks({ links }: Props) {
  const router = useRouter();
  const { t, language } = useTranslation();

  const onPress = useCallback(
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
        pushPlayerCareer(router, {
          athleteId: link.id,
          name: link.label,
          photo: link.photo,
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

  if (!links.length) return null;

  const extraMatches = links.filter((l) => l.type === 'match' && links.some((x) => x.type !== 'match'));
  const primary = links.filter((l) => !extraMatches.includes(l));

  return (
    <View style={styles.wrap}>
      {primary.map((link) => {
        const copy = copyFor(link, language, t as { chat: Record<string, string> });
        const Chevron = copy.rtl ? ChevronLeft : ChevronRight;
        return (
          <Pressable
            key={`${link.type}:${link.id ?? link.query ?? link.label}`}
            onPress={() => onPress(link)}
            style={({ pressed }) => [
              styles.row,
              copy.rtl && styles.rowRtl,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`${copy.title}. ${copy.subtitle}`}
          >
            <View style={styles.iconWrap}>{iconFor(link.type)}</View>
            <View style={styles.textCol}>
              <Text style={[styles.title, copy.rtl && styles.rtlText]} numberOfLines={1}>
                {copy.title}
              </Text>
              <Text style={[styles.subtitle, copy.rtl && styles.rtlText]} numberOfLines={1}>
                {copy.subtitle}
              </Text>
            </View>
            <View style={styles.arrowWrap}>
              <Chevron size={16} color="#F5F3FF" strokeWidth={2.6} />
            </View>
          </Pressable>
        );
      })}
      {extraMatches.map((link) => {
        const rtl = language === 'ar' || isArabicText(link.label);
        const Chevron = rtl ? ChevronLeft : ChevronRight;
        return (
          <Pressable
            key={`${link.type}:${link.id ?? link.label}`}
            onPress={() => onPress(link)}
            style={({ pressed }) => [styles.compact, rtl && styles.rowRtl, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={link.label}
          >
            {iconFor('match')}
            <Text style={[styles.compactLabel, rtl && styles.rtlText]} numberOfLines={1}>
              {link.label}
            </Text>
            <Chevron size={16} color={chatColors.accentSoft} strokeWidth={2.4} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 2,
    gap: 6,
    alignSelf: 'stretch',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  rowRtl: {
    flexDirection: 'row-reverse',
  },
  pressed: {
    opacity: 0.88,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 11,
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
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
