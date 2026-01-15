import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, Alert } from 'react-native';
import { Box, Text, Theme } from '@/theme/theme';
import { useTheme } from '@shopify/restyle';
import { Ionicons } from '@expo/vector-icons';
import { WizardContainer } from '@/components/setup/WizardContainer';
import { WizardStep } from '@/components/setup/WizardStep';
import { AddonsSettingsContent } from '@/components/settings/AddonsSettingsContent';
import { useAddonStore } from '@/store/addon.store';

export default function AddonsStep() {
  const router = useRouter();
  const theme = useTheme<Theme>();
  const hasAnyAddons = useAddonStore((state) => state.hasAddons());

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleNext = useCallback(() => {
    if (hasAnyAddons) {
      return router.push('/setup/home');
    }
    Alert.alert(
      'Skip Addon Setup?',
      'You need at least one metadata addon to browse content. You can add addons later in Settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Skip Anyway',
          onPress: () => router.push('/setup/home'),
        },
      ]
    );
  }, [hasAnyAddons, router]);

  return (
    <WizardContainer>
      <WizardStep
        step="addons"
        title="Add Streaming Sources"
        description="Install addons to discover and stream content"
        onNext={handleNext}
        onBack={handleBack}
        nextLabel={hasAnyAddons ? 'Continue' : 'Skip'}
        showSkip={false}
        hasTVPreferredFocus={hasAnyAddons}>
        <ScrollView showsVerticalScrollIndicator>
          <Box gap="l" paddingVertical="m">
            {/* Info card about addons */}
            <Box backgroundColor="cardBackground" padding="m" borderRadius="l" gap="m">
              <Box flexDirection="row" alignItems="center" gap="s">
                <Ionicons
                  name="information-circle"
                  size={24}
                  color={theme.colors.primaryBackground}
                />
                <Text variant="body" style={{ fontWeight: '600' }}>
                  About Addons
                </Text>
              </Box>
              <Text variant="bodySmall" color="textSecondary">
                DodoStream uses Stremio-compatible addons to provide content. You need at least one{' '}
                <Text style={{ fontWeight: '600' }}>metadata addon</Text> to browse movies and TV
                shows.
              </Text>
              <Text variant="bodySmall" color="textSecondary">
                Addons provide different types of content:{'\n'}•{' '}
                <Text style={{ fontWeight: '600' }}>Metadata</Text> - Browse catalogs and get
                information about content{'\n'}• <Text style={{ fontWeight: '600' }}>Streams</Text>{' '}
                - Provide playable video streams
                {'\n'}• <Text style={{ fontWeight: '600' }}>Subtitles</Text> - Add external
                subtitles
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
