import { FC, memo, useCallback, useMemo, useRef } from 'react';
import { ScrollView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { showToast } from '@/store/toast.store';
import { useTheme } from '@shopify/restyle';
import { useRouter } from 'expo-router';
import type { Theme } from '@/theme/theme';
import { Box, Text } from '@/theme/theme';
import { AppLogo } from '@/components/basic/AppLogo';
import { Focusable } from '@/components/basic/Focusable';
import { SettingsCard } from '@/components/settings/SettingsCard';
import { SettingsRow } from '@/components/settings/SettingsRow';
import { SettingsSwitch } from '@/components/settings/SettingsSwitch';
import { TOAST_DURATION_SHORT } from '@/constants/ui';
import { useDebugLogger } from '@/utils/debug';
import { useAppInfo } from '@/hooks/useAppInfo';
import { useGithubReleaseStatus } from '@/hooks/useGithubReleaseStatus';
import { useAppSettingsStore } from '@/store/app-settings.store';
import { getFocusableBackgroundColor } from '@/utils/focus-colors';

interface AboutLinkItem {
  id: string;
  title: string;
  description?: string;
  url: string;
  icon: keyof typeof Ionicons.glyphMap;
}

interface AboutLinkRowProps {
  item: AboutLinkItem;
  onPress: (item: AboutLinkItem) => void;
}

const AboutLinkRow: FC<AboutLinkRowProps> = memo(({ item, onPress }) => {
  const theme = useTheme<Theme>();

  return (
    <Focusable onPress={() => onPress(item)}>
      {({ isFocused }) => (
        <Box
          backgroundColor={getFocusableBackgroundColor({
            isFocused,
            defaultColor: 'inputBackground',
          })}
          borderRadius="m"
          padding="m"
          flexDirection="row"
          alignItems="center"
          gap="m">
          <Ionicons name={item.icon} size={22} color={theme.colors.textSecondary} />

          <Box flex={1} gap="xs">
            <Text variant="body" numberOfLines={1}>
              {item.title}
            </Text>
            {item.description ? (
              <Text variant="caption" color="textSecondary" numberOfLines={1}>
                {item.description}
              </Text>
            ) : null}
          </Box>

          <Ionicons name="open-outline" size={20} color={theme.colors.textSecondary} />
        </Box>
      )}
    </Focusable>
  );
});

AboutLinkRow.displayName = 'AboutLinkRow';

const links: AboutLinkItem[] = [
  {
    id: 'repo',
    title: 'GitHub Repository',
    description: 'Source code and releases',
    url: 'https://github.com/DodoraApp/DodoStream',
    icon: 'logo-github',
  },
  {
    id: 'bug',
    title: 'Report a Bug',
    description: 'Open a GitHub issue',
    url: 'https://github.com/DodoraApp/DodoStream/issues/new?labels=bug&template=bug_report.md',
    icon: 'bug-outline',
  },
  {
    id: 'feature',
    title: 'Request a Feature',
    description: 'Open a GitHub enhancement ticket',
    url: 'https://github.com/DodoraApp/DodoStream/issues/new?labels=enhancement&template=feature_request.md',
    icon: 'sparkles-outline',
  },
  {
    id: 'discord',
    title: 'Join Discord',
    description: 'Ideas, suggestions, and decisions',
    url: 'https://discord.gg/fMSNVmxKfN',
    icon: 'chatbubbles-outline',
  },
  {
    id: 'license',
    title: 'License (GPL-3.0)',
    description: 'View the license text',
    url: 'https://github.com/DodoraApp/DodoStream/blob/main/LICENSE',
    icon: 'document-text-outline',
  },
];

const DEVELOPER_TAP_COUNT = 5;
const TAP_TIMEOUT_MS = 2000;

/**
 * About settings content component
 * Shows app metadata and useful support links
 */
export const AboutSettingsContent: FC = memo(() => {
  const theme = useTheme<Theme>();
  const router = useRouter();
  const debug = useDebugLogger('AboutSettingsContent');
  const info = useAppInfo();

  // Developer mode tap counter
  const tapCountRef = useRef(0);
  const lastTapTimeRef = useRef(0);

  const releaseCheckOnStartup = useAppSettingsStore((state) => state.releaseCheckOnStartup);
  const setReleaseCheckOnStartup = useAppSettingsStore((state) => state.setReleaseCheckOnStartup);

  const releaseStatus = useGithubReleaseStatus({
    installedVersion: info.appVersion,
    enabled: true,
  });

  const logoSize = useMemo(() => theme.spacing.xxl * 3, [theme.spacing.xxl]);

  const commitShort = useMemo(() => {
    if (!info.commitHash) return '';
    const trimmed = info.commitHash.trim();
    return trimmed.length > 10 ? trimmed.slice(0, 10) : trimmed;
  }, [info.commitHash]);

  const handleVersionTap = useCallback(() => {
    const now = Date.now();

    // Reset counter if too much time has passed since last tap
    if (now - lastTapTimeRef.current > TAP_TIMEOUT_MS) {
      tapCountRef.current = 0;
    }

    lastTapTimeRef.current = now;
    tapCountRef.current += 1;

    debug('versionTap', { count: tapCountRef.current });

    const remaining = DEVELOPER_TAP_COUNT - tapCountRef.current;

    if (remaining > 0 && remaining <= 3) {
      showToast({
        title: `${remaining} tap${remaining === 1 ? '' : 's'} to developer mode`,
        duration: TOAST_DURATION_SHORT,
      });
    }

    if (tapCountRef.current >= DEVELOPER_TAP_COUNT) {
      tapCountRef.current = 0;
      debug('developerModeActivated');
      router.push('/(tabs)/settings/developer');
    }
  }, [debug, router]);

  const handleOpenLink = useCallback(
    async (item: AboutLinkItem) => {
      try {
        await Linking.openURL(item.url);
      } catch (error) {
        debug('failedToOpenLink', { error, url: item.url, id: item.id });
        showToast({
          title: 'Could not open link',
          message: 'Please try again later.',
          duration: TOAST_DURATION_SHORT,
        });
      }
    },
    [debug]
  );

  const handleCheckForUpdates = useCallback(async () => {
    if (!releaseStatus.canCheck) {
      showToast({
        title: 'Update check unavailable',
        message: 'GitHub releases URL is not configured for this build.',
        duration: TOAST_DURATION_SHORT,
      });
      return;
    }

    const result = await releaseStatus.checkNow();
    if (!result?.latestVersion) {
      showToast({
        title: 'No release info',
        message: 'Please try again later.',
        duration: TOAST_DURATION_SHORT,
      });
      return;
    }

    if (result.isUpdateAvailable) {
      showToast({
        title: 'Update available',
        message: `Latest: ${result.latestVersion}`,
        duration: TOAST_DURATION_SHORT,
      });
      return;
    }

    showToast({
      title: 'Up to date',
      message: `Installed: ${info.appVersion}`,
      duration: TOAST_DURATION_SHORT,
    });
  }, [info.appVersion, releaseStatus]);

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <Box paddingVertical="m" paddingHorizontal="m" gap="l">
        <Box alignItems="center" gap="m" paddingTop="m">
          <AppLogo size={logoSize} />
          <Text variant="header">DodoStream</Text>
        </Box>

        <SettingsCard title="App">
          <Focusable onPress={handleVersionTap}>
            {({ isFocused }) => (
              <Box flexDirection="row" alignItems="center" justifyContent="space-between" gap="m">
                <Text variant="body">Version</Text>
                <Text variant="body" color={isFocused ? 'primaryForeground' : 'textSecondary'}>
                  {info.appVersion}
                </Text>
              </Box>
            )}
          </Focusable>

          <SettingsRow label="Commit">
            <Text variant="body" color="textSecondary" numberOfLines={1}>
              {commitShort || '—'}
            </Text>
          </SettingsRow>

          <SettingsRow label="Runtime">
            <Text variant="body" color="textSecondary" numberOfLines={1}>
              {info.runtimeVersion || '—'}
            </Text>
          </SettingsRow>
        </SettingsCard>

        <SettingsCard title="Releases">
          <SettingsRow label="Current">
            <Text variant="body" color="textSecondary">
              {info.appVersion}
            </Text>
          </SettingsRow>

          <SettingsRow label="Latest">
            <Text variant="body" color="textSecondary" numberOfLines={1}>
              {releaseStatus.latestVersion || '—'}
            </Text>
          </SettingsRow>

          <SettingsRow label="Status">
            <Text variant="body" color="textSecondary" numberOfLines={1}>
              {releaseStatus.isUpdateAvailable === null
                ? 'Unknown'
                : releaseStatus.isUpdateAvailable
                  ? 'Update available'
                  : 'Up to date'}
            </Text>
          </SettingsRow>

          <Box gap="s">
            <Focusable
              disabled={releaseStatus.isFetching}
              onPress={() => void handleCheckForUpdates()}>
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
                  justifyContent="space-between">
                  <Text variant="body">Check for updates</Text>
                  <Ionicons
                    name={releaseStatus.isFetching ? 'hourglass-outline' : 'refresh'}
                    size={20}
                    color={theme.colors.textSecondary}
                  />
                </Box>
              )}
            </Focusable>

            <SettingsSwitch
              label="Check on startup"
              description="Show an update prompt when a new release is available"
              value={releaseCheckOnStartup}
              onValueChange={setReleaseCheckOnStartup}
            />
          </Box>
        </SettingsCard>

        <SettingsCard title="Links">
          <Box gap="s">
            {links.map((item) => (
              <AboutLinkRow key={item.id} item={item} onPress={handleOpenLink} />
            ))}
          </Box>
        </SettingsCard>
      </Box>
    </ScrollView>
  );
});

AboutSettingsContent.displayName = 'AboutSettingsContent';
