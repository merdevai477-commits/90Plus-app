import React, { useEffect } from 'react';
import { BackHandler, DynamicColorIOS, Platform } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { NativeTabTriggers } from '@/components/navigation/NativeTabTriggers';
import { TabBarProvider, useTabBarContext } from '@/contexts/TabBarContext';

const ANDROID_TAB_BG = 'rgba(28,28,30,0.94)';
const ANDROID_INDICATOR = 'rgba(255,255,255,0.12)';

function TabLayoutInner() {
  const router = useRouter();
  const pathname = usePathname();
  const { isTabBarHidden } = useTabBarContext();

  useEffect(() => {
    let backPressCount = 0;
    let backPressTimer: ReturnType<typeof setTimeout>;

    const backAction = () => {
      if (pathname === '/Home' || pathname === '/(tabs)/Home') {
        backPressCount += 1;
        if (backPressCount === 2) return false;
        backPressTimer = setTimeout(() => {
          backPressCount = 0;
        }, 2000);
        return true;
      }
      router.replace('/Home');
      return true;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => {
      backHandler.remove();
      if (backPressTimer) clearTimeout(backPressTimer);
    };
  }, [pathname, router]);

  const iconColorDefault =
    Platform.OS === 'ios'
      ? DynamicColorIOS({ dark: 'rgba(255,255,255,0.5)', light: 'rgba(0,0,0,0.45)' })
      : 'rgba(255,255,255,0.5)';

  const iconColorSelected =
    Platform.OS === 'ios'
      ? DynamicColorIOS({ dark: '#FFFFFF', light: '#000000' })
      : '#FFFFFF';

  return (
    <NativeTabs
      hidden={isTabBarHidden}
      disableTransparentOnScrollEdge
      backgroundColor={Platform.OS === 'android' ? ANDROID_TAB_BG : undefined}
      indicatorColor={Platform.OS === 'android' ? ANDROID_INDICATOR : undefined}
      blurEffect={Platform.OS === 'ios' ? 'systemChromeMaterialDark' : undefined}
      iconColor={{
        default: iconColorDefault,
        selected: iconColorSelected,
      }}
      tintColor={iconColorSelected}
      labelStyle={{
        default: {
          color: iconColorDefault,
          fontSize: 11,
          fontWeight: '500',
        },
        selected: {
          color: iconColorSelected,
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <NativeTabTriggers />
    </NativeTabs>
  );
}

export default function TabLayout() {
  return (
    <TabBarProvider>
      <TabLayoutInner />
    </TabBarProvider>
  );
}
