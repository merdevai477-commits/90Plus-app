import React, { memo, useMemo, type ReactElement } from 'react';
import { View } from 'react-native';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { Image } from 'expo-image';
import { Home, User, BarChart3, Sparkles } from 'lucide-react-native';
import Svg, { Circle, Line, Rect } from 'react-native-svg';

import { ICON_INACTIVE } from './liquidGlassTabBar.constants';
import { useProfileTabAvatar } from './useProfileTabAvatar';

const ICON_SIZE = 24;

const TAB_ACCENTS = {
  home: '#FFFFFF',
  matches: '#22C55E',
  ai: '#A855F7',
  rankings: '#F97316',
  profile: '#3B82F6',
} as const;

const PitchIcon = memo(function PitchIcon({
  color,
  size,
}: {
  color: string;
  size: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="2" y="4" width="20" height="16" rx="2" fill="none" stroke={color} strokeWidth="1.5" />
      <Line x1="12" y1="4" x2="12" y2="20" stroke={color} strokeWidth="1.5" />
      <Circle cx="12" cy="12" r="3" fill="none" stroke={color} strokeWidth="1.5" />
      <Rect x="2" y="7" width="4" height="10" fill="none" stroke={color} strokeWidth="1.5" />
      <Rect x="18" y="7" width="4" height="10" fill="none" stroke={color} strokeWidth="1.5" />
    </Svg>
  );
});

function lucidePair(
  render: (color: string) => ReactElement,
  accent: string,
) {
  return {
    default: render(ICON_INACTIVE),
    selected: render(accent),
  };
}

function ProfileTabIcon() {
  const avatarUrl = useProfileTabAvatar();

  const src = useMemo(() => {
    if (avatarUrl) {
      const image = (borderColor: string) => (
        <View
          style={{
            width: ICON_SIZE + 4,
            height: ICON_SIZE + 4,
            borderRadius: (ICON_SIZE + 4) / 2,
            borderWidth: 1.5,
            borderColor,
            overflow: 'hidden',
          }}
        >
          <Image
            source={{ uri: avatarUrl }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        </View>
      );
      return {
        default: image('rgba(255,255,255,0.35)'),
        selected: image(TAB_ACCENTS.profile),
      };
    }

    return lucidePair(
      (color) => <User color={color} size={ICON_SIZE} strokeWidth={2.2} />,
      TAB_ACCENTS.profile,
    );
  }, [avatarUrl]);

  return <NativeTabs.Trigger.Icon src={src} renderingMode="original" />;
}

export function NativeTabTriggers() {
  return (
    <>
      <NativeTabs.Trigger name="Home">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={lucidePair(
            (color) => <Home color={color} size={ICON_SIZE} strokeWidth={2.2} />,
            TAB_ACCENTS.home,
          )}
          renderingMode="original"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="matches">
        <NativeTabs.Trigger.Label>Matches</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={lucidePair(
            (color) => <PitchIcon color={color} size={ICON_SIZE} />,
            TAB_ACCENTS.matches,
          )}
          renderingMode="original"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="chat">
        <NativeTabs.Trigger.Label>AI</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={lucidePair(
            (color) => <Sparkles color={color} size={ICON_SIZE} strokeWidth={2.2} />,
            TAB_ACCENTS.ai,
          )}
          renderingMode="original"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="rank">
        <NativeTabs.Trigger.Label>Rankings</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={lucidePair(
            (color) => <BarChart3 color={color} size={ICON_SIZE} strokeWidth={2.2} />,
            TAB_ACCENTS.rankings,
          )}
          renderingMode="original"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
        <ProfileTabIcon />
      </NativeTabs.Trigger>
    </>
  );
}
