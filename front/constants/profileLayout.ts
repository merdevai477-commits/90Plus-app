import { Dimensions } from 'react-native';

/** Negative margin that pulls the FIFA card over the cover — scaled for small screens. */
export function getProfileCardOverlapMargin(screenHeight?: number): number {
  const h = screenHeight ?? Dimensions.get('window').height;
  if (h <= 600) return -140;
  if (h <= 667) return -180;
  if (h <= 736) return -220;
  if (h <= 812) return -260;
  return -300;
}
