/**
 * PodiumCard
 *
 * Wraps a FIFA-style card for the top-3 podium and shows the player's XP
 * underneath. Real player data flows in via props from the rank screen
 * (resolved from `useTopPlayers`); empty slots reuse the same shape.
 */

import React from 'react';
import { ImageSourcePropType, StyleSheet, Text, View } from 'react-native';

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
}) => {
  const isFirst = rank === 1;
  const cardType: 'gold' | 'silver' | 'bronze' =
    rank === 1 ? 'gold' : rank === 2 ? 'silver' : 'bronze';

  const playerImage: ImageSourcePropType =
    typeof avatar === 'string' ? { uri: avatar } : avatar;

  const fallbackPosition = isFirst ? 'ST' : rank === 2 ? 'LW' : 'RW';
  const fallbackFlag = isFirst ? '🇪🇬' : rank === 2 ? '🇵🇹' : '🇦🇷';
  const fallbackAge = isFirst ? 31 : rank === 2 ? 39 : 36;
  const fallbackHeight = isFirst ? 175 : 187;
  const fallbackWeight = isFirst ? 71 : 83;
  const fallbackFoot = isFirst ? 'Left' : 'Right';

  // Used only for accessibility; visible label is the explicit `xp` prop.
  const { t } = useTranslation();

  return (
    <View style={[s.podCardWrapper, isFirst && s.podCardFirstWrapper]}>
      <FifaCard
        name={name}
        playerImage={playerImage}
        cardType={cardType}
        scale={isFirst ? 0.42 : 0.33}
        position={position ?? fallbackPosition}
        countryFlag={countryFlag ?? fallbackFlag}
        age={age ?? fallbackAge}
        height={heightCm ?? fallbackHeight}
        weight={weightKg ?? fallbackWeight}
        foot={foot ?? fallbackFoot}
      />
      <Text style={s.podXpLabel} accessibilityLabel={`${t.rank.xpSuffix}: ${xp}`}>
        {xp}
      </Text>
    </View>
  );
};

export default PodiumCard;

const s = StyleSheet.create({
  podCardWrapper: { alignItems: 'center' },
  podCardFirstWrapper: { zIndex: 10, marginBottom: 10 },
  podXpLabel: { color: ACCENT, fontSize: 12, fontWeight: '800', marginTop: 8 },
});
