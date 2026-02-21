import { useEffect } from 'react';
import { useRouter } from 'expo-router';

/**
 * About Us - Redirects to Settings where app info is displayed.
 * This screen is not directly accessible from the tab bar.
 */
export default function AboutUsScreen() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to settings which contains all about info
    router.replace('/(tabs)/settings');
  }, []);

  return null;
}