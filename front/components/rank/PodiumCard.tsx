/**
 * PodiumCard
 *
 * Wraps a FIFA-style card for the top-3 podium and shows the player's XP
 * underneath. Real player data flows in via props from the rank screen
 * (resolved from `useTopPlayers`); empty slots reuse the same shape.
 */

import React from 'react';
import { ImageSourcePropType, Pressable, StyleSheet, Text, View } from 'react-native';

import FifaCard from './FifaCard';
import { useTranslation } from '../../src/i18n';

const ACCENT = '#A855F7';

export interface PodiumCardProps {
  rank: number;
  name: string;
  /** Display string for XP (already formatted). */
  xp: string;
  avatar: ImageSourcePropType | string;
  /** Either an ISO 2-letter code or a flag emoji. */
  countryFlag?: string | null;
  position?: string;
  age?: number | string;
  heightCm?: number | string;
  weightKg?: number | string;
  foot?: string;
  clubLogo?: string | null;
  favoriteTeam?: string | null;
  /** When true, render a neutral placeholder card (no fake stats). */
  isPlaceholder?: boolean;
  onPress?: () => void;
}

const PodiumCard: React.FC<PodiumCardProps> = ({
  rank,
  name,
  xp,
  avatar,
  countryFlag,
  position,
  age,
  heightCm,
  weightKg,
  foot,
  clubLogo,
  favoriteTeam,
  isPlaceholder = false,
  onPress,
}) => {
  const isFirst = rank === 1;
  const cardType: 'gold' | 'silver' | 'bronze' =
    rank === 1 ? 'gold' : rank === 2 ? 'silver' : 'bronze';

  const playerImage: ImageSourcePropType =
    typeof avatar === 'string' ? { uri: avatar } : avatar;

  const { t } = useTranslation();

  const content = (
    <>
      <FifaCard
        name={name}
        playerImage={playerImage}
        cardType={cardType}
        scale={isFirst ? 0.42 : 0.33}
        position={isPlaceholder ? '—' : (position ?? 'ST')}
        countryFlag={isPlaceholder ? '🏳️' : (countryFlag ?? '🏳️')}
        age={isPlaceholder ? '—' : (age ?? '—')}
        height={isPlaceholder ? '—' : (heightCm ?? '—')}
        weight={isPlaceholder ? '—' : (weightKg ?? '—')}
        foot={isPlaceholder ? '—' : (foot ?? '—')}
        clubLogo={isPlaceholder ? undefined : (clubLogo ?? undefined)}
        clubName={isPlaceholder ? undefined : (favoriteTeam ?? undefined)}
      />
      <Text style={s.podXpLabel} accessibilityLabel={`${t.rank.xpSuffix}: ${xp}`}>
        {xp}
      </Text>
    </>
  );

  if (onPress && !isPlaceholder) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          s.podCardWrapper,
          isFirst && s.podCardFirstWrapper,
          pressed && { opacity: 0.88 },
        ]}
        accessibilityRole="button"
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View style={[s.podCardWrapper, isFirst && s.podCardFirstWrapper]}>
      {content}
    </View>
  );
};

export default PodiumCard;

const s = StyleSheet.create({
  podCardWrapper: { alignItems: 'center' },
  podCardFirstWrapper: { zIndex: 10, marginBottom: 10 },
  podXpLabel: { color: ACCENT, fontSize: 12, fontWeight: '800', marginTop: 8 },
});
