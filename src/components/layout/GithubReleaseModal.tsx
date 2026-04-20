import { memo } from 'react';
import { DismissableModal } from '@/components/basic/DismissableModal';
import { ApkInstallModal } from '@/components/layout/ApkInstallModal';
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
    <>
      <DismissableModal
        visible={releaseNotification.isVisible}
        heading={releaseNotification.heading}
        subheading={releaseNotification.subheading}
        body={releaseNotification.body}
        primaryActionText={
          releaseNotification.hasAndroidApk ? 'Download & Install' : 'Download Release'
        }
        secondaryActionText="Dismiss"
        tertiaryActionText="Remind later"
        preferredAction="tertiary"
        onPrimaryAction={
          releaseNotification.hasAndroidApk && releaseNotification.onInstallAndroid
            ? releaseNotification.onInstallAndroid
            : releaseNotification.onDownloadRelease
        }
        onSecondaryAction={releaseNotification.onDismiss}
        onTertiaryAction={releaseNotification.onRemindLater}
        onDismiss={releaseNotification.onRemindLater}
      />

      <ApkInstallModal
        visible={releaseNotification.isInstallModalVisible}
        status={releaseNotification.androidInstallStatus}
        progress={releaseNotification.androidInstallProgress}
        assetName={releaseNotification.androidApkName}
        onCancel={releaseNotification.onCancelAndroidInstall}
        onInstall={releaseNotification.onTriggerAndroidInstall}
      />
    </>
  );
});
