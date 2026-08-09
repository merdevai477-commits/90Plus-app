/**
 * Loading skeleton — keeps the Share & Win layout stable while the payload
 * loads, using the same block sizes as the real cards so nothing jumps.
 */

import React, { memo } from 'react';
import { View } from 'react-native';

import { useShareWinStyles } from '../styles';

const ShareWinSkeleton = memo(function ShareWinSkeleton() {
  const { sw, metrics } = useShareWinStyles();
  const { s } = metrics;

  return (
    <View style={{ alignItems: 'center', gap: s(24), paddingTop: s(24) }}>
      <View style={[sw.skeleton, { width: s(220), height: s(38) }]} />
      <View style={[sw.skeleton, { width: s(300), height: s(44) }]} />
      <View style={[sw.skeleton, { width: s(404), height: s(520), borderRadius: s(25) }]} />
      <View style={[sw.skeleton, { width: s(404), height: s(320), borderRadius: s(25) }]} />
      <View style={[sw.skeleton, { width: s(404), height: s(200), borderRadius: s(25) }]} />
    </View>
  );
});

export default ShareWinSkeleton;
