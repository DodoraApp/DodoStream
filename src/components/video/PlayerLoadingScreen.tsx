import { memo } from 'react';
import { StyleSheet } from 'react-native';
import { MotiView } from 'moti';
import { Easing } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Box } from '@/theme/theme';
import { useTheme } from '@shopify/restyle';
import type { Theme } from '@/theme/theme';
import { AppLogo } from '@/components/basic/AppLogo';
import { LOADING_LOGO_ANIMATION_DURATION_MS } from '@/constants/ui';

interface PlayerLoadingScreenProps {
  /** Background image URL */
  backgroundImage?: string;
  /** Logo image URL */
  logoImage?: string;
}

/**
 * A custom loading screen for the video player that displays on first load.
 * Shows the background image (if available) with a pulsating logo in the center.
 * If a logo image is provided, it uses that; otherwise falls back to the app logo.
 */
export const PlayerLoadingScreen = memo(
  ({ backgroundImage, logoImage }: PlayerLoadingScreenProps) => {
    const theme = useTheme<Theme>();

    return (
      <Box flex={1} backgroundColor="playerBackground" style={StyleSheet.absoluteFill}>
        {/* Background image */}
        {backgroundImage && (
          <Image
            source={{ uri: backgroundImage }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
        )}

        {/* Centered pulsating logo */}
        <Box flex={1} justifyContent="center" alignItems="center">
          <MotiView
            from={{ scale: 1, opacity: 0.7 }}
            animate={{ scale: 1.1, opacity: 1 }}
            transition={{
              type: 'timing',
              duration: LOADING_LOGO_ANIMATION_DURATION_MS,
              loop: true,
              easing: Easing.inOut(Easing.ease),
            }}>
            {logoImage ? (
              <Image
                source={{ uri: logoImage }}
                style={{
                  width: Math.min(theme.sizes.logoMaxWidth, 300),
                  height: theme.sizes.logoHeight,
                }}
                contentFit="contain"
              />
            ) : (
              <AppLogo size={theme.sizes.loadingIndicatorLogoSizeLarge} />
            )}
          </MotiView>
        </Box>
      </Box>
    );
  }
);

PlayerLoadingScreen.displayName = 'PlayerLoadingScreen';
