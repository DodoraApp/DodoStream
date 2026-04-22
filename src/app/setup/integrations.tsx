import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView } from 'react-native';
import { Box, Text, Theme } from '@/theme/theme';
import { useTheme } from '@shopify/restyle';
import { Ionicons } from '@expo/vector-icons';
import { WizardContainer } from '@/components/setup/WizardContainer';
import { WizardStep } from '@/components/setup/WizardStep';
import { IntegrationsSettingsContent } from '@/components/settings/IntegrationsSettingsContent';

export default function IntegrationsStep() {
  const router = useRouter();
  const theme = useTheme<Theme>();

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleNext = useCallback(() => {
    router.push('/setup/addons');
  }, [router]);

  return (
    <WizardContainer>
      <WizardStep
        step="integrations"
        title="Connect Your Accounts"
        description="Sync your watch history and watchlist with external services"
        onNext={handleNext}
        onBack={handleBack}
        nextLabel="Continue"
        showSkip={false}
        hasTVPreferredFocus>
        <ScrollView showsVerticalScrollIndicator>
          <Box gap="l" paddingVertical="m">
            {/* Info card about integrations */}
            <Box backgroundColor="cardBackground" padding="m" borderRadius="l" gap="m">
              <Box flexDirection="row" alignItems="center" gap="s">
                <Ionicons
                  name="sync-circle"
                  size={theme.sizes.iconMedium}
                  color={theme.colors.primaryBackground}
                />
                <Text variant="body" style={{ fontWeight: '600' }}>
                  About Integrations
                </Text>
              </Box>
              <Text variant="bodySmall" color="textSecondary">
                Connect your Simkl account to automatically track what you watch and keep your
                watchlist in sync across all your devices.
              </Text>
            </Box>

            <IntegrationsSettingsContent scrollable={false} />
          </Box>
        </ScrollView>
      </WizardStep>
    </WizardContainer>
  );
}
