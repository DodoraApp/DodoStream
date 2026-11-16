import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import Ionicons, { type IoniconsIconName } from '@react-native-vector-icons/ionicons/static';
import { useTheme } from '@shopify/restyle';

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
  onRemove: (download: DbDownload) => void;
}

/**
 * One download with its state (progress, finished, failed) and the matching
 * actions: play, retry, cancel or delete.
 */
export const DownloadItem = memo(({ download, onPlay, onRetry, onRemove }: DownloadItemProps) => {
  const { t } = useTranslation(['media', 'common']);
  const { bytesDownloaded, bytesTotal } = useDownloadProgress(download);
  const { id, status, title, streamTitle } = download;

  // Waiting and transferring downloads can be canceled; the others are deleted.
  const isActive = status === 'queued' || status === 'downloading';
  const ratio = getDownloadProgressRatio(bytesDownloaded, bytesTotal);

  const statusText = (() => {
    if (status === 'failed') return t('media:download_failed');
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

  const handleRemove = useCallback(() => {
    Alert.alert(
      isActive
        ? t('media:download_cancel_confirm_title')
        : t('media:download_delete_confirm_title'),
      title,
      [
        { text: t('common:back'), style: 'cancel' },
        {
          text: isActive ? t('media:download_cancel') : t('common:delete'),
          style: 'destructive',
          onPress: () => onRemove(download),
        },
      ]
    );
  }, [download, isActive, onRemove, t, title]);

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
            onPress={handleRemove}
            testID={`download-remove-${id}`}
          />
        </Box>
      </Box>

      {status === 'downloading' && (
        <ProgressBar progress={ratio ?? 0} testID={`download-progress-${id}`} />
      )}

      <Text
        variant="caption"
        color={status === 'failed' ? 'danger' : 'textSecondary'}
        testID={`download-status-${id}`}>
        {statusText}
      </Text>
    </Box>
  );
});

DownloadItem.displayName = 'DownloadItem';
