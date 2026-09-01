import { useTheme } from '@shopify/restyle';
import { Image } from 'expo-image';

import { Theme } from '@/theme/theme';

interface SimklLogoProps {
  size?: keyof Theme['sizes'];
}

export const SimklLogo = ({ size = 'iconMedium' }: SimklLogoProps) => {
  const theme = useTheme<Theme>();
  const themeSize = theme.sizes[size] as number;
  return (
    <Image
      source={require('../../../assets/simkl-logo.png')}
      style={{ width: themeSize, height: themeSize }}
      contentFit="contain"
    />
  );
};
