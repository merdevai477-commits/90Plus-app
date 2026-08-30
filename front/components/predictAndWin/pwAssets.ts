import type { ImageSourcePropType } from 'react-native';

export function hasSponsorLogo(logoUrl?: string | null): boolean {
  const uploaded = logoUrl?.trim();
  return Boolean(uploaded && /^https?:\/\//i.test(uploaded));
}

/** Remote sponsor logo only — no placeholder when the advertiser never uploaded one. */
export function sponsorLogoSource(logoUrl?: string | null): ImageSourcePropType | null {
  if (!hasSponsorLogo(logoUrl)) return null;
  return { uri: logoUrl!.trim() };
}
