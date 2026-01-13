import { FC, memo, useState } from 'react';
import { Alert, TouchableOpacity, Switch, Linking } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { FlashList } from '@shopify/flash-list';
import theme, { Box, Text } from '@/theme/theme';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '@/components/basic/Input';
import { Button } from '@/components/basic/Button';
import { SettingsCard } from '@/components/settings/SettingsCard';
import { useAddonStore } from '@/store/addon.store';
import { useInstallAddon } from '@/api/stremio';
import { InstalledAddon } from '@/types/stremio';
import { showToast } from '@/store/toast.store';
import { SettingsSwitch } from '@/components/settings/SettingsSwitch';

/**
 * Addons settings content component
 * Extracted for use in both standalone page and split layout
 */
export const AddonsSettingsContent: FC = memo(() => {
  const [manifestUrl, setManifestUrl] = useState('');
  const {
    removeAddon,
    toggleUseCatalogsOnHome,
    toggleUseCatalogsInSearch,
    toggleUseForSubtitles,
    error: storeError,
    getAddonsList,
  } = useAddonStore();
  const addons = getAddonsList();
  const installAddon = useInstallAddon();

  const handleInstall = async () => {
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
  };

  const handleRemove = (id: string, name: string) => {
    Alert.alert('Remove Addon', `Are you sure you want to remove "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => removeAddon(id),
      },
    ]);
  };

  const onConfigure = (url: string) => {
    const configureUrl = url.replace(/manifest\.json$/, 'configure');
    Linking.openURL(configureUrl).catch(() => {
      showToast({
        title: 'Failed to open configuration URL',
        preset: 'error',
      });
    });
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <Box padding="m" gap="l" flex={1}>
        {/* Install Addon Section */}
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

        {/* Installed Addons Section */}
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
                  onConfigure={onConfigure}
                  onToggleHome={toggleUseCatalogsOnHome}
                  onToggleSearch={toggleUseCatalogsInSearch}
                  onToggleSubtitles={toggleUseForSubtitles}
                />
              )}
              ItemSeparatorComponent={() => <Box height={8} />}
              showsVerticalScrollIndicator={false}
            />
          )}
        </Box>
      </Box>
    </ScrollView>
  );
});

interface AddonCardProps {
  addon: InstalledAddon;
  onRemove: (id: string, name: string) => void;
  onToggleHome: (id: string) => void;
  onToggleSearch: (id: string) => void;
  onToggleSubtitles: (id: string) => void;
  onConfigure: (url: string) => void;
}

const AddonCard: FC<AddonCardProps> = memo(
  ({ addon, onRemove, onToggleHome, onToggleSearch, onToggleSubtitles, onConfigure }) => {
    return (
      <Box backgroundColor="cardBackground" padding="m" borderRadius="m" gap="m">
        {/* Header with title and remove button */}
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
          <Box flexDirection="row" gap="xs">
            <TouchableOpacity onPress={() => onRemove(addon.id, addon.manifest.name)}>
              <Ionicons name="trash-outline" size={20} color={theme.colors.danger} />
            </TouchableOpacity>
            {addon.manifest.behaviorHints?.configurable && (
              <TouchableOpacity onPress={() => onConfigure(addon.manifestUrl)}>
                <Ionicons name="settings-outline" size={20} color={theme.colors.mainForeground} />
              </TouchableOpacity>
            )}
          </Box>
        </Box>

        {/* Settings toggles */}
        <Box gap="s">
          <SettingsSwitch
            label="Visible on Home"
            value={addon.useCatalogsOnHome}
            onValueChange={() => onToggleHome(addon.id)}
            description="Catalogs are visible on the Home screen"
          />
          <SettingsSwitch
            label="Use in Search"
            value={addon.useCatalogsInSearch}
            onValueChange={() => onToggleSearch(addon.id)}
            description="Catalogs are used for searching"
          />
          <SettingsSwitch
            label="Use for Subtitles"
            value={addon.useForSubtitles}
            onValueChange={() => onToggleSubtitles(addon.id)}
            description="Subtitles are fetched from this addon if available"
          />
        </Box>
      </Box>
    );
  }
);
