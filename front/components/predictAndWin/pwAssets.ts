import type { ImageSourcePropType } from 'react-native';

import type { SponsorPhoneSocialLinks } from './sponsorPhone';

/** Bundled placeholder when the advertiser removes their custom store photo. */
export const DEFAULT_STORE_LOGO = require('../../assets/images/store.png');

export function hasCustomSponsorLogo(logoUrl?: string | null): boolean {
  const uploaded = logoUrl?.trim();
  return Boolean(uploaded && /^https?:\/\//i.test(uploaded));
}

export function usesDefaultStoreLogo(links?: SponsorPhoneSocialLinks | null): boolean {
  return Boolean(links?.storeLogoDefault);
}

export function shouldShowSponsorLogo(
  logoUrl?: string | null,
  socialLinks?: SponsorPhoneSocialLinks | null,
): boolean {
  return hasCustomSponsorLogo(logoUrl) || usesDefaultStoreLogo(socialLinks);
}

export function sponsorLogoSource(
  logoUrl?: string | null,
  socialLinks?: SponsorPhoneSocialLinks | null,
): ImageSourcePropType | null {
  if (hasCustomSponsorLogo(logoUrl)) return { uri: logoUrl!.trim() };
  if (usesDefaultStoreLogo(socialLinks)) return DEFAULT_STORE_LOGO;
  return null;
}

/** @deprecated Use `shouldShowSponsorLogo` — kept for call-site clarity. */
export function hasSponsorLogo(
  logoUrl?: string | null,
  socialLinks?: SponsorPhoneSocialLinks | null,
): boolean {
  return shouldShowSponsorLogo(logoUrl, socialLinks);
}
