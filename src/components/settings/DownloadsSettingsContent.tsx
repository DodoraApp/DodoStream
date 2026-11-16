import { FC, memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView } from 'react-native';

import { Button } from '@/components/basic/Button';
import { DownloadItem } from '@/components/media/DownloadItem';
import { SettingsCard } from '@/components/settings/SettingsCard';
import { SettingsRow } from '@/components/settings/SettingsRow';
import { SettingsSwitch } from '@/components/settings/SettingsSwitch';
import type { DbDownload } from '@/db';
import { useDownloadActions, useDownloadItemHandlers, useDownloads } from '@/hooks/useDownloads';
import { useAppSettingsStore } from '@/store/app-settings.store';
import { showToast } from '@/store/toast.store';
import { Box, Text } from '@/theme/theme';
import { formatBytes } from '@/utils/downloads';

export interface DownloadsSettingsContentProps {
  /** Whether to wrap content in ScrollView (default: true) */
  scrollable?: boolean;
}

interface DownloadSectionProps {
  title: string;
  downloads: DbDownload[];
  handlers: ReturnType<typeof useDownloadItemHandlers>;
  testID: string;
}

const DownloadSection = memo(({ title, downloads, handlers, testID }: DownloadSectionProps) => {
  if (downloads.length === 0) return null;

  return (
    <Box gap="s" testID={testID}>
      <Text variant="sectionLabel">{title}</Text>
      {downloads.map((download) => (
        <DownloadItem
          key={download.id}
          download={download}
          onPlay={handlers.onPlay}
          onRetry={handlers.onRetry}
          onRemove={handlers.onRemove}
        />
      ))}
    </Box>
  );
});

DownloadSection.displayName = 'DownloadSection';

/**
 * Download settings: background behaviour, used storage and every downloaded
 * movie and episode of the active profile.
 */
export const DownloadsSettingsContent: FC<DownloadsSettingsContentProps> = memo(
  ({ scrollable = true }) => {
    const { t } = useTranslation(['settings', 'media', 'common']);
    const backgroundDownloadsEnabled = useAppSettingsStore(
      (state) => state.backgroundDownloadsEnabled
    );
    const setBackgroundDownloadsEnabled = useAppSettingsStore(
      (state) => state.setBackgroundDownloadsEnabled
    );
    const { data } = useDownloads();
    const handlers = useDownloadItemHandlers();
    const { removeAllDownloads } = useDownloadActions();

    const downloads = useMemo(() => data ?? [], [data]);
    const movies = useMemo(() => downloads.filter((item) => item.type !== 'series'), [downloads]);
    const series = useMemo(
      () =>
        downloads
          .filter((item) => item.type === 'series')
          .sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true })),
      [downloads]
    );
    const usedBytes = useMemo(
      () =>
        downloads.reduce(
          (sum, item) =>
            sum + (item.status === 'completed' ? (item.bytesTotal ?? item.bytesDownloaded) : 0),
          0
        ),
      [downloads]
    );

    const handleDeleteAll = useCallback(() => {
      Alert.alert(t('downloads.delete_all_confirm_title'), t('downloads.delete_all_confirm_msg'), [
        { text: t('common:cancel'), style: 'cancel' },
        {
          text: t('common:delete'),
          style: 'destructive',
          onPress: async () => {
            await removeAllDownloads();
            showToast({ title: t('downloads.all_deleted'), preset: 'success' });
          },
        },
      ]);
    }, [removeAllDownloads, t]);

    const content = (
      <Box paddingVertical="m" paddingHorizontal="m" gap="l" paddingBottom="xl">
        <SettingsCard title={t('downloads.options')}>
          <SettingsSwitch
            label={t('downloads.background')}
            description={t('downloads.background_desc')}
            value={backgroundDownloadsEnabled}
            onValueChange={setBackgroundDownloadsEnabled}
            testID="settings-downloads-background"
          />
        </SettingsCard>

        <SettingsCard title={t('downloads.storage')}>
          <SettingsRow
            label={t('downloads.delete_all')}
            description={t('downloads.delete_all_desc')}>
            <Box alignItems="flex-end" gap="xs">
              <Text variant="caption" color="textSecondary" testID="settings-downloads-storage">
                {t('downloads.storage_used', {
                  size: formatBytes(usedBytes),
                  count: downloads.length,
                })}
              </Text>
              <Button
                title={t('common:delete')}
                onPress={handleDeleteAll}
                variant="secondary"
                disabled={downloads.length === 0}
                testID="settings-downloads-delete-all"
              />
            </Box>
          </SettingsRow>
        </SettingsCard>

        <SettingsCard title={t('downloads.downloaded_content')}>
          {downloads.length === 0 ? (
            <Text variant="body" color="textSecondary" testID="settings-downloads-empty">
              {t('media:downloads_empty')}
            </Text>
          ) : (
            <>
              <DownloadSection
                title={t('media:movies_section')}
                downloads={movies}
                handlers={handlers}
                testID="settings-downloads-movies"
              />
              <DownloadSection
                title={t('media:series_section')}
                downloads={series}
                handlers={handlers}
                testID="settings-downloads-series"
              />
            </>
          )}
        </SettingsCard>
      </Box>
    );

    if (!scrollable) return content;

    return <ScrollView showsVerticalScrollIndicator={false}>{content}</ScrollView>;
  }
);

DownloadsSettingsContent.displayName = 'DownloadsSettingsContent';
