import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView } from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@shopify/restyle';
import { useRouter } from 'expo-router';

import { AddonsSettingsContent } from '@/components/settings/AddonsSettingsContent';
import { WizardContainer } from '@/components/setup/WizardContainer';
import { WizardStep } from '@/components/setup/WizardStep';
import { useAddonStore } from '@/store/addon.store';
import { Box, Text, Theme } from '@/theme/theme';

export default function AddonsStep() {
  const router = useRouter();
  const theme = useTheme<Theme>();
  const { t } = useTranslation(['setup', 'common']);
  const hasAnyAddons = useAddonStore((state) => state.hasAddons());

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleNext = useCallback(() => {
    if (hasAnyAddons) {
      return router.push('/setup/home');
    }
    Alert.alert(t('setup:addons.skip_title'), t('setup:addons.skip_message'), [
      { text: t('common:cancel'), style: 'cancel' },
      {
        text: t('setup:addons.skip_anyway'),
        onPress: () => router.push('/setup/home'),
      },
    ]);
  }, [hasAnyAddons, router, t]);

  return (
    <WizardContainer>
      <WizardStep
        step="addons"
        title={t('setup:addons.title')}
        description={t('setup:addons.description')}
        onNext={handleNext}
        onBack={handleBack}
        nextLabel={hasAnyAddons ? t('common:continue') : t('common:skip')}
        showSkip={false}
        hasTVPreferredFocus={hasAnyAddons}>
        <ScrollView showsVerticalScrollIndicator>
          <Box gap="l" paddingVertical="m">
            {/* Info card about addons */}
            <Box backgroundColor="cardBackground" padding="m" borderRadius="l" gap="m">
              <Box flexDirection="row" alignItems="center" gap="s">
                <Ionicons
                  name="information-circle"
                  size={theme.sizes.iconMedium}
                  color={theme.colors.primaryBackground}
                />
                <Text variant="body" style={{ fontWeight: '600' }}>
                  {t('setup:addons.about_title')}
                </Text>
              </Box>
              <Text variant="bodySmall" color="textSecondary">
                {t('setup:addons.about_description')}
              </Text>
              <Text variant="bodySmall" color="textSecondary">
                {t('setup:addons.about_types')}
                {'\n'}•{' '}
                <Text style={{ fontWeight: '600' }}>{t('setup:addons.about_type_metadata')}</Text>
                {t('setup:addons.about_type_metadata_desc')}
                {'\n'}•{' '}
                <Text style={{ fontWeight: '600' }}>{t('setup:addons.about_type_streams')}</Text>
                {t('setup:addons.about_type_streams_desc')}
                {'\n'}•{' '}
                <Text style={{ fontWeight: '600' }}>{t('setup:addons.about_type_subtitles')}</Text>
                {t('setup:addons.about_type_subtitles_desc')}
              </Text>
            </Box>

            {/* Reuse AddonsSettingsContent for install and list */}
            <AddonsSettingsContent scrollable={false} />
          </Box>
        </ScrollView>
      </WizardStep>
    </WizardContainer>
  );
}
