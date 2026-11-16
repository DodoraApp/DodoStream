import { memo } from 'react';

import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useTheme } from '@shopify/restyle';

import { useDownloadStatus } from '@/hooks/useDownloads';
import { Box, type Theme } from '@/theme/theme';
import { getDownloadStatusIcon } from '@/utils/downloads';

export interface DownloadStatusBadgeProps {
  metaId: string;
  videoId: string;
  /** Another badge already sits in the top-right corner; go below it. */
  belowCornerBadge?: boolean;
}

/**
 * Small badge for the top-right corner of an episode thumbnail: downloaded, waiting or
 * downloading, or a problem. Renders nothing while the video has no download.
 */
export const DownloadStatusBadge = memo(
  ({ metaId, videoId, belowCornerBadge = false }: DownloadStatusBadgeProps) => {
    const theme = useTheme<Theme>();
    const status = useDownloadStatus(metaId, videoId);

    if (!status) return null;

    return (
      <Box
        position="absolute"
        top={belowCornerBadge ? theme.sizes.episodeCornerBadgeHeight : 0}
        right={0}
        borderBottomLeftRadius="m"
        backgroundColor="overlayBackground"
        paddingHorizontal="s"
        paddingVertical="xs"
        testID={`download-badge-${status}`}>
        <Ionicons
          name={getDownloadStatusIcon(status)}
          size={theme.sizes.iconSmall}
          color={
            status === 'failed' || status === 'needs_stream'
              ? theme.colors.warning
              : theme.colors.mainForeground
          }
        />
      </Box>
    );
  }
);

DownloadStatusBadge.displayName = 'DownloadStatusBadge';
