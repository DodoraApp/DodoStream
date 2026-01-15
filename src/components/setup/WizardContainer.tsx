import { FC, memo, ReactNode } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Box, Theme } from '@/theme/theme';
import { useTheme } from '@shopify/restyle';
import { MotiView } from 'moti';
import { WIZARD_STEP_ANIMATION_MS } from '@/constants/ui';

interface WizardContainerProps {
  children: ReactNode;
}

/**
 * Root container for the setup wizard
 * Provides safe area handling and consistent background
 */
export const WizardContainer: FC<WizardContainerProps> = memo(({ children }) => {
  const theme = useTheme<Theme>();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.mainBackground }}>
      <MotiView
        from={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ type: 'timing', duration: WIZARD_STEP_ANIMATION_MS }}
        style={{ flex: 1 }}>
        <Box flex={1} backgroundColor="mainBackground">
          {children}
        </Box>
      </MotiView>
    </SafeAreaView>
  );
});

WizardContainer.displayName = 'WizardContainer';
