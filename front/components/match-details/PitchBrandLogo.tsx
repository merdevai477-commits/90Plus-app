import React from 'react';
import Svg, { Text as SvgText } from 'react-native-svg';

type PitchBrandLogoProps = {
  width?: number;
  height?: number;
};

/**
 * Same mark as c:\DD\assets\90plus-pitch-logo.svg — covers 365 mid-pitch branding.
 */
export function PitchBrandLogo({ width = 240, height = 72 }: PitchBrandLogoProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 240 72">
      <SvgText
        x="120"
        y="46"
        textAnchor="middle"
        fontFamily="Segoe UI, Arial, sans-serif"
        fontWeight="700"
        fontSize="26"
        fill="rgba(255,255,255,0.9)"
        letterSpacing="0.5"
      >
        90PLUS-app
      </SvgText>
    </Svg>
  );
}
