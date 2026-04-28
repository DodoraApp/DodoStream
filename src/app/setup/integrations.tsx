import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@shopify/restyle';
import { useRouter } from 'expo-router';

import { IntegrationsSettingsContent } from '@/components/settings/IntegrationsSettingsContent';
import { WizardContainer } from '@/components/setup/WizardContainer';
import { WizardStep } from '@/components/setup/WizardStep';
import { Box, Text, Theme } from '@/theme/theme';

export default function IntegrationsStep() {
  const router = useRouter();
  const theme = useTheme<Theme>();
  const { t } = useTranslation(['setup', 'common']);

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
        title={t('setup:integrations.title')}
        description={t('setup:integrations.description')}
        onNext={handleNext}
        onBack={handleBack}
        nextLabel={t('common:continue')}
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
                  {t('setup:integrations.about_title')}
                </Text>
              </Box>
              <Text variant="bodySmall" color="textSecondary">
                {t('setup:integrations.about_description')}
              </Text>
            </Box>

            <IntegrationsSettingsContent scrollable={false} />
          </Box>
        </ScrollView>
      </WizardStep>
    </WizardContainer>
  );
}
