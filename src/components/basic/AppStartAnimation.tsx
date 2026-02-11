import { FC, useRef } from 'react';
import { MotiView } from 'moti';
import { Easing } from 'react-native-reanimated';
import { Box, Text, Theme } from '@/theme/theme';
import { useTheme } from '@shopify/restyle';
import {
  APP_START_LOGO_FADE_IN_MS,
  APP_START_TEXT_EXPAND_DELAY_MS,
  APP_START_TEXT_EXPAND_MS,
} from '@/constants/ui';
import { LoadingIndicator } from '@/components/basic/LoadingIndicator';

export const AppStartAnimation: FC = () => {
  const theme = useTheme<Theme>();
  return (
    <Box flex={1} backgroundColor="mainBackground" justifyContent="center" alignItems="center">
      <Box flexDirection="row" alignItems="center">
        {/* Logo with fade-in and bounce */}
        <MotiView
          from={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            type: 'timing',
            duration: APP_START_LOGO_FADE_IN_MS,
            easing: Easing.out(Easing.cubic),
          }}>
          <LoadingIndicator />
        </MotiView>

        {/* Text with expand animation - delayed to start after logo fade-in */}
        <MotiView
          from={{ opacity: 0, width: 0 }}
          animate={{ opacity: 1, width: 'auto' }}
          transition={{
            type: 'timing',
            duration: APP_START_TEXT_EXPAND_MS,
            easing: Easing.out(Easing.cubic),
            delay: APP_START_TEXT_EXPAND_DELAY_MS,
          }}
          style={{ overflow: 'hidden', marginLeft: theme.spacing.m }}>
          <Text variant="header" color="textPrimary">
            DodoStream
          </Text>
        </MotiView>
      </Box>
    </Box>
  );
};
