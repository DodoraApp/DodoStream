import { memo } from 'react';
import { Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@shopify/restyle';
import { Box, Text, type Theme } from '@/theme/theme';
import { Modal } from '@/components/basic/Modal';
import { Button } from '@/components/basic/Button';
import { ProgressBar } from '@/components/basic/ProgressBar';
import type { ApkInstallStatus } from '@/hooks/useAndroidApkInstall';

export interface ApkInstallModalProps {
    visible: boolean;
    status: ApkInstallStatus;
    /** Download progress from 0 to 1 */
    progress: number;
    assetName?: string;
    onCancel: () => void;
    onInstall: () => void;
}

function statusLabel(status: ApkInstallStatus, progress: number): string {
    switch (status) {
        case 'downloading':
            return `Downloading… ${Math.round(progress * 100)}%`;
        case 'ready':
            return 'Download complete';
        case 'error':
            return 'Download failed';
        default:
            return 'Preparing…';
    }
}

/**
 * Clean, minimal modal shown while an APK update is being downloaded and installed.
 * Android-only (returns null on other platforms).
 */
export const ApkInstallModal = memo(function ApkInstallModal({
    visible,
    status,
    progress,
    assetName,
    onCancel,
    onInstall,
}: ApkInstallModalProps) {
    const theme = useTheme<Theme>();

    if (Platform.OS !== 'android') return null;

    const isDownloading = status === 'downloading';
    const isReady = status === 'ready';
    const isError = status === 'error';

    return (
        <Modal
            visible={visible}
            onClose={onCancel}
            closeOnBackdropPress={!isDownloading}
            label="Updating">
            <Box gap="m" paddingBottom="s">
                {/* Icon + status */}
                <Box flexDirection="row" alignItems="center" gap="m">
                    <Ionicons
                        name={
                            isReady
                                ? 'checkmark-circle-outline'
                                : isError
                                  ? 'alert-circle-outline'
                                  : 'cloud-download-outline'
                        }
                        size={theme.sizes.iconLarge}
                        color={
                            isReady
                                ? theme.colors.primaryBackground
                                : isError
                                  ? theme.colors.danger
                                  : theme.colors.textSecondary
                        }
                    />
                    <Box flex={1} gap="xs">
                        <Text variant="body">{statusLabel(status, progress)}</Text>
                        {assetName ? (
                            <Text variant="caption" color="textSecondary" numberOfLines={1}>
                                {assetName}
                            </Text>
                        ) : null}
                    </Box>
                </Box>

                {/* Progress bar */}
                <ProgressBar progress={isReady ? 1 : progress} height={6} />

                {/* Actions */}
                <Box flexDirection="row" gap="s" justifyContent="flex-end">
                    {isReady ? (
                        <>
                            <Button
                                variant="secondary"
                                title="Cancel"
                                onPress={onCancel}
                                flex={1}
                            />
                            <Button
                                variant="primary"
                                title="Install"
                                icon="download-outline"
                                onPress={onInstall}
                                hasTVPreferredFocus
                                flex={1}
                            />
                        </>
                    ) : (
                        <Button
                            variant="secondary"
                            title={isError ? 'Close' : 'Cancel'}
                            onPress={onCancel}
                            hasTVPreferredFocus
                            width="100%"
                        />
                    )}
                </Box>
            </Box>
        </Modal>
    );
});
