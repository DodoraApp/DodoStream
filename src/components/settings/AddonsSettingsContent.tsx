import { FC, memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Linking, TVFocusGuideView } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@shopify/restyle';
import { useShallow } from 'zustand/react/shallow';

import { useInstallAddon } from '@/api/stremio';
import { Button } from '@/components/basic/Button';
import { Focusable } from '@/components/basic/Focusable';
import { Input } from '@/components/basic/Input';
import { RemoteControlModal } from '@/components/settings/RemoteControlModal';
import { SettingsCard } from '@/components/settings/SettingsCard';
import { SettingsSwitch } from '@/components/settings/SettingsSwitch';
import { useResponsiveLayout } from '@/hooks/useBreakpoint';
import { useAddonStore } from '@/store/addon.store';
import { useProfileStore } from '@/store/profile.store';
import { showToast } from '@/store/toast.store';
import { Box, Text, type Theme } from '@/theme/theme';
import { InstalledAddon } from '@/types/stremio';
import { createDebugLogger } from '@/utils/debug';

const debug = createDebugLogger('AddonsSettings');

export interface AddonsSettingsContentProps {
  /** Whether to show the install addon section (default: true) */
  showInstall?: boolean;
  /** Whether to show the installed addons list (default: true) */
  showInstalled?: boolean;
  /** Whether to wrap content in ScrollView (default: true) */
  scrollable?: boolean;
}

/**
 * Addons settings content component
 * Extracted for use in both standalone page and split layout
 */
export const AddonsSettingsContent: FC<AddonsSettingsContentProps> = memo(
  ({ showInstall = true, showInstalled = true, scrollable = true }) => {
    const { t } = useTranslation(['settings', 'common']);
    const [manifestUrl, setManifestUrl] = useState('');
    const [isRemoteControlVisible, setIsRemoteControlVisible] = useState(false);
    const { isWide } = useResponsiveLayout();
    const theme = useTheme<Theme>();
    const activeProfileId = useProfileStore((state) => state.activeProfileId);
    const { configsByProfile, orderedAddons, storeError, reorderAddon } = useAddonStore(
      useShallow((state) => {
        const allAddons = Object.values(state.addons);
        const order = activeProfileId ? state.addonOrderByProfile[activeProfileId] : undefined;
        let sorted: typeof allAddons;
        if (!order || order.length === 0) {
          sorted = allAddons;
        } else {
          const orderMap = new Map(order.map((id, index) => [id, index]));
          sorted = [...allAddons].sort((a, b) => {
            const aIndex = orderMap.get(a.id) ?? Infinity;
            const bIndex = orderMap.get(b.id) ?? Infinity;
            return aIndex - bIndex;
          });
        }
        return {
          configsByProfile: state.configsByProfile,
          orderedAddons: sorted,
          storeError: state.error,
          reorderAddon: state.reorderAddon,
        };
      })
    );
    const installAddon = useInstallAddon();

    const activeAddons = orderedAddons.filter(
      (addon) => configsByProfile[activeProfileId ?? '']?.[addon.id]?.isActive === true
    );
    const inactiveAddons = orderedAddons.filter(
      (addon) => configsByProfile[activeProfileId ?? '']?.[addon.id]?.isActive !== true
    );

    const handleInstall = useCallback(async () => {
      if (!manifestUrl.trim()) {
        showToast({ title: t('common:error'), message: t('common:no_data'), preset: 'error' });
        return;
      }

      if (!manifestUrl.endsWith('manifest.json')) {
        showToast({ title: t('common:error'), message: t('addons.url_error'), preset: 'error' });
        return;
      }

      try {
        await installAddon.mutateAsync(manifestUrl);
        setManifestUrl('');
        showToast({
          title: t('common:success'),
          message: t('addons.install_success'),
          preset: 'success',
        });
      } catch (error) {
        showToast({
          title: t('addons.install_failed'),
          message: error instanceof Error ? error.message : t('addons.install_failed'),
          preset: 'error',
        });
      }
    }, [manifestUrl, installAddon, t]);

    const handleRemove = useCallback(
      (id: string, name: string) => {
        Alert.alert(t('addons.remove_title'), t('addons.remove_confirm', { name }), [
          { text: t('common:cancel'), style: 'cancel' },
          {
            text: t('common:delete'),
            style: 'destructive',
            onPress: () => useAddonStore.getState().removeAddon(id),
          },
        ]);
      },
      [t]
    );

    const handleConfigure = useCallback(
      (url: string) => {
        const configureUrl = url.replace(/manifest\.json$/, 'configure');
        Linking.openURL(configureUrl).catch(() => {
          showToast({ title: t('addons.failed_open_config'), preset: 'error' });
        });
      },
      [t]
    );

    const handleMoveUp = useCallback(
      (addonId: string) => {
        const index = activeAddons.findIndex((a) => a.id === addonId);
        if (index <= 0) return;
        const fromGlobal = orderedAddons.findIndex((a) => a.id === addonId);
        const toGlobal = orderedAddons.findIndex((a) => a.id === activeAddons[index - 1].id);
        reorderAddon(fromGlobal, toGlobal, activeProfileId ?? undefined);
      },
      [activeAddons, orderedAddons, reorderAddon, activeProfileId]
    );

    const handleMoveDown = useCallback(
      (addonId: string) => {
        const index = activeAddons.findIndex((a) => a.id === addonId);
        if (index < 0 || index >= activeAddons.length - 1) return;
        const fromGlobal = orderedAddons.findIndex((a) => a.id === addonId);
        const toGlobal = orderedAddons.findIndex((a) => a.id === activeAddons[index + 1].id);
        reorderAddon(fromGlobal, toGlobal, activeProfileId ?? undefined);
      },
      [activeAddons, orderedAddons, reorderAddon, activeProfileId]
    );

    const handleOpenRemoteControl = useCallback(() => {
      setIsRemoteControlVisible(true);
    }, []);

    const handleCloseRemoteControl = useCallback(() => {
      setIsRemoteControlVisible(false);
    }, []);

    const content = (
      <Box padding="m" gap="l" flex={1}>
        {(isWide || __DEV__) && <RemoteControlShortcut onPress={handleOpenRemoteControl} />}

        {/* Install Addon Section */}
        {showInstall && (
          <SettingsCard title={t('addons.install_title')}>
            <Input
              placeholder={t('addons.manifest_placeholder')}
              value={manifestUrl}
              onChangeText={setManifestUrl}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Button
              variant="primary"
              title={installAddon.isPending ? t('addons.installing') : t('addons.install_button')}
              onPress={handleInstall}
              disabled={installAddon.isPending}
            />
            {(storeError || installAddon.isError) && (
              <Text variant="bodySmall" color="danger">
                {storeError || t('addons.install_failed')}
              </Text>
            )}
          </SettingsCard>
        )}

        {/* Setup Info */}
        <SettingsCard>
          <Text variant="body" color="textSecondary">
            {t('addons.addons_info')}
          </Text>
        </SettingsCard>

        {/* Active Addons Section */}
        {showInstalled && activeAddons.length > 0 && (
          <Box gap="m">
            <Text variant="subheader">
              {t('addons.active_on_profile', { count: activeAddons.length })}
            </Text>
            {/* TVFocusGuideView keeps focus inside this group after a reorder re-render */}
            <TVFocusGuideView autoFocus style={{ gap: theme.spacing.s }}>
              {activeAddons.map((item, index) => (
                <AddonCard
                  key={item.id}
                  addon={item}
                  onRemove={handleRemove}
                  onConfigure={handleConfigure}
                  orderIndex={index}
                  orderTotal={activeAddons.length}
                  onMoveUp={handleMoveUp}
                  onMoveDown={handleMoveDown}
                />
              ))}
            </TVFocusGuideView>
          </Box>
        )}

        {/* Installed But Inactive Addons Section */}
        {showInstalled && inactiveAddons.length > 0 && (
          <Box gap="m">
            <Text variant="subheader">
              {t('addons.installed_count', { count: inactiveAddons.length })}
            </Text>
            <Box gap="s">
              {inactiveAddons.map((item) => (
                <AddonCard
                  key={item.id}
                  addon={item}
                  onRemove={handleRemove}
                  onConfigure={handleConfigure}
                />
              ))}
            </Box>
          </Box>
        )}

        {/* No Addons Message */}
        {showInstalled && orderedAddons.length === 0 && (
          <SettingsCard>
            <Text variant="body" color="textSecondary">
              {t('addons.no_addons_installed')}
            </Text>
          </SettingsCard>
        )}
      </Box>
    );

    if (scrollable) {
      return (
        <>
          <ScrollView showsVerticalScrollIndicator={false}>{content}</ScrollView>
          <RemoteControlModal visible={isRemoteControlVisible} onClose={handleCloseRemoteControl} />
        </>
      );
    }

    return (
      <>
        {content}
        <RemoteControlModal visible={isRemoteControlVisible} onClose={handleCloseRemoteControl} />
      </>
    );
  }
);

interface RemoteControlShortcutProps {
  onPress: () => void;
}

/**
 * Shortcut card that opens the remote control modal.
 * Shown on wide layouts and in dev mode.
 */
const RemoteControlShortcut: FC<RemoteControlShortcutProps> = memo(({ onPress }) => {
  const theme = useTheme<Theme>();
  const { t } = useTranslation('settings');

  return (
    <Focusable variant="none" onPress={onPress} hasTVPreferredFocus>
      {({ isFocused }) => (
        <Box
          flexDirection="row"
          alignItems="center"
          gap="l"
          padding="l"
          backgroundColor={isFocused ? 'focusBackground' : 'cardBackground'}
          borderRadius="m">
          <Ionicons
            name="wifi"
            size={theme.sizes.iconMedium}
            color={isFocused ? theme.colors.focusForeground : theme.colors.textSecondary}
          />
          <Box flex={1} gap="xs">
            <Text variant="cardTitle" color={isFocused ? 'focusForeground' : 'textPrimary'}>
              {t('remoteControl.manage_title')}
            </Text>
            <Text variant="caption" color={isFocused ? 'focusForeground' : 'textSecondary'}>
              {t('remoteControl.manage_desc')}
            </Text>
          </Box>
          <Ionicons
            name="chevron-forward"
            size={theme.sizes.iconMedium}
            color={isFocused ? theme.colors.focusForeground : theme.colors.textSecondary}
          />
        </Box>
      )}
    </Focusable>
  );
});

interface AddonCardProps {
  addon: InstalledAddon;
  onRemove: (id: string, name: string) => void;
  onConfigure: (url: string) => void;
  /** Position in the active addons list (undefined = inactive, no reorder UI) */
  orderIndex?: number;
  orderTotal?: number;
  onMoveUp?: (id: string) => void;
  onMoveDown?: (id: string) => void;
}

/**
 * Individual addon card with action buttons and toggles.
 * Uses Focusable for all interactive elements to support TV navigation.
 */
const AddonCard: FC<AddonCardProps> = memo(
  ({ addon, onRemove, onConfigure, orderIndex, orderTotal, onMoveUp, onMoveDown }) => {
    const { t } = useTranslation('settings');
    const theme = useTheme<Theme>();
    const activeProfileId = useProfileStore((state) => state.activeProfileId);
    const config = useAddonStore(
      (state) => state.configsByProfile[activeProfileId ?? '']?.[addon.id]
    );
    const activateAddon = useAddonStore((state) => state.activateAddon);
    const deactivateAddon = useAddonStore((state) => state.deactivateAddon);
    const toggleUseCatalogsOnHome = useAddonStore((state) => state.toggleUseCatalogsOnHome);
    const toggleUseCatalogsInSearch = useAddonStore((state) => state.toggleUseCatalogsInSearch);
    const toggleUseForSubtitles = useAddonStore((state) => state.toggleUseForSubtitles);
    const isActive = config?.isActive === true;
    const canMoveUp =
      orderTotal !== undefined && orderTotal > 1 && orderIndex !== undefined && orderIndex > 0;
    const canMoveDown =
      orderTotal !== undefined &&
      orderTotal > 1 &&
      orderIndex !== undefined &&
      orderIndex < orderTotal - 1;

    const handleRemove = useCallback(() => {
      onRemove(addon.id, addon.manifest.name);
    }, [addon.id, addon.manifest.name, onRemove]);

    const handleConfigure = useCallback(() => {
      onConfigure(addon.manifestUrl);
    }, [addon.manifestUrl, onConfigure]);

    const handleToggleActive = useCallback(() => {
      debug('AddonCard.handleToggleActive', {
        addonId: addon.id,
        addonName: addon.manifest.name,
        activeProfileId,
        currentIsActive: isActive,
        action: isActive ? 'deactivate' : 'activate',
        hasConfig: !!config,
      });
      if (isActive) {
        deactivateAddon(addon.id);
      } else {
        activateAddon(addon.id);
      }
    }, [
      isActive,
      addon.id,
      activateAddon,
      deactivateAddon,
      activeProfileId,
      config,
      addon.manifest.name,
    ]);

    const handleToggleHome = useCallback(() => {
      toggleUseCatalogsOnHome(addon.id);
    }, [addon.id, toggleUseCatalogsOnHome]);

    const handleToggleSearch = useCallback(() => {
      toggleUseCatalogsInSearch(addon.id);
    }, [addon.id, toggleUseCatalogsInSearch]);

    const handleToggleSubtitles = useCallback(() => {
      toggleUseForSubtitles(addon.id);
    }, [addon.id, toggleUseForSubtitles]);

    const handleMoveUp = useCallback(() => {
      onMoveUp?.(addon.id);
    }, [addon.id, onMoveUp]);

    const handleMoveDown = useCallback(() => {
      onMoveDown?.(addon.id);
    }, [addon.id, onMoveDown]);

    return (
      <Box backgroundColor="cardBackground" padding="m" borderRadius="m" gap="m">
        {/* Header with title and action buttons */}
        <Box flexDirection="row" justifyContent="space-between" alignItems="flex-start">
          <Box flex={1} gap="xs">
            <Text variant="cardTitle">{addon.manifest.name}</Text>
            <Text variant="caption" color="textSecondary" numberOfLines={1}>
              {addon.manifestUrl}
            </Text>
            {addon.manifest.catalogs && (
              <Text variant="caption" color="textSecondary">
                {t('addons.catalogs_count', { count: addon.manifest.catalogs.length })}
              </Text>
            )}
          </Box>

          {/* Action buttons */}
          <Box flexDirection="row" gap="s" alignItems="center">
            {/* Reorder buttons — only shown when the move is actually possible */}
            {canMoveUp && (
              <AddonActionButton
                iconName="chevron-up-outline"
                iconColor={theme.colors.mainForeground}
                onPress={handleMoveUp}
              />
            )}
            {canMoveDown && (
              <AddonActionButton
                iconName="chevron-down-outline"
                iconColor={theme.colors.mainForeground}
                onPress={handleMoveDown}
              />
            )}
            <AddonActionButton
              iconName={isActive ? 'checkmark-circle-outline' : 'add-circle-outline'}
              iconColor={isActive ? theme.colors.primaryBackground : theme.colors.textSecondary}
              onPress={handleToggleActive}
            />
            <AddonActionButton
              iconName="trash-outline"
              iconColor={theme.colors.danger}
              onPress={handleRemove}
            />
            {addon.manifest.behaviorHints?.configurable && (
              <AddonActionButton
                iconName="settings-outline"
                iconColor={theme.colors.mainForeground}
                onPress={handleConfigure}
              />
            )}
          </Box>
        </Box>

        {/* Settings toggles — only shown when active for this profile */}
        {isActive && config && (
          <Box gap="s">
            <SettingsSwitch
              label={t('addons.visible_on_home')}
              value={config.useCatalogsOnHome}
              onValueChange={handleToggleHome}
              description={t('addons.visible_on_home_desc')}
            />
            <SettingsSwitch
              label={t('addons.use_in_search')}
              value={config.useCatalogsInSearch}
              onValueChange={handleToggleSearch}
              description={t('addons.use_in_search_desc')}
            />
            <SettingsSwitch
              label={t('addons.use_for_subtitles')}
              value={config.useForSubtitles}
              onValueChange={handleToggleSubtitles}
              description={t('addons.use_for_subtitles_desc')}
            />
          </Box>
        )}
      </Box>
    );
  }
);

interface AddonActionButtonProps {
  iconName: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  onPress: () => void;
}

/**
 * Focusable icon button for addon actions (remove, configure, reorder).
 * Uses background color change on focus for proper TV support.
 */
const AddonActionButton: FC<AddonActionButtonProps> = memo(({ iconName, iconColor, onPress }) => {
  return (
    <Focusable onPress={onPress} variant="outline">
      <Button variant="tertiary" icon={iconName} onPress={onPress} />
    </Focusable>
  );
});
