import { useTheme } from '@shopify/restyle';
import FastImage from '@d11/react-native-fast-image';
import { Theme } from '@/theme/theme';

interface SimklLogoProps {
  size?: keyof Theme['sizes'];
}

export const SimklLogo = ({ size = 'iconMedium' }: SimklLogoProps) => {
  const theme = useTheme<Theme>();
  const themeSize = theme.sizes[size] as number;
  return (
    <FastImage
      source={require('../../../assets/simkl-logo.png')}
      style={{ width: themeSize, height: themeSize }}
      resizeMode={FastImage.resizeMode.contain}
    />
  );
};
