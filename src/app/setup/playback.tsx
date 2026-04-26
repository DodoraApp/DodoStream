import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('setup');

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
        title={t('playback.title')}
        description={t('playback.description')}
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
                size={theme.sizes.iconMedium}
                color={theme.colors.textSecondary}
              />
              <Box flex={1}>
                <Text variant="bodySmall" color="textSecondary">
                  {t('playback.info_desc')}
                </Text>
              </Box>
            </Box>
          </Box>
        </ScrollView>
      </WizardStep>
    </WizardContainer>
  );
}
