import { FC, memo, useState, useCallback } from 'react';
import { Alert, Linking } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { FlashList } from '@shopify/flash-list';
import { useTheme } from '@shopify/restyle';
import { Box, Text, type Theme } from '@/theme/theme';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '@/components/basic/Input';
import { Button } from '@/components/basic/Button';
import { SettingsCard } from '@/components/settings/SettingsCard';
import { useAddonStore } from '@/store/addon.store';
import { useInstallAddon } from '@/api/stremio';
import { InstalledAddon } from '@/types/stremio';
import { showToast } from '@/store/toast.store';
import { SettingsSwitch } from '@/components/settings/SettingsSwitch';
import { Focusable } from '@/components/basic/Focusable';
import { VerticalSpacer } from '@/components/basic/Spacer';

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
    const [manifestUrl, setManifestUrl] = useState('');
    // Use proper selectors to subscribe to store changes
    const addons = useAddonStore((state) => Object.values(state.addons));
    const removeAddon = useAddonStore((state) => state.removeAddon);
    const toggleUseCatalogsOnHome = useAddonStore((state) => state.toggleUseCatalogsOnHome);
    const toggleUseCatalogsInSearch = useAddonStore((state) => state.toggleUseCatalogsInSearch);
    const toggleUseForSubtitles = useAddonStore((state) => state.toggleUseForSubtitles);
    const storeError = useAddonStore((state) => state.error);
    const installAddon = useInstallAddon();

    const handleInstall = useCallback(async () => {
      if (!manifestUrl.trim()) {
        showToast({ title: 'Error', message: 'Please enter a manifest URL', preset: 'error' });
        return;
      }

      if (!manifestUrl.endsWith('manifest.json')) {
        showToast({ title: 'Error', message: 'URL must end with manifest.json', preset: 'error' });
        return;
      }

      try {
        await installAddon.mutateAsync(manifestUrl);
        setManifestUrl('');
        showToast({ title: 'Success', message: 'Addon installed successfully', preset: 'success' });
      } catch (error) {
        showToast({
          title: 'Installation Failed',
          message: error instanceof Error ? error.message : 'Failed to install addon',
          preset: 'error',
        });
      }
    }, [manifestUrl, installAddon]);

    const handleRemove = useCallback(
      (id: string, name: string) => {
        Alert.alert('Remove Addon', `Are you sure you want to remove "${name}"?`, [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => removeAddon(id),
          },
        ]);
      },
      [removeAddon]
    );

    const handleConfigure = useCallback((url: string) => {
      const configureUrl = url.replace(/manifest\.json$/, 'configure');
      Linking.openURL(configureUrl).catch(() => {
        showToast({
          title: 'Failed to open configuration URL',
          preset: 'error',
        });
      });
    }, []);

    const content = (
      <Box padding="m" gap="l" flex={1}>
        {/* Install Addon Section */}
        {showInstall && (
          <SettingsCard title="Install Addon">
            <Input
              placeholder="https://example.com/manifest.json"
              value={manifestUrl}
              onChangeText={setManifestUrl}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Button
              variant="primary"
              title={installAddon.isPending ? 'Installing...' : 'Install Addon'}
              onPress={handleInstall}
              disabled={installAddon.isPending}
            />
            {(storeError || installAddon.isError) && (
              <Text variant="bodySmall" color="danger">
                {storeError || 'Failed to install addon'}
              </Text>
            )}
          </SettingsCard>
        )}

        {/* Installed Addons Section */}
        {showInstalled && (
          <Box gap="m" flex={1}>
            <Text variant="subheader">Installed Addons ({addons.length})</Text>
            {addons.length === 0 ? (
              <SettingsCard>
                <Text variant="body" color="textSecondary">
                  No addons installed
                </Text>
              </SettingsCard>
            ) : (
              <FlashList
                data={addons}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <AddonCard
                    addon={item}
                    onRemove={handleRemove}
                    onConfigure={handleConfigure}
                    onToggleHome={toggleUseCatalogsOnHome}
                    onToggleSearch={toggleUseCatalogsInSearch}
                    onToggleSubtitles={toggleUseForSubtitles}
                  />
                )}
                ItemSeparatorComponent={VerticalSpacer}
                showsVerticalScrollIndicator={false}
              />
            )}
          </Box>
        )}
      </Box>
    );

    if (scrollable) {
      return <ScrollView showsVerticalScrollIndicator={false}>{content}</ScrollView>;
    }

    return content;
  }
);

interface AddonCardProps {
  addon: InstalledAddon;
  onRemove: (id: string, name: string) => void;
  onToggleHome: (id: string) => void;
  onToggleSearch: (id: string) => void;
  onToggleSubtitles: (id: string) => void;
  onConfigure: (url: string) => void;
}

/**
 * Individual addon card with action buttons and toggles.
 * Uses Focusable for all interactive elements to support TV navigation.
 */
const AddonCard: FC<AddonCardProps> = memo(
  ({ addon, onRemove, onToggleHome, onToggleSearch, onToggleSubtitles, onConfigure }) => {
    const theme = useTheme<Theme>();

    const handleRemove = useCallback(() => {
      onRemove(addon.id, addon.manifest.name);
    }, [addon.id, addon.manifest.name, onRemove]);

    const handleConfigure = useCallback(() => {
      onConfigure(addon.manifestUrl);
    }, [addon.manifestUrl, onConfigure]);

    const handleToggleHome = useCallback(() => {
      onToggleHome(addon.id);
    }, [addon.id, onToggleHome]);

    const handleToggleSearch = useCallback(() => {
      onToggleSearch(addon.id);
    }, [addon.id, onToggleSearch]);

    const handleToggleSubtitles = useCallback(() => {
      onToggleSubtitles(addon.id);
    }, [addon.id, onToggleSubtitles]);

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
                {addon.manifest.catalogs.length} catalog(s)
              </Text>
            )}
          </Box>

          {/* Action buttons */}
          <Box flexDirection="row" gap="s">
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

        {/* Settings toggles */}
        <Box gap="s">
          <SettingsSwitch
            label="Visible on Home"
            value={addon.useCatalogsOnHome}
            onValueChange={handleToggleHome}
            description="Catalogs are visible on the Home screen"
          />
          <SettingsSwitch
            label="Use in Search"
            value={addon.useCatalogsInSearch}
            onValueChange={handleToggleSearch}
            description="Catalogs are used for searching"
          />
          <SettingsSwitch
            label="Use for Subtitles"
            value={addon.useForSubtitles}
            onValueChange={handleToggleSubtitles}
            description="Subtitles are fetched from this addon if available"
          />
        </Box>
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
 * Focusable icon button for addon actions (remove, configure).
 * Uses background color change on focus for proper TV support.
 */
const AddonActionButton: FC<AddonActionButtonProps> = memo(({ iconName, iconColor, onPress }) => {
  return (
    <Focusable onPress={onPress} variant="outline">
      <Button variant="tertiary" icon={iconName} onPress={onPress} />
    </Focusable>
  );
});
