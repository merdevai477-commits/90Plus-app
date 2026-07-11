import React from 'react';
import Svg, { Text as SvgText } from 'react-native-svg';

type PitchBrandLogoProps = {
  width?: number;
  height?: number;
};

/**
 * 90PLUS-app pitch mark — larger + high contrast for green SportRadar pitch.
 */
export function PitchBrandLogo({ width = 280, height = 84 }: PitchBrandLogoProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 280 84">
      {/* Soft shadow for contrast on bright grass */}
      <SvgText
        x="140"
        y="54"
        textAnchor="middle"
        fontFamily="Segoe UI, Arial, sans-serif"
        fontWeight="900"
        fontSize="34"
        fill="rgba(0,0,0,0.45)"
        letterSpacing="0.8"
      >
        90PLUS-app
      </SvgText>
      <SvgText
        x="140"
        y="52"
        textAnchor="middle"
        fontFamily="Segoe UI, Arial, sans-serif"
        fontWeight="900"
        fontSize="34"
        fill="#FFFFFF"
        letterSpacing="0.8"
      >
        90PLUS-app
      </SvgText>
    </Svg>
  );
}
