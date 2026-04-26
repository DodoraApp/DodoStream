import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import { Box } from '@/theme/theme';
import { WizardContainer } from '@/components/setup/WizardContainer';
import { WizardStep } from '@/components/setup/WizardStep';
import { ProfileEditorContent } from '@/components/profile/ProfileEditor';
import { useProfileStore } from '@/store/profile.store';
import { useSetupWizardStore } from '@/store/setup-wizard.store';

/**
 * Profile creation step - mandatory step to create first profile
 * Reuses ProfileEditorContent for the form UI
 */
export default function ProfileStep() {
  const router = useRouter();
  const { t } = useTranslation(['setup', 'profiles']);
  const switchProfile = useProfileStore((state) => state.switchProfile);
  const setCreatedProfileId = useSetupWizardStore((state) => state.setCreatedProfileId);

  const handleBack = useCallback(() => {
    router.push('/setup/ui');
  }, [router]);

  const handleSave = useCallback(
    (profileId: string) => {
      // Activate the profile
      switchProfile(profileId);

      // Store the profile ID for later steps
      setCreatedProfileId(profileId);

      // Navigate to integrations step
      router.push('/setup/integrations');
    },
    [switchProfile, setCreatedProfileId, router]
  );

  return (
    <WizardContainer>
      <WizardStep
        step="profile"
        title={t('setup:profile.title')}
        description={t('setup:profile.description')}
        onBack={handleBack}
        showSkip={false}
        showNext={false}>
        <ScrollView showsVerticalScrollIndicator>
          <Box paddingVertical="m">
            <ProfileEditorContent
              onSave={handleSave}
              showPin={false}
              scrollable={false}
              saveButtonLabel={t('profiles:create_profile')}
            />
          </Box>
        </ScrollView>
      </WizardStep>
    </WizardContainer>
  );
}
