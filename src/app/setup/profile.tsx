import { useCallback } from 'react';
import { useRouter } from 'expo-router';
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
  const switchProfile = useProfileStore((state) => state.switchProfile);
  const setCreatedProfileId = useSetupWizardStore((state) => state.setCreatedProfileId);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleSave = useCallback(
    (profileId: string) => {
      // Activate the profile
      switchProfile(profileId);

      // Store the profile ID for later steps
      setCreatedProfileId(profileId);

      // Navigate to addons step
      router.push('/setup/addons');
    },
    [switchProfile, setCreatedProfileId, router]
  );

  return (
    <WizardContainer>
      <WizardStep
        step="profile"
        title="Create Your Profile"
        description="Choose a name and avatar that represents you"
        onBack={handleBack}
        showSkip={false}
        showNext={false}>
        <ScrollView showsVerticalScrollIndicator>
          <Box paddingVertical="m">
            <ProfileEditorContent
              onSave={handleSave}
              showPin={false}
              scrollable={false}
              saveButtonLabel="Create Profile"
            />
          </Box>
        </ScrollView>
      </WizardStep>
    </WizardContainer>
  );
}
