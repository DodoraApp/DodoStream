import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView } from 'react-native';
import { Box } from '@/theme/theme';
import { WizardContainer } from '@/components/setup/WizardContainer';
import { WizardStep } from '@/components/setup/WizardStep';
import { HomeSettingsContent } from '@/components/settings/HomeSettingsContent';

/**
 * Home settings step - customize home screen appearance
 * Reuses HomeSettingsContent for the actual settings UI
 */
export default function HomeStep() {
  const router = useRouter();

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleNext = useCallback(() => {
    router.push('/setup/playback');
  }, [router]);

  return (
    <WizardContainer>
      <WizardStep
        step="home"
        title="Customize Home Screen"
        description="Configure how your home screen looks"
        onNext={handleNext}
        onBack={handleBack}
        onSkip={handleNext}
        hasTVPreferredFocus>
        <ScrollView showsVerticalScrollIndicator>
          <Box paddingVertical="m">
            <HomeSettingsContent scrollable={false} />
          </Box>
        </ScrollView>
      </WizardStep>
    </WizardContainer>
  );
}
