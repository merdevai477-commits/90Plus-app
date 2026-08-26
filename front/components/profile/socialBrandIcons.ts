import type { ImageSourcePropType } from 'react-native';
import type { SocialPlatformId } from '../../src/utils/socialPlatformDetect';
import { PROFILE_ICONS } from './profileV2Assets';

export const SOCIAL_BRAND_ICONS: Record<
  SocialPlatformId,
  { source: ImageSourcePropType; width: number; height: number }
> = {
  whatsapp: { source: PROFILE_ICONS.whatsapp, width: 33, height: 37 },
  instagram: { source: PROFILE_ICONS.instagram, width: 33, height: 33 },
  tiktok: { source: PROFILE_ICONS.tiktok, width: 30, height: 33 },
  facebook: { source: PROFILE_ICONS.facebook, width: 33, height: 33 },
  snapchat: { source: PROFILE_ICONS.snapchat, width: 33, height: 33 },
  twitter: { source: PROFILE_ICONS.x, width: 24, height: 24 },
  youtube: { source: PROFILE_ICONS.youtube, width: 30, height: 22 },
  linkedin: { source: PROFILE_ICONS.linkedin, width: 26, height: 26 },
  website: { source: PROFILE_ICONS.link, width: 24, height: 24 },
};

export function getSocialBrandIcon(platform: string) {
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
