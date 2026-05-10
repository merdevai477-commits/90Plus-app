import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import FifaCard from './FifaCard';

const ACCENT = '#A855F7';

interface PodiumCardProps {
  rank: number;
  name: string;
  xp: string;
  avatar: any;
}

export default function PodiumCard({ rank, name, xp, avatar }: PodiumCardProps) {
  const isFirst = rank === 1;
  const cardType = rank === 1 ? 'gold' : rank === 2 ? 'silver' : 'bronze';

  return (
    <View style={[s.podCardWrapper, isFirst && s.podCardFirstWrapper]}>
      <FifaCard
        name={name}
        playerImage={typeof avatar === 'string' ? { uri: avatar } : avatar}
        cardType={cardType}
        scale={isFirst ? 0.42 : 0.33}
        position={isFirst ? 'ST' : rank === 2 ? 'LW' : 'RW'}
        countryFlag={isFirst ? 'eg' : rank === 2 ? 'pt' : 'ar'}
        age={isFirst ? 31 : rank === 2 ? 39 : 36}
        height={isFirst ? 175 : 187}
        weight={isFirst ? 71 : 83}
        foot={isFirst ? 'Left' : 'Right'}
      />
      <Text style={s.podXpLabel}>{xp}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  podCardWrapper: { alignItems: 'center' },
  podCardFirstWrapper: { zIndex: 10, marginBottom: 10 },
  podXpLabel: { color: ACCENT, fontSize: 12, fontWeight: '800', marginTop: 8 },
});
