import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { usePathname } from 'expo-router';

import { removeDownload } from '@/api/downloads/download-manager';
import { ConfirmModal } from '@/components/basic/ConfirmModal';
import { useDownloadsStore } from '@/store/downloads.store';

const PLAYER_PATHNAME = '/play';

/**
 * Asks whether downloads that were watched to the end should be deleted.
 * Waits until the player is closed, so it never interrupts the next episode.
 */
export const WatchedDownloadsPrompt = memo(() => {
  const { t } = useTranslation(['media', 'common']);
  const pathname = usePathname();
  const watchedDownloads = useDownloadsStore((state) => state.watchedDownloads);
  const clearWatchedDownloads = useDownloadsStore((state) => state.clearWatchedDownloads);

  const handleConfirm = useCallback(() => {
    for (const download of watchedDownloads) {
      void removeDownload(download.id);
    }
  }, [watchedDownloads]);

  const isVisible = watchedDownloads.length > 0 && pathname !== PLAYER_PATHNAME;

  return (
    <ConfirmModal
      visible={isVisible}
      title={t('media:download_watched_title')}
      message={t('media:download_watched_message', {
        titles: watchedDownloads.map((download) => download.title).join(', '),
      })}
      icon="trash-outline"
      confirmLabel={t('common:delete')}
      cancelLabel={t('media:download_keep')}
      onConfirm={handleConfirm}
      onClose={clearWatchedDownloads}
      testID="watched-downloads-prompt"
    />
  );
});

WatchedDownloadsPrompt.displayName = 'WatchedDownloadsPrompt';
