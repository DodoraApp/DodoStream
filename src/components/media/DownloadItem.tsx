import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import Ionicons, { type IoniconsIconName } from '@react-native-vector-icons/ionicons/static';
import { useTheme } from '@shopify/restyle';

import { ConfirmModal } from '@/components/basic/ConfirmModal';
import { Focusable } from '@/components/basic/Focusable';
import { ProgressBar } from '@/components/basic/ProgressBar';
import type { DbDownload } from '@/db';
import { useDownloadProgress } from '@/hooks/useDownloads';
import { Box, Text, type Theme } from '@/theme/theme';
import { formatBytes, getDownloadProgressRatio } from '@/utils/downloads';
import { getFocusableBackgroundColor, getFocusableForegroundColor } from '@/utils/focus-colors';

const PERCENT = 100;

interface DownloadActionButtonProps {
  icon: IoniconsIconName;
  label: string;
  onPress: () => void;
  testID: string;
}

const DownloadActionButton = memo(({ icon, label, onPress, testID }: DownloadActionButtonProps) => {
  const theme = useTheme<Theme>();

  return (
    <Focusable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      focusedStyle={{ borderRadius: theme.borderRadii.full }}>
      {({ isFocused }) => (
        <Box
          backgroundColor={getFocusableBackgroundColor({
            isFocused,
            defaultColor: 'mainBackground',
          })}
          padding="s"
          borderRadius="full">
          <Ionicons
            name={icon}
            size={theme.sizes.iconMedium}
            color={
              theme.colors[
                getFocusableForegroundColor({ isFocused, defaultColor: 'mainForeground' })
              ]
            }
          />
        </Box>
      )}
    </Focusable>
  );
});

DownloadActionButton.displayName = 'DownloadActionButton';

export interface DownloadItemProps {
  download: DbDownload;
  onPlay: (download: DbDownload) => void;
  onRetry: (download: DbDownload) => void;
  /** Opens the stream selection for a download that still needs a stream. */
  onChooseStream?: (download: DbDownload) => void;
  onRemove: (download: DbDownload) => void;
}

/**
 * One download with its state (progress, finished, failed) and the matching
 * actions: play, retry, cancel or delete.
 */
export const DownloadItem = memo(
  ({ download, onPlay, onRetry, onRemove, onChooseStream }: DownloadItemProps) => {
    const { t } = useTranslation(['media', 'common']);
    const { bytesDownloaded, bytesTotal } = useDownloadProgress(download);
    const { id, status, title, streamTitle } = download;

    // Waiting and transferring downloads can be canceled; the others are deleted.
    const isActive = status === 'queued' || status === 'downloading';
    const ratio = getDownloadProgressRatio(bytesDownloaded, bytesTotal);

    const statusText = (() => {
      if (status === 'failed') return t('media:download_failed');
      if (status === 'needs_stream') return t('media:download_needs_stream');
      if (status === 'queued') return t('media:download_queued');
      if (status === 'completed') {
        const size = bytesTotal ?? bytesDownloaded;
        return size > 0
          ? t('media:download_completed_size', { size: formatBytes(size) })
          : t('media:download_completed');
      }
      if (ratio !== undefined && bytesTotal) {
        return t('media:download_progress', {
          percent: Math.floor(ratio * PERCENT),
          downloaded: formatBytes(bytesDownloaded),
          total: formatBytes(bytesTotal),
        });
      }
      return t('media:download_progress_unknown', { downloaded: formatBytes(bytesDownloaded) });
    })();

    const handlePlay = useCallback(() => onPlay(download), [download, onPlay]);
    const handleRetry = useCallback(() => onRetry(download), [download, onRetry]);
    const handleChooseStream = useCallback(
      () => onChooseStream?.(download),
      [download, onChooseStream]
    );

    const [isConfirmVisible, setIsConfirmVisible] = useState(false);
    const openConfirm = useCallback(() => setIsConfirmVisible(true), []);
    const closeConfirm = useCallback(() => setIsConfirmVisible(false), []);
    const handleConfirmRemove = useCallback(() => onRemove(download), [download, onRemove]);

    return (
      <Box
        backgroundColor="cardBackground"
        borderRadius="m"
        padding="m"
        gap="s"
        testID={`download-${id}`}>
        <Box flexDirection="row" alignItems="center" gap="m">
          <Box flex={1} gap="xs">
            <Text variant="cardTitle" numberOfLines={2}>
              {title}
            </Text>
            {streamTitle ? (
              <Text variant="caption" color="textSecondary" numberOfLines={2}>
                {streamTitle}
              </Text>
            ) : null}
          </Box>

          <Box flexDirection="row" alignItems="center" gap="s">
            {status === 'completed' && (
              <DownloadActionButton
                icon="play"
                label={t('media:play')}
                onPress={handlePlay}
                testID={`download-play-${id}`}
              />
            )}
            {status === 'needs_stream' && (
              <DownloadActionButton
                icon="search"
                label={t('media:download_choose_stream')}
                onPress={handleChooseStream}
                testID={`download-choose-stream-${id}`}
              />
            )}
            {status === 'failed' && (
              <DownloadActionButton
                icon="refresh"
                label={t('common:retry')}
                onPress={handleRetry}
                testID={`download-retry-${id}`}
              />
            )}
            <DownloadActionButton
              icon={isActive ? 'close' : 'trash-outline'}
              label={isActive ? t('media:download_cancel') : t('common:delete')}
              onPress={openConfirm}
              testID={`download-remove-${id}`}
            />
          </Box>
        </Box>

        {status === 'downloading' && (
          <ProgressBar progress={ratio ?? 0} testID={`download-progress-${id}`} />
        )}

        <Text
          variant="caption"
          color={
            status === 'failed' ? 'danger' : status === 'needs_stream' ? 'warning' : 'textSecondary'
          }
          testID={`download-status-${id}`}>
          {statusText}
        </Text>

        <ConfirmModal
          visible={isConfirmVisible}
          title={
            isActive
              ? t('media:download_cancel_confirm_title')
              : t('media:download_delete_confirm_title')
          }
          message={title}
          icon={isActive ? 'close-circle-outline' : 'trash-outline'}
          confirmLabel={isActive ? t('media:download_cancel') : t('common:delete')}
          cancelLabel={t('common:back')}
          onConfirm={handleConfirmRemove}
          onClose={closeConfirm}
          testID={`download-confirm-${id}`}
        />
      </Box>
    );
  }
);

DownloadItem.displayName = 'DownloadItem';
