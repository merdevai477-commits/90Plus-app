/**
 * GlassCard — Premium glass-morphism card component
 * Based on 90Plus design system
 */

import { Card, type CardProps } from 'tamagui';
import { styled } from '@tamagui/core';

export const GlassCard = styled(Card, {
  name: 'GlassCard',
  
  backgroundColor: '$glass',
  borderWidth: 1,
  borderColor: '$glassBorder',
  borderRadius: '$6',
  
  shadowColor: '$shadowColor',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.3,
  shadowRadius: 16,
  elevation: 8,
  
  variants: {
    variant: {
      default: {
        backgroundColor: '$glass',
      },
      medium: {
        backgroundColor: '$glassMedium',
      },
      dark: {
        backgroundColor: '$glassDark',
      },
      solid: {
        backgroundColor: '$surface',
      },
    },
    
    elevation: {
      low: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
      },
      medium: {
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 8,
      },
      high: {
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.4,
        shadowRadius: 24,
        elevation: 16,
      },
      highest: {
        shadowOffset: { width: 0, height: 24 },
        shadowOpacity: 0.5,
        shadowRadius: 40,
        elevation: 24,
      },
    },
    
    pressable: {
      true: {
        cursor: 'pointer',
        hoverStyle: {
          backgroundColor: '$glassMedium',
          borderColor: '$primary500',
        },
        pressStyle: {
          scale: 0.98,
        },
      },
    },
  } as const,
  
  defaultVariants: {
    variant: 'default',
    elevation: 'medium',
  },
});

export type GlassCardProps = CardProps & {
  variant?: 'default' | 'medium' | 'dark' | 'solid';
  elevation?: 'low' | 'medium' | 'high' | 'highest';
  pressable?: boolean;
};
