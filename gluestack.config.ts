import { createConfig } from '@gluestack-style/react';

export const config = createConfig({
  aliases: {
    bg: 'backgroundColor',
    p: 'padding',
    m: 'margin',
    px: 'paddingHorizontal',
    py: 'paddingVertical',
    mx: 'marginHorizontal',
    my: 'marginVertical',
    rounded: 'borderRadius',
  },
  tokens: {
    colors: {
      // Primary palette - Dark Mode
      background: '#121212',
      backgroundCard: '#1E1E1E',
      backgroundElevated: '#2A2A2A',
      
      // Accent colors
      primary: '#00A86B',
      primaryDark: '#008F5B',
      primaryLight: '#00C47D',
      
      // Semantic colors
      success: '#00A86B',
      warning: '#FFB800',
      error: '#FF4D4D',
      info: '#4DA6FF',
      
      // Text colors
      textPrimary: '#FFFFFF',
      textSecondary: '#B3B3B3',
      textMuted: '#666666',
      textInverse: '#121212',
      
      // Border colors
      border: '#333333',
      borderLight: '#444444',
      
      // Transparent
      transparent: 'transparent',
    },
    space: {
      '0': 0,
      '1': 4,
      '2': 8,
      '3': 12,
      '4': 16,
      '5': 20,
      '6': 24,
      '7': 28,
      '8': 32,
      '10': 40,
      '12': 48,
      '16': 64,
      '20': 80,
      '24': 96,
    },
    radii: {
      none: 0,
      sm: 4,
      md: 8,
      lg: 12,
      xl: 16,
      '2xl': 24,
      full: 9999,
    },
    fontSizes: {
      xs: 12,
      sm: 14,
      md: 16,
      lg: 18,
      xl: 20,
      '2xl': 24,
      '3xl': 30,
      '4xl': 36,
    },
    fontWeights: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    },
    lineHeights: {
      xs: 16,
      sm: 20,
      md: 24,
      lg: 28,
      xl: 32,
    },
  },
  globalStyle: {
    variants: {},
  },
} as const);

// Type for the config
export type Config = typeof config;

