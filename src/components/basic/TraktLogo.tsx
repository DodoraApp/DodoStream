import { FC, memo } from 'react';

import { useTheme } from '@shopify/restyle';
import { Image } from 'expo-image';

import { Theme } from '@/theme/theme';

interface TraktLogoProps {
  size?: keyof Theme['sizes'];
}

export const TraktLogo: FC<TraktLogoProps> = memo(({ size = 'iconMedium' }) => {
  const theme = useTheme<Theme>();
  const themeSize = theme.sizes[size] as number;
  return (
    <Image
      source={require('../../../assets/trakt-logomark.png')}
      style={{ width: themeSize, height: themeSize }}
      contentFit="contain"
    />
  );
});

TraktLogo.displayName = 'TraktLogo';
