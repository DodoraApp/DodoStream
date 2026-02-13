import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { Box, Text, Theme } from '@/theme/theme';
import { useTheme } from '@shopify/restyle';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { WIZARD_CONTENT_FADE_MS } from '@/constants/ui';
import { WizardContainer } from '@/components/setup/WizardContainer';
import { Button } from '@/components/basic/Button';

/**
 * Welcome step - introduces the app and lets the user choose
 * between creating a local profile or connecting to a sync server first.
 */
export default function WelcomeStep() {
  const router = useRouter();
  const theme = useTheme<Theme>();

  const handleCreateProfile = useCallback(() => {
    router.push('/setup/profile');
  }, [router]);

  const handleConnectSync = useCallback(() => {
    router.push('/setup/sync');
  }, [router]);

  return (
    <WizardContainer>
      <Box flex={1} paddingHorizontal="l" paddingVertical="m" justifyContent="center" gap="xl">
        {/* App title */}
        <MotiView
          from={{ opacity: 0, translateY: -20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: WIZARD_CONTENT_FADE_MS }}>
          <Box alignItems="center" gap="s">
            <Text variant="header" textAlign="center">
              Welcome to DodoStream
            </Text>
            <Text variant="body" color="textSecondary" textAlign="center">
              Choose how you&apos;d like to get started
            </Text>
          </Box>
        </MotiView>

        {/* Options */}
        <Box gap="m">
          {/* Create profile option */}
          <MotiView
            from={{ opacity: 0, translateX: -20 }}
            animate={{ opacity: 1, translateX: 0 }}
            transition={{ type: 'timing', duration: WIZARD_CONTENT_FADE_MS, delay: 200 }}>
            <Button
              variant="primary"
              title="Create a Profile"
              icon="person-add"
              onPress={handleCreateProfile}
              hasTVPreferredFocus
            />
            <Box paddingHorizontal="s" paddingTop="xs">
              <Text variant="caption" color="textSecondary">
                Start fresh with a new local profile
              </Text>
            </Box>
          </MotiView>

          {/* Divider */}
          <MotiView
            from={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ type: 'timing', duration: WIZARD_CONTENT_FADE_MS, delay: 300 }}>
            <Box flexDirection="row" alignItems="center" gap="m" paddingVertical="xs">
              <Box flex={1} height={1} backgroundColor="cardBorder" />
              <Text variant="caption" color="textSecondary">
                or
              </Text>
              <Box flex={1} height={1} backgroundColor="cardBorder" />
            </Box>
          </MotiView>

          {/* Connect to sync server option */}
          <MotiView
            from={{ opacity: 0, translateX: -20 }}
            animate={{ opacity: 1, translateX: 0 }}
            transition={{ type: 'timing', duration: WIZARD_CONTENT_FADE_MS, delay: 400 }}>
            <Button
              variant="secondary"
              title="Connect to Sync Server"
              icon="cloud-outline"
              onPress={handleConnectSync}
            />
            <Box paddingHorizontal="s" paddingTop="xs">
              <Text variant="caption" color="textSecondary">
                Sync profiles, addons, and watch history from an existing server
              </Text>
            </Box>
          </MotiView>
        </Box>

        {/* Feature highlights */}
        <MotiView
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ type: 'timing', duration: WIZARD_CONTENT_FADE_MS, delay: 500 }}>
          <Box gap="m" paddingTop="m">
            <FeatureItem icon="extension-puzzle" title="Install Streaming Addons" />
            <FeatureItem icon="tv" title="Watch on Any Device" />
            <FeatureItem icon="sync" title="Keep Everything in Sync" />
          </Box>
        </MotiView>
      </Box>
    </WizardContainer>
  );
}

interface FeatureItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
}

function FeatureItem({ icon, title }: FeatureItemProps) {
  const theme = useTheme<Theme>();

  return (
    <Box flexDirection="row" gap="m" alignItems="center">
      <Box
        width={44}
        height={44}
        borderRadius="m"
        backgroundColor="cardBackground"
        justifyContent="center"
        alignItems="center">
        <Ionicons name={icon} size={22} color={theme.colors.primaryBackground} />
      </Box>
      <Text variant="cardTitle">{title}</Text>
    </Box>
  );
}
