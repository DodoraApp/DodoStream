import { memo } from 'react';
import { useTheme } from '@shopify/restyle';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { type Theme } from '@/theme/theme';
import { LOGO_PATH_D } from '@/constants/logo-path';

interface AppLogoProps {
  size: number;
  color?: string;
}

const GRADIENT_ID = 'appLogoGradient';

export const AppLogo = memo(({ size, color }: AppLogoProps) => {
  const theme = useTheme<Theme>();

  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024">
      <Defs>
        <LinearGradient id={GRADIENT_ID} x1="1" y1="1" x2="0" y2="0">
          <Stop offset="0%" stopColor={theme.colors.tertiaryBackground} />
          <Stop offset="70%" stopColor={theme.colors.primaryBackground} />
        </LinearGradient>
      </Defs>

      <Path d={LOGO_PATH_D} fill={color ?? `url(#${GRADIENT_ID})`} fillRule="evenodd" />
    </Svg>
  );
});

AppLogo.displayName = 'AppLogo';
