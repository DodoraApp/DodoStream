import { FC, memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';

import { Button } from '@/components/basic/Button';
import { ConfirmModal } from '@/components/basic/ConfirmModal';
import { PickerInput } from '@/components/basic/PickerInput';
import type { PickerItem } from '@/components/basic/PickerModal';
import { DownloadItem } from '@/components/media/DownloadItem';
import { SettingsCard } from '@/components/settings/SettingsCard';
import { SettingsRow } from '@/components/settings/SettingsRow';
import { SettingsSwitch } from '@/components/settings/SettingsSwitch';
import type { DbDownload } from '@/db';
import { useDownloadActions, useDownloadItemHandlers, useDownloads } from '@/hooks/useDownloads';
import { type DownloadAfterWatching, useAppSettingsStore } from '@/store/app-settings.store';
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
          onChooseStream={handlers.onChooseStream}
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
    const downloadAfterWatching = useAppSettingsStore((state) => state.downloadAfterWatching);
    const setDownloadAfterWatching = useAppSettingsStore((state) => state.setDownloadAfterWatching);
    const afterWatchingItems = useMemo<PickerItem<DownloadAfterWatching>[]>(
      () => [
        { label: t('downloads.after_watching_ask'), value: 'ask' },
        { label: t('downloads.after_watching_delete'), value: 'delete' },
        { label: t('downloads.after_watching_keep'), value: 'keep' },
      ],
      [t]
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

    const [isDeleteAllVisible, setIsDeleteAllVisible] = useState(false);
    const openDeleteAll = useCallback(() => setIsDeleteAllVisible(true), []);
    const closeDeleteAll = useCallback(() => setIsDeleteAllVisible(false), []);
    const handleDeleteAll = useCallback(() => {
      void removeAllDownloads().then(() => {
        showToast({ title: t('downloads.all_deleted'), preset: 'success' });
      });
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
          <SettingsRow
            label={t('downloads.after_watching')}
            description={t('downloads.after_watching_desc')}>
            <PickerInput
              label={t('downloads.after_watching')}
              icon="checkmark-done-outline"
              items={afterWatchingItems}
              selectedValue={downloadAfterWatching}
              selectedLabel={
                afterWatchingItems.find((item) => item.value === downloadAfterWatching)?.label ?? ''
              }
              onValueChange={setDownloadAfterWatching}
              testID="settings-downloads-after-watching"
            />
          </SettingsRow>
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
                onPress={openDeleteAll}
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

        <ConfirmModal
          visible={isDeleteAllVisible}
          title={t('downloads.delete_all_confirm_title')}
          message={t('downloads.delete_all_confirm_msg')}
          icon="trash-outline"
          confirmLabel={t('common:delete')}
          onConfirm={handleDeleteAll}
          onClose={closeDeleteAll}
          testID="settings-downloads-delete-all-confirm"
        />
      </Box>
    );

    if (!scrollable) return content;

    return <ScrollView showsVerticalScrollIndicator={false}>{content}</ScrollView>;
  }
);

DownloadsSettingsContent.displayName = 'DownloadsSettingsContent';
