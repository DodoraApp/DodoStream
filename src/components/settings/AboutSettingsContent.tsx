import { FC, memo, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
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
    <Focusable onPress={() => onPress(item)} variant="background">
      <Box
        borderRadius="m"
        padding="m"
        flexDirection="row"
        alignItems="center"
        justifyContent="center"
        gap="m">
        <Ionicons
          name={item.icon}
          size={theme.sizes.iconMedium}
          color={theme.colors.textSecondary}
        />

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

        <Ionicons
          name="open-outline"
          size={theme.sizes.iconSmall}
          color={theme.colors.textSecondary}
        />
      </Box>
    </Focusable>
  );
});

AboutLinkRow.displayName = 'AboutLinkRow';

const DEVELOPER_TAP_COUNT = 5;
const TAP_TIMEOUT_MS = 2000;

/**
 * About settings content component
 * Shows app metadata and useful support links
 */
export const AboutSettingsContent: FC = memo(() => {
  const { t } = useTranslation('settings');
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

  const links = useMemo<AboutLinkItem[]>(
    () => [
      {
        id: 'repo',
        title: t('about.repo_title'),
        description: t('about.repo_desc'),
        url: 'https://github.com/DodoraApp/DodoStream',
        icon: 'logo-github',
      },
      {
        id: 'bug',
        title: t('about.bug_title'),
        description: t('about.bug_desc'),
        url: 'https://github.com/DodoraApp/DodoStream/issues/new?labels=bug&template=bug_report.md',
        icon: 'bug-outline',
      },
      {
        id: 'feature',
        title: t('about.feature_title'),
        description: t('about.feature_desc'),
        url: 'https://github.com/DodoraApp/DodoStream/issues/new?labels=enhancement&template=feature_request.md',
        icon: 'sparkles-outline',
      },
      {
        id: 'discord',
        title: t('about.discord_title'),
        description: t('about.discord_desc'),
        url: 'https://discord.gg/fMSNVmxKfN',
        icon: 'chatbubbles-outline',
      },
      {
        id: 'license',
        title: t('about.license_title'),
        description: t('about.license_desc'),
        url: 'https://github.com/DodoraApp/DodoStream/blob/main/LICENSE',
        icon: 'document-text-outline',
      },
    ],
    [t]
  );

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
        title: t('about.developer_mode_tap', { count: remaining }),
        duration: TOAST_DURATION_SHORT,
      });
    }

    if (tapCountRef.current >= DEVELOPER_TAP_COUNT) {
      tapCountRef.current = 0;
      debug('developerModeActivated');
      router.push('/(app)/(tabs)/settings/developer');
    }
  }, [debug, router, t]);

  const handleOpenLink = useCallback(
    async (item: AboutLinkItem) => {
      try {
        await Linking.openURL(item.url);
      } catch (error) {
        debug('failedToOpenLink', { error, url: item.url, id: item.id });
        showToast({
          title: t('about.could_not_open_link'),
          message: t('about.try_again_later'),
          duration: TOAST_DURATION_SHORT,
        });
      }
    },
    [debug, t]
  );

  const handleCheckForUpdates = useCallback(async () => {
    if (!releaseStatus.canCheck) {
      showToast({
        title: t('about.update_check_unavailable'),
        message: t('about.update_check_unavailable_desc'),
        duration: TOAST_DURATION_SHORT,
      });
      return;
    }

    const result = await releaseStatus.checkNow();
    if (!result?.latestVersion) {
      showToast({
        title: t('about.no_release_info'),
        message: t('about.try_again_later'),
        duration: TOAST_DURATION_SHORT,
      });
      return;
    }

    if (result.isUpdateAvailable) {
      showToast({
        title: t('about.update_available'),
        message: `${t('about.latest')}: ${result.latestVersion}`,
        duration: TOAST_DURATION_SHORT,
      });
      return;
    }

    showToast({
      title: t('about.up_to_date'),
      message: `${t('about.current')}: ${info.appVersion}`,
      duration: TOAST_DURATION_SHORT,
    });
  }, [info.appVersion, releaseStatus, t]);

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <Box paddingVertical="m" paddingHorizontal="m" gap="l">
        <Box alignItems="center" gap="m" paddingTop="m">
          <AppLogo size={logoSize} />
          <Text variant="header">DodoStream</Text>
        </Box>

        <SettingsCard title={t('about.app')}>
          <Focusable onPress={handleVersionTap} variant="background">
            <SettingsRow label={t('about.version')}>
              <Text variant="body">{info.appVersion}</Text>
            </SettingsRow>
          </Focusable>

          <SettingsRow label={t('about.commit')}>
            <Text variant="body" color="textSecondary" numberOfLines={1}>
              {commitShort || '—'}
            </Text>
          </SettingsRow>

          <SettingsRow label={t('about.runtime')}>
            <Text variant="body" color="textSecondary" numberOfLines={1}>
              {info.runtimeVersion || '—'}
            </Text>
          </SettingsRow>
        </SettingsCard>

        <SettingsCard title={t('about.releases')}>
          <SettingsRow label={t('about.current')}>
            <Text variant="body" color="textSecondary">
              {info.appVersion}
            </Text>
          </SettingsRow>

          <SettingsRow label={t('about.latest')}>
            <Text variant="body" color="textSecondary" numberOfLines={1}>
              {releaseStatus.latestVersion || '—'}
            </Text>
          </SettingsRow>

          <SettingsRow label={t('about.status')}>
            <Text variant="body" color="textSecondary" numberOfLines={1}>
              {releaseStatus.isUpdateAvailable === null
                ? t('about.unknown')
                : releaseStatus.isUpdateAvailable
                  ? t('about.update_available')
                  : t('about.up_to_date')}
            </Text>
          </SettingsRow>

          <Focusable onPress={handleCheckForUpdates} variant="background">
            <SettingsRow label={t('about.check_for_updates')}>
              <Ionicons
                name={releaseStatus.isFetching ? 'hourglass-outline' : 'refresh'}
                size={theme.sizes.iconSmall}
                color={theme.colors.textSecondary}
              />
            </SettingsRow>
          </Focusable>

          <SettingsSwitch
            label={t('about.check_on_startup')}
            description={t('about.check_on_startup_desc')}
            value={releaseCheckOnStartup}
            onValueChange={setReleaseCheckOnStartup}
          />
        </SettingsCard>

        <SettingsCard title={t('about.links')}>
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
