import type { ImageSourcePropType } from 'react-native';
import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';
import type { SocialPlatformId } from '../../src/utils/socialPlatformDetect';
import { PROFILE_ICONS } from './profileV2Assets';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export type SocialBrandVisual = {
  source: ImageSourcePropType;
  width: number;
  height: number;
  /** SVG/PNG that is white-only — invisible on light surfaces unless contrasted. */
  lightInvisible?: boolean;
  ionicon?: IoniconName;
  brandColor?: string;
};

export const SOCIAL_BRAND_ICONS: Record<SocialPlatformId, SocialBrandVisual> = {
  whatsapp: { source: PROFILE_ICONS.whatsapp, width: 22, height: 24, brandColor: '#25D366' },
  instagram: { source: PROFILE_ICONS.instagram, width: 22, height: 22, brandColor: '#E4405F' },
  tiktok: { source: PROFILE_ICONS.tiktok, width: 20, height: 22, brandColor: '#010101' },
  facebook: { source: PROFILE_ICONS.facebook, width: 22, height: 22, brandColor: '#0866FF' },
  snapchat: { source: PROFILE_ICONS.snapchat, width: 22, height: 22, brandColor: '#FFFC00' },
  twitter: {
    source: PROFILE_ICONS.x,
    width: 18,
    height: 18,
    lightInvisible: true,
    ionicon: 'logo-twitter',
    brandColor: '#0F1419',
  },
  youtube: { source: PROFILE_ICONS.youtube, width: 22, height: 16, brandColor: '#FF0000' },
  linkedin: { source: PROFILE_ICONS.linkedin, width: 20, height: 20, brandColor: '#0A66C2' },
  website: {
    source: PROFILE_ICONS.link,
    width: 18,
    height: 18,
    lightInvisible: true,
    ionicon: 'link-outline',
    brandColor: '#6A2BD9',
  },
};

export function getSocialBrandIcon(platform: string): SocialBrandVisual {
  const key = platform.toLowerCase() as SocialPlatformId;
  return SOCIAL_BRAND_ICONS[key] ?? SOCIAL_BRAND_ICONS.website;
}

export function socialPlatformLabel(
  t: { profile: Record<string, unknown> },
  platform: SocialPlatformId,
): string {
  const label = t.profile[platform];
  return typeof label === 'string' ? label : platform;
}
