import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, Trophy, User, CalendarDays, CircleDot } from 'lucide-react-native';
import { useTranslation } from '../../src/i18n';
import { pushPlayerCareer } from '../../utils/openPlayerProfile';
import type { ChatNavLink } from '../../utils/chatNavLinks';
import { chatColors } from './chatTheme';

type Props = {
  links: ChatNavLink[];
};

function iconFor(type: ChatNavLink['type']) {
  const color = '#F5F3FF';
  if (type === 'player') return <User size={18} color={color} strokeWidth={2.2} />;
  if (type === 'club') return <Trophy size={18} color={color} strokeWidth={2.2} />;
  if (type === 'match') return <CircleDot size={18} color={color} strokeWidth={2.2} />;
  return <CalendarDays size={18} color={color} strokeWidth={2.2} />;
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

export function ChatNavLinks({ links }: Props) {
  const router = useRouter();
  const { t, language } = useTranslation();
  const isAr = language === 'ar';
  const Chevron = isAr ? ChevronLeft : ChevronRight;

  const actionTitle = useCallback(
    (link: ChatNavLink) => {
      const named = isNamed(link.label, link.type) ? link.label.trim() : '';
      if (link.type === 'player') {
        return named
          ? (t.chat.navGoPlayerNamed as string).replace('{name}', named)
          : t.chat.navGoPlayer;
      }
      if (link.type === 'club') {
        return named
          ? (t.chat.navGoClubNamed as string).replace('{name}', named)
          : t.chat.navGoClub;
      }
      if (link.type === 'match') {
        return named
          ? (t.chat.navGoMatchNamed as string).replace('{name}', named)
          : t.chat.navGoMatch;
      }
      return t.chat.navGoMatches;
    },
    [t],
  );

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
    <View style={[styles.wrap, isAr && styles.wrapRtl]}>
      {primary.map((link) => {
        const title = actionTitle(link);
        return (
          <Pressable
            key={`${link.type}:${link.id ?? link.query ?? link.label}`}
            onPress={() => onPress(link)}
            style={({ pressed }) => [styles.card, isAr && styles.cardRtl, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={title}
          >
            <View style={styles.iconWrap}>{iconFor(link.type)}</View>
            <View style={styles.textCol}>
              <Text style={[styles.hint, isAr && styles.rtlText]}>{t.chat.navMoreInfoHint}</Text>
              <Text style={[styles.action, isAr && styles.rtlText]} numberOfLines={2}>
                {title}
              </Text>
            </View>
            <View style={styles.arrowWrap}>
              <Chevron size={18} color="#F5F3FF" strokeWidth={2.6} />
            </View>
          </Pressable>
        );
      })}
      {extraMatches.map((link) => (
        <Pressable
          key={`${link.type}:${link.id ?? link.label}`}
          onPress={() => onPress(link)}
          style={({ pressed }) => [styles.compact, isAr && styles.cardRtl, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={link.label}
        >
          {iconFor('match')}
          <Text style={[styles.compactLabel, isAr && styles.rtlText]} numberOfLines={1}>
            {link.label}
          </Text>
          <Chevron size={16} color={chatColors.accentSoft} strokeWidth={2.4} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 12,
    gap: 8,
    alignSelf: 'stretch',
  },
  wrapRtl: {
    alignItems: 'stretch',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 62,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(124,58,237,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.42)',
  },
  cardRtl: {
    flexDirection: 'row-reverse',
  },
  pressed: {
    opacity: 0.86,
    transform: [{ scale: 0.985 }],
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124,58,237,0.55)',
  },
  textCol: {
    flex: 1,
    gap: 2,
  },
  hint: {
    color: 'rgba(237,233,254,0.72)',
    fontSize: 11,
    fontWeight: '600',
  },
  action: {
    color: '#F5F3FF',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  arrowWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  compact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(124,58,237,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.28)',
  },
  compactLabel: {
    flex: 1,
    color: '#EDE9FE',
    fontSize: 13,
    fontWeight: '600',
  },
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
