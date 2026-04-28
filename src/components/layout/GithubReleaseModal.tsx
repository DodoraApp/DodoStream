import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { DismissableModal } from '@/components/basic/DismissableModal';
import { useGithubReleaseNotification } from '@/hooks/useGithubReleaseNotification';

export interface GithubReleaseModalProps {
  enabled: boolean;
}

export const GithubReleaseModal = memo(function GithubReleaseModal({
  enabled,
}: GithubReleaseModalProps) {
  const { t } = useTranslation();
  const releaseNotification = useGithubReleaseNotification({ enabled });

  if (!releaseNotification) return null;

  return (
    <DismissableModal
      visible={releaseNotification.isVisible}
      heading={releaseNotification.heading}
      subheading={releaseNotification.subheading}
      body={releaseNotification.body}
      primaryActionText={
        releaseNotification.hasDirectAsset
          ? t('settings:about.download_apk')
          : t('settings:about.view_release')
      }
      secondaryActionText={t('settings:about.dismiss')}
      tertiaryActionText={t('settings:about.remind_later')}
      preferredAction="tertiary"
      onPrimaryAction={releaseNotification.onDownloadRelease}
      onSecondaryAction={releaseNotification.onDismiss}
      onTertiaryAction={releaseNotification.onRemindLater}
      onDismiss={releaseNotification.onRemindLater}
    />
  );
});
