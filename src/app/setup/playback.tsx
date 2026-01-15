import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView } from 'react-native';
import { Box, Text, Theme } from '@/theme/theme';
import { useTheme } from '@shopify/restyle';
import { Ionicons } from '@expo/vector-icons';
import { WizardContainer } from '@/components/setup/WizardContainer';
import { WizardStep } from '@/components/setup/WizardStep';
import { PlaybackSettingsContent } from '@/components/settings/PlaybackSettingsContent';

export default function PlaybackStep() {
  const router = useRouter();
  const theme = useTheme<Theme>();

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleNext = useCallback(() => {
    router.push('/setup/complete');
  }, [router]);

  return (
    <WizardContainer>
      <WizardStep
        step="playback"
        title="Playback Preferences"
        description="Configure how content plays"
        onNext={handleNext}
        onBack={handleBack}
        showSkip={false}
        hasTVPreferredFocus>
        <ScrollView showsVerticalScrollIndicator>
          <Box paddingVertical="m" gap="l">
            {/* Reuse PlaybackSettingsContent for settings */}
            <PlaybackSettingsContent scrollable={false} />

            {/* Info about additional settings */}
            <Box
              backgroundColor="cardBackground"
              padding="m"
              borderRadius="l"
              flexDirection="row"
              alignItems="center"
              gap="m"
              marginHorizontal="m">
              <Ionicons
                name="information-circle-outline"
                size={24}
                color={theme.colors.textSecondary}
              />
              <Box flex={1}>
                <Text variant="bodySmall" color="textSecondary">
                  You can customize subtitle styles, player settings, and more in the Settings menu
                  after setup.
                </Text>
              </Box>
            </Box>
          </Box>
        </ScrollView>
      </WizardStep>
    </WizardContainer>
  );
}
