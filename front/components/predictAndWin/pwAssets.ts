import type { ImageSourcePropType } from 'react-native';

/** Default store / sponsor logo when the advertiser uploads none. */
export const DEFAULT_STORE_LOGO = require('../../assets/images/store.png');

export function sponsorLogoSource(logoUrl?: string | null): ImageSourcePropType {
  const uploaded = logoUrl?.trim();
  if (uploaded && /^https?:\/\//i.test(uploaded)) return { uri: uploaded };
  return DEFAULT_STORE_LOGO;
}
