import { useEffect } from 'react';
import { useRouter } from 'expo-router';

/**
 * Rankings Tab - Redirects to the full-featured Rank screen.
 * The rank.tsx screen contains the complete rankings UI with
 * top players, quiz masters, commenters, and predictors.
 */
export default function RankingsScreen() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/(tabs)/rank');
  }, []);

  return null;
}
