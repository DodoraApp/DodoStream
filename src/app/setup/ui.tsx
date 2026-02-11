import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView } from 'react-native';
import { Box } from '@/theme/theme';
import { WizardContainer } from '@/components/setup/WizardContainer';
import { WizardStep } from '@/components/setup/WizardStep';
import { UISettingsContent } from '@/components/settings/UISettingsContent';

/**
 * UI settings step - customize theme and scaling
 * First step after welcome in the setup wizard
 */
export default function UIStep() {
  const router = useRouter();

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
        title="Choose Your Style"
        description="Pick a theme and adjust the UI scaling"
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
