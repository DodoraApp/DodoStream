import { memo } from 'react';
import { DismissableModal } from '@/components/basic/DismissableModal';
import { useGithubReleaseNotification } from '@/hooks/useGithubReleaseNotification';

export interface GithubReleaseModalProps {
  enabled: boolean;
}

export const GithubReleaseModal = memo(function GithubReleaseModal({
  enabled,
}: GithubReleaseModalProps) {
  const releaseNotification = useGithubReleaseNotification({ enabled });

  if (!releaseNotification) return null;

  return (
    <DismissableModal
      visible={releaseNotification.isVisible}
      heading={releaseNotification.heading}
      subheading={releaseNotification.subheading}
      body={releaseNotification.body}
      primaryActionText="Download Release"
      secondaryActionText="Dismiss"
      tertiaryActionText="Remind later"
      preferredAction="tertiary"
      onPrimaryAction={releaseNotification.onDownloadRelease}
      onSecondaryAction={releaseNotification.onDismiss}
      onTertiaryAction={releaseNotification.onRemindLater}
      onDismiss={releaseNotification.onRemindLater}
    />
  );
});
