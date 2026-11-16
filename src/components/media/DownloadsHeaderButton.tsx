import { memo, useCallback } from 'react';

import { useRouter } from 'expo-router';

import { Button } from '@/components/basic/Button';
import { useDownloadsForMeta } from '@/hooks/useDownloads';

export interface DownloadsHeaderButtonProps {
  metaId: string;
  testID?: string;
}

/**
 * Shortcut to the downloads of a movie or series.
 * Renders nothing while the title has no downloads.
 */
export const DownloadsHeaderButton = memo(({ metaId, testID }: DownloadsHeaderButtonProps) => {
  const router = useRouter();
  const hasDownloads = useDownloadsForMeta(metaId).length > 0;

  const handlePress = useCallback(() => {
    router.push({ pathname: '/downloads', params: { metaId } });
  }, [metaId, router]);

  if (!hasDownloads) return null;

  return <Button icon="download" variant="secondary" onPress={handlePress} testID={testID} />;
});

DownloadsHeaderButton.displayName = 'DownloadsHeaderButton';
