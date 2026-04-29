import { FC, memo } from 'react';

import FastImage from '@d11/react-native-fast-image';
import { useTheme } from '@shopify/restyle';

import { Theme } from '@/theme/theme';

interface TraktLogoProps {
  size?: keyof Theme['sizes'];
}

export const TraktLogo: FC<TraktLogoProps> = memo(({ size = 'iconMedium' }) => {
  const theme = useTheme<Theme>();
  const themeSize = theme.sizes[size] as number;
  return (
    <FastImage
      source={require('../../../assets/trakt-logomark.png')}
      style={{ width: themeSize, height: themeSize }}
      resizeMode={FastImage.resizeMode.contain}
    />
  );
});

TraktLogo.displayName = 'TraktLogo';
