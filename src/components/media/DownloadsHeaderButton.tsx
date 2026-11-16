import { memo, useCallback } from 'react';

import { useRouter } from 'expo-router';

import { Button } from '@/components/basic/Button';
import { useDownloadsForMeta } from '@/hooks/useDownloads';
import { getDownloadStatusIcon, getOverallDownloadStatus } from '@/utils/downloads';

export interface DownloadsHeaderButtonProps {
  metaId: string;
  testID?: string;
}

/**
 * Shortcut to the downloads of a movie or series. Its icon shows their
 * state: downloaded, in progress, or a problem.
 * Renders nothing while the title has no downloads.
 */
export const DownloadsHeaderButton = memo(({ metaId, testID }: DownloadsHeaderButtonProps) => {
  const router = useRouter();
  const downloads = useDownloadsForMeta(metaId);
  const status = getOverallDownloadStatus(downloads.map((download) => download.status));

  const handlePress = useCallback(() => {
    router.push({ pathname: '/downloads', params: { metaId } });
  }, [metaId, router]);

  if (!status) return null;

  return (
    <Button
      icon={getDownloadStatusIcon(status)}
      variant="secondary"
      onPress={handlePress}
      testID={testID}
    />
  );
});

DownloadsHeaderButton.displayName = 'DownloadsHeaderButton';
