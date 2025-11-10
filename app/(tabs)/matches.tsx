import React from 'react';
import { StatusBar } from 'react-native';

// استيراد المكونات الجديدة
import { ReelsFeed } from '../../components/Matches';

export default function MatchesScreen() {
  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <ReelsFeed />
    </>
  );
}