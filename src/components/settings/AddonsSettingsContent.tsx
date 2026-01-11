import { FC, memo, useState } from 'react';
import { Alert, Linking, TextInput, TouchableOpacity } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import theme, { Box, Text } from '@/theme/theme';
import { useAddonStore } from '@/store/addon.store';
import { useInstallAddon } from '@/api/stremio';
import { InstalledAddon } from '@/types/stremio';
import { Button } from '@/components/basic/Button';
import { Modal } from '@/components/basic/Modal';
import { toast } from 'burnt';

export const AddonsSettingsContent: FC = memo(() => {
  const { getAddonsList, removeAddon } = useAddonStore();
  const addons = getAddonsList();
  const installAddon = useInstallAddon();

  const [focusedAddonId, setFocusedAddonId] = useState<string | null>(null);
  const [selectedAddon, setSelectedAddon] = useState<InstalledAddon | null>(null);
  const [installModalVisible, setInstallModalVisible] = useState(false);
  const [installUrl, setInstallUrl] = useState('');

  const handleInstallAddon = async () => {
    if (!installUrl.trim()) {
      return toast({ title: 'Enter manifest URL', preset: 'error', haptic: 'error' });
    }
    if (!installUrl.endsWith('manifest.json')) {
      return toast({ title: 'URL must end with manifest.json', preset: 'error', haptic: 'error' });
    }

    try {
      await installAddon.mutateAsync(installUrl);
      setInstallUrl('');
      setInstallModalVisible(false);
      toast({ title: 'Addon installed', preset: 'done', haptic: 'success' });
    } catch {
      toast({ title: 'Failed to install addon', preset: 'error', haptic: 'error' });
    }
  };

  return (
    <Box flex={1} flexDirection="row" padding="xl" gap="xl">
      {/* ADDONS LIST */}
      <Box width="100%">
        <Text variant="subheader" marginBottom="m">
          Addons
        </Text>

        <FlashList
          data={[{ id: 'add-addon' } as InstalledAddon, ...addons]}
          keyExtractor={(item) => item.id}
          onBlur={() => setFocusedAddonId(null)}
          ItemSeparatorComponent={() => <Box height={theme.spacing.m} />}
          renderItem={({ item }) => {
            const isFocused = focusedAddonId === item.id;
            const isAdd = item.id === 'add-addon';

            return (
              <AddonRow
                addon={isAdd ? undefined : item}
                addonPlaceholder={isAdd}
                label={isAdd ? 'Add Addon' : undefined}
                focused={isFocused}
                onFocus={() => setFocusedAddonId(item.id)}
                onPress={() => (isAdd ? setInstallModalVisible(true) : setSelectedAddon(item))}
              />
            );
          }}
        />
      </Box>

      {/* INSTALL MODAL */}
      <Modal visible={installModalVisible} onClose={() => setInstallModalVisible(false)}>
        <Box
          width="90%"
          maxWidth={600}
          padding="xl"
          borderRadius="xl"
          backgroundColor="cardBackground">
          <Text variant="header">Install Addon</Text>

          <TextInput
            placeholder="https://example.com/manifest.json"
            value={installUrl}
            onChangeText={setInstallUrl}
            style={{
              marginTop: theme.spacing.m,
              padding: theme.spacing.m,
              borderWidth: 1,
              borderRadius: theme.borderRadii.m,
              borderColor: theme.colors.cardBorder,
              color: theme.colors.textPrimary,
            }}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Box flexDirection="row" justifyContent="center" gap="m" marginTop="xl">
            <Button title="Install" onPress={handleInstallAddon} />
            <Button
              variant="secondary"
              title="Cancel"
              onPress={() => setInstallModalVisible(false)}
            />
          </Box>
        </Box>
      </Modal>

      {/* DETAILS MODAL */}
      {selectedAddon && (
        <Modal visible onClose={() => setSelectedAddon(null)}>
          <Box
            width="90%"
            maxWidth={700}
            padding="xl"
            borderRadius="xl"
            backgroundColor="cardBackground">
            <Text variant="header">{selectedAddon.manifest.name}</Text>

            <Text variant="body" color="textSecondary" marginTop="s" numberOfLines={4}>
              {selectedAddon.manifest.description}
            </Text>

            <Text variant="caption" color="textSecondary" marginTop="m">
              Supported types: {selectedAddon.manifest.types?.join(', ')}
            </Text>

            <Box flexDirection="row" justifyContent="center" gap="m" marginTop="xl">
              {selectedAddon.manifest.behaviorHints?.configurable && (
                <Button
                  title="Configure"
                  onPress={() => {
                    const url = selectedAddon.manifestUrl.replace(/manifest\.json$/, 'configure');
                    Linking.openURL(url).catch(() =>
                      toast({ title: 'Failed to open URL', preset: 'error' })
                    );
                  }}
                />
              )}

              <Button
                title="Uninstall"
                onPress={() =>
                  Alert.alert('Remove Addon', `Remove "${selectedAddon.manifest.name}"?`, [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Remove',
                      style: 'destructive',
                      onPress: () => {
                        removeAddon(selectedAddon.id);
                        setSelectedAddon(null);
                      },
                    },
                  ])
                }
              />

              <Button variant="secondary" title="Close" onPress={() => setSelectedAddon(null)} />
            </Box>
          </Box>
        </Modal>
      )}
    </Box>
  );
});

/* ADDON ROW COMPONENT */
const AddonRow = ({
  addon,
  addonPlaceholder,
  label,
  focused,
  onPress,
  onFocus,
}: {
  addon?: InstalledAddon;
  addonPlaceholder?: boolean;
  label?: string;
  focused: boolean;
  onPress: () => void;
  onFocus?: () => void;
}) => {
  const displayLabel = addonPlaceholder ? label : (addon?.manifest.name ?? '');

  return (
    <Box borderRadius="l" overflow="hidden">
      <TouchableOpacity
        focusable
        onFocus={onFocus}
        onPress={onPress}
        style={{
          padding: theme.spacing.m,
          borderRadius: theme.borderRadii.m,
          backgroundColor: theme.colors.cardBackground,
          opacity: focused ? 1 : 0.4,
          transform: [{ scale: focused ? 1.06 : 1 }],
          elevation: focused ? 8 : 0,
        }}>
        <Box flexDirection="row" gap="m" alignItems="center">
          <Ionicons
            name={addonPlaceholder ? 'add-circle-outline' : 'extension-puzzle-outline'}
            size={36}
            color={focused ? theme.colors.primaryBackground : theme.colors.textSecondary}
          />

          <Box flex={1}>
            <Text variant="cardTitle">{displayLabel}</Text>
            {!!addon && (
              <Text variant="caption" color="textSecondary">
                v{addon.manifest.version}
              </Text>
            )}
          </Box>
        </Box>
      </TouchableOpacity>
    </Box>
  );
};
