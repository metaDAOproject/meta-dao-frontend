'use client';

import {
  Container,
  VariantColorsResolver,
  VariantColorsResolverInput,
  createTheme,
  darken,
  defaultVariantColorsResolver,
  parseThemeColor,
  rem,
  rgba,
} from '@mantine/core';

const CONTAINER_SIZES: Record<string, string> = {
  '3xs': rem(250),
  xxs: rem(300),
  xs: rem(400),
  sm: rem(500),
  md: rem(600),
  lg: rem(700),
  xl: rem(800),
  xxl: rem(900),
};

const variantColorResolver: VariantColorsResolver = (input: VariantColorsResolverInput) => {
  const defaultResolvedColors = defaultVariantColorsResolver(input);
  const parsedColor = parseThemeColor({
    color: input.color || input.theme.primaryColor,
    theme: input.theme,
  });

  const gray = parseThemeColor({ color: '#AAA', theme: input.theme, colorScheme: 'dark' });

  if (input.variant === 'secondary') {
    return {
      background: rgba(gray.color, 0.1),
      hover: rgba(gray.color, 0.15),
      border: '',
      color: darken(gray.value, 0.1),
    };
  }

  // Completely override variant
  if (input.variant === 'light') {
    return {
      background: rgba(parsedColor.value, 0.1),
      hover: rgba(parsedColor.value, 0.15),
      border: `${rem(1)} solid ${defaultResolvedColors.color}`,
      color: darken(defaultResolvedColors.color, 0.8),
    };
  }

  // Add new variants support
  if (input.variant === 'danger') {
    return {
      background: 'var(--mantine-color-red-9)',
      hover: 'var(--mantine-color-red-8)',
      color: 'var(--mantine-color-white)',
      border: 'none',
    };
  }

  return defaultResolvedColors;
};

export const theme = createTheme({
  variantColorResolver,
  primaryColor: 'red',
  components: {
    Container: Container.extend({
      vars: (_, { size, fluid }) => ({
        root: {
          '--container-size': fluid
            ? '100%'
            : size !== undefined && size in CONTAINER_SIZES
            ? CONTAINER_SIZES[size]
            : rem(size),
        },
      }),
    }),
  },
});
