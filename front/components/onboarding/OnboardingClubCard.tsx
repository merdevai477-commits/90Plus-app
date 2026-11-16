import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import TeamBadge from '../common/TeamBadge';
import { getTeamDisplayName } from '../../utils/i18nHelpers';
import type { Language } from '../../src/i18n/types';
import type { OnboardingClubPick } from '../../utils/teamOnboarding';

/** Figma Team Selection light cards (1594:4455 / 1594:5015). */
const INK = '#24104E';
const PRIMARY = '#6A2BD9';
const CARD_BORDER = '#E8E0F5';
const LOGO_WELL = '#F6F3FC';

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

  const body = (
    <>
      <View style={styles.logoWell}>
        <TeamBadge
          name={club.name}
          logo={club.logo ?? undefined}
          size={36}
          color="transparent"
          highQuality
        />
      </View>
      <Text
        style={[styles.name, selected && styles.nameSelected]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </>
  );

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={styles.press}
    >
      {selected ? (
        <LinearGradient
          colors={['#6A2BD9', '#4B1FA3']}
          start={{ x: 0.05, y: 0.2 }}
          end={{ x: 0.95, y: 0.9 }}
          style={[styles.card, styles.cardSelected]}
        >
          {body}
        </LinearGradient>
      ) : (
        <View style={[styles.card, styles.cardIdle]}>{body}</View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  press: {
    flex: 1,
    minWidth: 0,
    height: 122,
  },
  card: {
    flex: 1,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 12,
    gap: 8,
  },
  cardIdle: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  cardSelected: {
    borderWidth: 1.5,
    borderColor: PRIMARY,
  },
  logoWell: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: LOGO_WELL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    color: INK,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    width: '100%',
  },
  nameSelected: {
    color: '#FCFCFC',
    fontWeight: '600',
  },
});
