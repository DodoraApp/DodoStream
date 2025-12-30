import theme, { Box, Text } from '@/theme/theme';
import { AppLogo } from '@/components/basic/AppLogo';
import { LOADING_LOGO_ANIMATION_DURATION_MS } from '@/constants/ui';
// import { useEffect } from 'react';
import { ActivityIndicator } from 'react-native';
import { MotiView } from 'moti';
import { Easing } from 'react-native-reanimated';

interface LoadingIndicatorProps {
  type?: 'default' | 'simple';
  size?: 'small' | 'large';
  message?: string;
}

const SimpleLoadingIndicator = ({ size }: { size: 'small' | 'large' }) => {
  return (
    <Box justifyContent="center" alignItems="center">
      <ActivityIndicator size={size} color={theme.colors.primaryBackground} />
    </Box>
  );
};

const LogoLoadingIndicator = ({ size, message }: { size: 'small' | 'large'; message?: string }) => {
  const containerSize =
    size === 'small'
      ? theme.sizes.loadingIndicatorSizeSmall
      : theme.sizes.loadingIndicatorSizeLarge;
  const logoSize =
    size === 'small'
      ? theme.sizes.loadingIndicatorLogoSizeSmall
      : theme.sizes.loadingIndicatorLogoSizeLarge;

  const travelDistance = theme.spacing.s;
  return (
    <Box
      flex={1}
      justifyContent="center"
      alignItems="center"
      alignSelf="center"
      width={containerSize}
      height={containerSize}>
      <MotiView
        from={{ translateY: 0 }}
        animate={{ translateY: travelDistance }}
        transition={{
          type: 'timing',
          duration: LOADING_LOGO_ANIMATION_DURATION_MS,
          loop: true,
          easing: Easing.inOut(Easing.ease),
        }}
        style={{ paddingHorizontal: theme.spacing.s }}>
        <AppLogo size={logoSize} />
      </MotiView>
      {message && (
        <Text variant="body" marginTop="m" color="textSecondary">
          {message}
        </Text>
      )}
    </Box>
  );
};

export const LoadingIndicator = ({
  type = 'default',
  size = 'large',
  message,
}: LoadingIndicatorProps) => {
  if (type === 'simple') {
    return <SimpleLoadingIndicator size={size} />;
  }

  return <LogoLoadingIndicator size={size} message={message} />;
};
