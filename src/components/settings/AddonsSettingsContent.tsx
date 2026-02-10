import { FC, memo, useCallback, useMemo, useState } from 'react';
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
import { InstalledAddon, Manifest } from '@/types/stremio';
import { showToast } from '@/store/toast.store';
import { SettingsSwitch } from '@/components/settings/SettingsSwitch';

/** Checks if a manifest declares a given resource name */
function hasResource(manifest: Manifest, resourceName: string): boolean {
  return manifest.resources.some((resource) => {
    if (typeof resource === 'string') return resource === resourceName;
    return resource.name === resourceName;
  });
}

/** Checks if a manifest has catalogs */
function hasCatalogs(manifest: Manifest): boolean {
  return Array.isArray(manifest.catalogs) && manifest.catalogs.length > 0;
}

interface AddonCapabilities {
  hasCatalog: boolean;
  hasMeta: boolean;
  hasStream: boolean;
  catalogAddons: string[];
  metaAddons: string[];
  streamAddons: string[];
}

/** Icons for each addon capability type */
const CAPABILITY_ICONS = {
  catalog: 'grid-outline' as const,
  meta: 'information-circle-outline' as const,
  stream: 'play-circle-outline' as const,
};

function getAddonCapabilities(addons: InstalledAddon[]): AddonCapabilities {
  const catalogAddons: string[] = [];
  const metaAddons: string[] = [];
  const streamAddons: string[] = [];

  for (const addon of addons) {
    const { manifest } = addon;
    if (hasCatalogs(manifest)) catalogAddons.push(manifest.name);
    if (hasResource(manifest, 'meta')) metaAddons.push(manifest.name);
    if (hasResource(manifest, 'stream')) streamAddons.push(manifest.name);
  }

  return {
    hasCatalog: catalogAddons.length > 0,
    hasMeta: metaAddons.length > 0,
    hasStream: streamAddons.length > 0,
    catalogAddons,
    metaAddons,
    streamAddons,
  };
}

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
    const addonsMap = useAddonStore((state) => state.addons);
    const removeAddon = useAddonStore((state) => state.removeAddon);
    const clearAllAddons = useAddonStore((state) => state.clearAllAddons);
    const toggleUseCatalogsOnHome = useAddonStore((state) => state.toggleUseCatalogsOnHome);
    const toggleUseCatalogsInSearch = useAddonStore((state) => state.toggleUseCatalogsInSearch);
    const toggleUseForSubtitles = useAddonStore((state) => state.toggleUseForSubtitles);
    const storeError = useAddonStore((state) => state.error);
    const addons = useMemo(() => Object.values(addonsMap), [addonsMap]);
    const capabilities = useMemo(() => getAddonCapabilities(addons), [addons]);
    const installAddon = useInstallAddon();

    const handleClearAll = useCallback(() => {
      Alert.alert(
        'Remove All Addons',
        `Are you sure you want to remove all ${addons.length} installed addons? This cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove All',
            style: 'destructive',
            onPress: () => {
              clearAllAddons();
              showToast({ title: 'All addons removed', preset: 'success' });
            },
          },
        ]
      );
    }, [addons.length, clearAllAddons]);

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

        {/* Addon Setup Checklist */}
        <AddonChecklist capabilities={capabilities} />

        {/* Installed Addons Section */}
        {showInstalled && (
          <Box gap="m" flex={1}>
            <Box flexDirection="row" justifyContent="space-between" alignItems="center">
              <Text variant="subheader">Installed Addons ({addons.length})</Text>
              {addons.length > 0 && (
                <Button
                  variant="tertiary"
                  title="Clear All"
                  icon="trash-outline"
                  onPress={handleClearAll}
                />
              )}
            </Box>
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

const AddonCard: FC<AddonCardProps> = memo(
  ({ addon, onRemove, onToggleHome, onToggleSearch, onToggleSubtitles, onConfigure }) => {
    const isCatalog = hasCatalogs(addon.manifest);
    const isMeta = hasResource(addon.manifest, 'meta');
    const isStream = hasResource(addon.manifest, 'stream');

    return (
      <Box backgroundColor="cardBackground" padding="m" borderRadius="m" gap="m">
        {/* Header with title and remove button */}
        <Box flexDirection="row" justifyContent="space-between" alignItems="flex-start">
          <Box flex={1} gap="xs">
            <Text variant="cardTitle">{addon.manifest.name}</Text>
            <Text variant="caption" color="textSecondary" numberOfLines={1}>
              {addon.manifestUrl}
            </Text>
            {/* Capability badges */}
            <Box flexDirection="row" gap="s" marginTop="xs">
              <CapabilityBadge icon={CAPABILITY_ICONS.catalog} label="Catalog" active={isCatalog} />
              <CapabilityBadge icon={CAPABILITY_ICONS.meta} label="Meta" active={isMeta} />
              <CapabilityBadge icon={CAPABILITY_ICONS.stream} label="Streams" active={isStream} />
            </Box>
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

// ── Shared Capability Badge ─────────────────────────────────────────────────

interface CapabilityBadgeProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active: boolean;
}

const CapabilityBadge: FC<CapabilityBadgeProps> = memo(({ icon, label, active }) => (
  <Box flexDirection="row" alignItems="center" gap="xs" opacity={active ? 1 : 0.35}>
    <Ionicons
      name={icon}
      size={14}
      color={active ? theme.colors.primaryBackground : theme.colors.textSecondary}
    />
    <Text variant="caption" color={active ? 'textPrimary' : 'textSecondary'}>
      {label}
    </Text>
  </Box>
));

CapabilityBadge.displayName = 'CapabilityBadge';

// ── Addon Setup Checklist ──────────────────────────────────────────────────

interface ChecklistItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description: string;
  fulfilled: boolean;
  count: number;
}

const ChecklistItem: FC<ChecklistItemProps> = memo(({ icon, label, description, fulfilled, count }) => (
  <Box flexDirection="row" alignItems="center" gap="m" paddingVertical="xs">
    <Ionicons
      name={icon}
      size={22}
      color={fulfilled ? theme.colors.primaryBackground : theme.colors.danger}
    />
    <Box flex={1} gap="xs">
      <Text variant="body" color={fulfilled ? 'textPrimary' : 'danger'}>
        {label}
      </Text>
      <Text variant="caption" color="textSecondary" numberOfLines={2}>
        {fulfilled
          ? `${count} addon${count !== 1 ? 's' : ''}`
          : description}
      </Text>
    </Box>
  </Box>
));

ChecklistItem.displayName = 'ChecklistItem';

interface AddonChecklistProps {
  capabilities: AddonCapabilities;
}

const AddonChecklist: FC<AddonChecklistProps> = memo(({ capabilities }) => {
  const allGood = capabilities.hasCatalog && capabilities.hasMeta && capabilities.hasStream;

  return (
    <SettingsCard title="Setup Checklist">
      {allGood ? (
        <Text variant="caption" color="textSecondary">
          You have all the essential addon types installed. You're good to go!
        </Text>
      ) : (
        <Text variant="caption" color="danger">
          You're missing essential addon types. Install addons that provide the missing capabilities
          below to get the full experience.
        </Text>
      )}

      <Box gap="s">
        <ChecklistItem
          icon={CAPABILITY_ICONS.catalog}
          label="Catalog"
          description="Needed to browse and discover content on the home screen and search"
          fulfilled={capabilities.hasCatalog}
          count={capabilities.catalogAddons.length}
        />
        <ChecklistItem
          icon={CAPABILITY_ICONS.meta}
          label="Metadata"
          description="Needed to show details like descriptions, cast, and episodes for content"
          fulfilled={capabilities.hasMeta}
          count={capabilities.metaAddons.length}
        />
        <ChecklistItem
          icon={CAPABILITY_ICONS.stream}
          label="Streams"
          description="Needed to find playable sources for content. Nothing will play without this"
          fulfilled={capabilities.hasStream}
          count={capabilities.streamAddons.length}
        />
      </Box>
    </SettingsCard>
  );
});

AddonChecklist.displayName = 'AddonChecklist';
