import { FC, memo, useCallback, useState } from 'react';
import { ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { showToast } from '@/store/toast.store';
import * as Updates from 'expo-updates';
import { useTheme } from '@shopify/restyle';
import type { Theme } from '@/theme/theme';
import { Box, Text } from '@/theme/theme';
import { Focusable } from '@/components/basic/Focusable';
import { Input } from '@/components/basic/Input';
import { SettingsCard } from '@/components/settings/SettingsCard';
import { SettingsRow } from '@/components/settings/SettingsRow';
import { TOAST_DURATION_SHORT } from '@/constants/ui';
import { useDebugLogger } from '@/utils/debug';
import { useDeveloperStore } from '@/store/developer.store';
import { getFocusableBackgroundColor } from '@/utils/focus-colors';

/**
 * Developer settings content component.
 * Provides access to developer-only settings like Sentry DSN configuration.
 * Only accessible by tapping the app version 5 times.
 */
export const DeveloperSettingsContent: FC = memo(() => {
  const theme = useTheme<Theme>();
  const debug = useDebugLogger('DeveloperSettingsContent');

  const sentryDsn = useDeveloperStore((state) => state.sentryDsn);
  const setSentryDsn = useDeveloperStore((state) => state.setSentryDsn);
  const resetSentryDsn = useDeveloperStore((state) => state.resetSentryDsn);

  const [dsnInput, setDsnInput] = useState(sentryDsn);
  const [isRestarting, setIsRestarting] = useState(false);

  const handleSaveAndRestart = useCallback(async () => {
    debug('saveAndRestart', { dsn: dsnInput });

    // Save the DSN
    setSentryDsn(dsnInput.trim());

    showToast({
      title: 'Sentry DSN saved',
      message: 'Restarting app to apply changes...',
      duration: TOAST_DURATION_SHORT,
    });

    setIsRestarting(true);

    // Small delay to show the toast
    setTimeout(async () => {
      try {
        await Updates.reloadAsync();
      } catch (error) {
        debug('restartError', { error });
        // If expo-updates reload fails (dev mode), show a toast
        showToast({
          title: 'Restart Required',
          message: 'Please close and reopen the app to apply the new Sentry DSN.',
          preset: 'warning',
        });
        setIsRestarting(false);
      }
    }, 500);
  }, [dsnInput, setSentryDsn, debug]);

  const handleReset = useCallback(() => {
    debug('resetDsn');
    resetSentryDsn();
    setDsnInput(process.env.EXPO_PUBLIC_SENTRY_DSN ?? '');

    showToast({
      title: 'DSN reset',
      message: 'Restart the app to apply changes.',
      duration: TOAST_DURATION_SHORT,
    });
  }, [resetSentryDsn, debug]);

  const hasChanges = dsnInput.trim() !== sentryDsn;

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <Box paddingVertical="m" paddingHorizontal="m" gap="l">
        <Box alignItems="center" gap="s" paddingTop="m">
          <Ionicons name="code-slash" size={48} color={theme.colors.primaryBackground} />
          <Text variant="header">Developer Settings</Text>
          <Text variant="caption" color="textSecondary" textAlign="center">
            These settings are for development and debugging purposes.
          </Text>
        </Box>

        <SettingsCard title="Sentry">
          <SettingsRow label="DSN" description="The Sentry Data Source Name for error reporting" />

          <Box gap="m">
            <Input
              value={dsnInput}
              onChangeText={setDsnInput}
              placeholder="https://...@sentry.io/..."
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />

            <Box flexDirection="row" gap="s">
              <Box flex={1}>
                <Focusable disabled={isRestarting} onPress={handleReset}>
                  {({ isFocused }) => (
                    <Box
                      backgroundColor={getFocusableBackgroundColor({
                        isFocused,
                        defaultColor: 'inputBackground',
                      })}
                      borderRadius="m"
                      paddingVertical="m"
                      flexDirection="row"
                      alignItems="center"
                      justifyContent="center"
                      gap="s">
                      <Ionicons name="refresh" size={20} color={theme.colors.textSecondary} />
                      <Text variant="body">Reset to Default</Text>
                    </Box>
                  )}
                </Focusable>
              </Box>

              <Box flex={1}>
                <Focusable disabled={!hasChanges || isRestarting} onPress={handleSaveAndRestart}>
                  {({ isFocused }) => (
                    <Box
                      backgroundColor={getFocusableBackgroundColor({
                        isFocused,
                        defaultColor: hasChanges ? 'primaryBackground' : 'inputBackground',
                      })}
                      borderRadius="m"
                      paddingVertical="m"
                      flexDirection="row"
                      alignItems="center"
                      justifyContent="center"
                      gap="s"
                      opacity={hasChanges ? 1 : 0.5}>
                      <Ionicons
                        name={isRestarting ? 'hourglass-outline' : 'save'}
                        size={20}
                        color={
                          hasChanges ? theme.colors.primaryForeground : theme.colors.textSecondary
                        }
                      />
                      <Text
                        variant="body"
                        color={hasChanges ? 'primaryForeground' : 'textSecondary'}>
                        {isRestarting ? 'Restarting...' : 'Save & Restart'}
                      </Text>
                    </Box>
                  )}
                </Focusable>
              </Box>
            </Box>
          </Box>
        </SettingsCard>

        <SettingsCard title="Current Configuration">
          <SettingsRow label="Stored DSN">
            <Text
              variant="caption"
              color="textSecondary"
              numberOfLines={1}
              style={{ maxWidth: 200 }}>
              {sentryDsn || '(not set)'}
            </Text>
          </SettingsRow>

          <SettingsRow label="Sentry Enabled">
            <Text variant="body" color="textSecondary">
              {sentryDsn ? 'Yes' : 'No'}
            </Text>
          </SettingsRow>
        </SettingsCard>
      </Box>
    </ScrollView>
  );
});

DeveloperSettingsContent.displayName = 'DeveloperSettingsContent';
