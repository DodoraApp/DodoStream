import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { LegendList } from '@legendapp/list/react-native';
import { useTheme } from '@shopify/restyle';

import { LoadingIndicator } from '@/components/basic/LoadingIndicator';
import { VerticalSpacer } from '@/components/basic/Spacer';
import { DownloadItem } from '@/components/media/DownloadItem';
import { MOBILE_DRAW_DISTANCE } from '@/constants/ui';
import type { DbDownload } from '@/db';
import { useDownloadItemHandlers, useDownloads } from '@/hooks/useDownloads';
import { Box, Text, type Theme } from '@/theme/theme';

const keyExtractor = (item: DbDownload) => String(item.id);

export interface DownloadsListProps {
  /** Limits the list to the downloads of one movie or series. */
  metaId?: string;
}

/** Downloads of the active profile with progress, cancel, delete and offline playback. */
export const DownloadsList = memo(({ metaId }: DownloadsListProps) => {
  const { t } = useTranslation('media');
  const theme = useTheme<Theme>();
  const { data: allDownloads, isLoading } = useDownloads();
  const data = useMemo(
    () => (metaId ? allDownloads?.filter((item) => item.metaId === metaId) : allDownloads),
    [allDownloads, metaId]
  );
  const { onPlay, onRetry, onRemove, onChooseStream } = useDownloadItemHandlers();

  const renderItem = useCallback(
    ({ item }: { item: DbDownload }) => (
      <DownloadItem
        download={item}
        onPlay={onPlay}
        onRetry={onRetry}
        onRemove={onRemove}
        onChooseStream={onChooseStream}
      />
    ),
    [onChooseStream, onPlay, onRemove, onRetry]
  );

  if (isLoading) {
    return (
      <Box paddingVertical="l" alignItems="center">
        <LoadingIndicator size="small" />
      </Box>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Text variant="body" color="textSecondary" testID="downloads-empty">
        {t('downloads_empty')}
      </Text>
    );
  }

  return (
    <LegendList
      data={data}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      ItemSeparatorComponent={VerticalSpacer}
      showsVerticalScrollIndicator={false}
      drawDistance={MOBILE_DRAW_DISTANCE}
      contentContainerStyle={{
        paddingTop: theme.spacing.s,
        paddingBottom: theme.spacing.xl,
      }}
      testID="downloads-list"
    />
  );
});

DownloadsList.displayName = 'DownloadsList';
