import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { useRouter } from 'expo-router';
import { MotiView } from 'moti';

import { Button } from '@/components/basic/Button';
import { WizardContainer } from '@/components/setup/WizardContainer';
import { WIZARD_CONTENT_FADE_MS } from '@/constants/ui';
import { Box, Text } from '@/theme/theme';

/**
 * Completion step - shows summary and launches the app
 */
export default function CompleteStep() {
  const router = useRouter();
  const { t } = useTranslation('setup');

  const handleFinish = useCallback(() => {
    // Navigate to main app - replace so user can't go back to wizard
    router.replace('/');
  }, [router]);

  return (
    <WizardContainer>
      <Box flex={1} paddingHorizontal="l" paddingVertical="m" justifyContent="center" gap="l">
        {/* Title */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: WIZARD_CONTENT_FADE_MS, delay: 200 }}>
          <Text variant="header" textAlign="center">
            {t('complete.title')}
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
              title={t('complete.start_exploring')}
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
