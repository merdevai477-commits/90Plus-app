import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import TeamBadge from '../common/TeamBadge';
import { getTeamDisplayName } from '../../utils/i18nHelpers';
import type { Language } from '../../src/i18n/types';
import type { OnboardingClubPick } from '../../utils/teamOnboarding';

const UNSELECTED = ['#07040d', '#0c051a'] as const;
const SELECTED = ['#8B5CF6', '#513690'] as const;

export default function OnboardingClubCard({
  club,
  selected,
  language,
  onPress,
}: {
  club: OnboardingClubPick;
  selected: boolean;
  language: Language;
  onPress: () => void;
}) {
  const label =
    language === 'ar'
      ? club.nameAr || getTeamDisplayName(club.name, language, club.competitorId)
      : getTeamDisplayName(club.name, language, club.competitorId);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={styles.press}
    >
      <LinearGradient
        colors={selected ? SELECTED : UNSELECTED}
        start={{ x: 0.5, y: selected ? 0 : 1 }}
        end={{ x: 0.5, y: selected ? 1 : 0 }}
        style={[styles.card, selected ? styles.cardSelected : styles.cardIdle]}
      >
        <View style={styles.inner}>
          <TeamBadge
            name={club.name}
            logo={club.logo ?? undefined}
            size={48}
            color="transparent"
            highQuality
          />
          <Text
            style={[styles.name, selected && styles.nameSelected]}
            numberOfLines={1}
          >
            {label}
          </Text>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  press: {
    flex: 1,
    minWidth: 0,
    height: 95,
  },
  card: {
    flex: 1,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 16,
  },
  cardIdle: {
    borderWidth: 0.5,
    borderColor: '#141218',
  },
  cardSelected: {
    borderWidth: 0,
  },
  inner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
  },
  name: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    width: '100%',
  },
  nameSelected: {
    fontWeight: '700',
  },
});
