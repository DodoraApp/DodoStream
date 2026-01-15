import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { Box, Text, Theme } from '@/theme/theme';
import { useTheme } from '@shopify/restyle';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { WizardContainer } from '@/components/setup/WizardContainer';
import { Button } from '@/components/basic/Button';
import { WIZARD_CONTENT_FADE_MS } from '@/constants/ui';

/**
 * Completion step - shows summary and launches the app
 */
export default function CompleteStep() {
  const router = useRouter();
  const theme = useTheme<Theme>();

  const handleFinish = useCallback(() => {
    // Navigate to main app - replace so user can't go back to wizard
    router.replace('/');
  }, [router]);

  return (
    <WizardContainer>
      <Box flex={1} paddingHorizontal="l" paddingVertical="m" justifyContent="center" gap="l">
        {/* Success icon */}
        <MotiView
          from={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 15, delay: 100 }}>
          <Box alignItems="center">
            <Box
              width={100}
              height={100}
              borderRadius="full"
              backgroundColor="primaryBackground"
              justifyContent="center"
              alignItems="center">
              <Ionicons name="checkmark" size={60} color={theme.colors.primaryForeground} />
            </Box>
          </Box>
        </MotiView>

        {/* Title */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: WIZARD_CONTENT_FADE_MS, delay: 200 }}>
          <Text variant="header" textAlign="center">
            You&apos;re All Set!
          </Text>
        </MotiView>

        {/* Finish button */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: WIZARD_CONTENT_FADE_MS, delay: 400 }}>
          <Box alignItems="center">
            <Button
              variant="primary"
              title="Start Exploring"
              icon="arrow-forward"
              onPress={handleFinish}
              hasTVPreferredFocus
            />
          </Box>
        </MotiView>
      </Box>
    </WizardContainer>
  );
}
