import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';

import { useRouter } from 'expo-router';

import { UISettingsContent } from '@/components/settings/UISettingsContent';
import { WizardContainer } from '@/components/setup/WizardContainer';
import { WizardStep } from '@/components/setup/WizardStep';
import { Box } from '@/theme/theme';

/**
 * UI settings step - customize theme and scaling
 * First step after welcome in the setup wizard
 */
export default function UIStep() {
  const router = useRouter();
  const { t } = useTranslation('setup');

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleNext = useCallback(() => {
    router.push('/setup/profile');
  }, [router]);

  return (
    <WizardContainer>
      <WizardStep
        step="ui"
        title={t('ui.title')}
        description={t('ui.description')}
        onNext={handleNext}
        onBack={handleBack}
        onSkip={handleNext}
        hasTVPreferredFocus>
        <ScrollView showsVerticalScrollIndicator={false}>
          <Box paddingVertical="m">
            <UISettingsContent />
          </Box>
        </ScrollView>
      </WizardStep>
    </WizardContainer>
  );
}
