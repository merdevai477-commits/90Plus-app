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
  const color = chatColors.accentSoft;
  if (type === 'player') return <User size={16} color={color} strokeWidth={2.2} />;
  if (type === 'club') return <Trophy size={16} color={color} strokeWidth={2.2} />;
  if (type === 'match') return <CircleDot size={16} color={color} strokeWidth={2.2} />;
  return <CalendarDays size={16} color={color} strokeWidth={2.2} />;
}

export function ChatNavLinks({ links }: Props) {
  const router = useRouter();
  const { t, language } = useTranslation();
  const isAr = language === 'ar';
  const Chevron = isAr ? ChevronLeft : ChevronRight;

  const onPress = useCallback(
    (link: ChatNavLink) => {
      if (link.type === 'matches') {
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
          pathname: '/team-profile',
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
      }
    },
    [router],
  );

  if (!links.length) return null;

  return (
    <View style={[styles.wrap, isAr && styles.wrapRtl]}>
      {links.map((link) => {
        const fallback =
          link.type === 'player'
            ? t.chat.navOpenPlayer
            : link.type === 'club'
              ? t.chat.navOpenClub
              : link.type === 'match'
                ? t.chat.navOpenMatch
                : t.chat.navOpenMatches;
        const title = link.label?.trim() || fallback;
        return (
          <Pressable
            key={`${link.type}:${link.id ?? title}`}
            onPress={() => onPress(link)}
            style={({ pressed }) => [styles.chip, isAr && styles.chipRtl, pressed && styles.chipPressed]}
            accessibilityRole="button"
            accessibilityLabel={title}
          >
            {iconFor(link.type)}
            <Text style={[styles.label, isAr && styles.labelRtl]} numberOfLines={1}>
              {title}
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
    marginTop: 10,
    gap: 8,
    alignSelf: 'stretch',
  },
  wrapRtl: {
    alignItems: 'stretch',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 42,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(124,58,237,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.32)',
  },
  chipRtl: {
    flexDirection: 'row-reverse',
  },
  chipPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
  label: {
    flex: 1,
    color: '#F5F3FF',
    fontSize: 13,
    fontWeight: '600',
  },
  labelRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
