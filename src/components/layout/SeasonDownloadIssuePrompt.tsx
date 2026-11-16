import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { useRouter } from 'expo-router';

import { ConfirmModal } from '@/components/basic/ConfirmModal';
import { useDownloadsStore } from '@/store/downloads.store';

/**
 * Tells the user when a season download left episodes without a stream and
 * leads to the downloads, where a stream can be chosen for each of them.
 */
export const SeasonDownloadIssuePrompt = memo(() => {
  const { t } = useTranslation(['media', 'common']);
  const router = useRouter();
  const seasonIssue = useDownloadsStore((state) => state.seasonIssue);
  const setSeasonIssue = useDownloadsStore((state) => state.setSeasonIssue);

  const handleClose = useCallback(() => setSeasonIssue(null), [setSeasonIssue]);

  const handleOpenDownloads = useCallback(() => {
    if (!seasonIssue) return;
    router.push({ pathname: '/downloads', params: { metaId: seasonIssue.metaId } });
  }, [router, seasonIssue]);

  return (
    <ConfirmModal
      visible={!!seasonIssue}
      title={t('media:download_season_issue_title')}
      message={t('media:download_season_issue_message', { count: seasonIssue?.count ?? 0 })}
      icon="alert-circle-outline"
      confirmLabel={t('media:download_open_downloads')}
      cancelLabel={t('common:back')}
      onConfirm={handleOpenDownloads}
      onClose={handleClose}
      testID="season-download-issue-prompt"
    />
  );
});

SeasonDownloadIssuePrompt.displayName = 'SeasonDownloadIssuePrompt';
