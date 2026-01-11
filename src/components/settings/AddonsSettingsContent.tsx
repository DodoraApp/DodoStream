import { FC, memo, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Alert,
  Modal,
  Dimensions,
  TextInput,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import theme, { Box, Text } from '@/theme/theme';
import { Ionicons } from '@expo/vector-icons';
import { useAddonStore } from '@/store/addon.store';
import { useInstallAddon } from '@/api/stremio';
import { InstalledAddon } from '@/types/stremio';
import { toast } from 'burnt';
import { Button } from '../basic/Button';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;

export const AddonsSettingsContent: FC = memo(() => {
  const { getAddonsList, removeAddon } = useAddonStore();
  const addons = getAddonsList();
  const [focusedAddonId, setFocusedAddonId] = useState<string | null>(null);
  const [selectedAddon, setSelectedAddon] = useState<InstalledAddon | null>(null);
  const [installModalVisible, setInstallModalVisible] = useState(false);
  const [installUrl, setInstallUrl] = useState('');
  const installAddon = useInstallAddon();

  const handleInstallAddon = async () => {
    if (!installUrl.trim()) return;
    toast({ title: 'Enter manifest URL', preset: 'error', haptic: 'error' });
    if (!installUrl.endsWith('manifest.json')) return;
    toast({ title: 'URL must end with manifest.json', preset: 'error', haptic: 'error' });

    try {
      await installAddon.mutateAsync(installUrl);
      setInstallUrl('');
      setInstallModalVisible(false);
      toast({ title: 'Addon installed', preset: 'done', haptic: 'success' });
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) {
      toast({
        title: 'Failed to install addon',
        preset: 'error',
        haptic: 'error',
      });
    }
  };

  return (
    <View style={styles.container}>
      {/* ADDONS LIST */}
      <View style={styles.listPane}>
        <Text variant="subheader" marginBottom="m">
          Addons
        </Text>

        <FlashList
          data={[{ id: 'add-addon' } as InstalledAddon, ...addons]}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => {
            const isFocused = focusedAddonId === item.id;

            if (item.id === 'add-addon') {
              return (
                <AddonRow
                  addonPlaceholder
                  label="Add Addon"
                  focused={isFocused}
                  onFocus={() => setFocusedAddonId(item.id)}
                  onPress={() => setInstallModalVisible(true)}
                />
              );
            }

            return (
              <AddonRow
                addon={item}
                focused={isFocused}
                onFocus={() => setFocusedAddonId(item.id)}
                onPress={() => setSelectedAddon(item)}
              />
            );
          }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          onBlur={() => setFocusedAddonId(null)} // <-- reset focus when list loses it
        />
      </View>

      {/* INSTALL MODAL */}
      <Modal visible={installModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.details}>
            <Text variant="header">Install Addon</Text>
            <TextInput
              placeholder="https://example.com/manifest.json"
              value={installUrl}
              onChangeText={setInstallUrl}
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Box flexDirection="row" justifyContent="center" gap="m" marginTop="l">
              <Button title="Install" onPress={handleInstallAddon} />
              <Button
                variant="secondary"
                title="Cancel"
                onPress={() => setInstallModalVisible(false)}
              />
            </Box>
          </View>
        </View>
      </Modal>

      {/* DETAILS MODAL */}
      {selectedAddon && (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setSelectedAddon(null)}>
          <View style={styles.modalOverlay}>
            <View style={styles.details}>
              <Text variant="header">{selectedAddon.manifest.name}</Text>

              <Text variant="body" color="textSecondary" marginTop="s" numberOfLines={4}>
                {selectedAddon.manifest.description}
              </Text>

              <Text variant="caption" color="textSecondary" marginTop="m">
                Supported types: {selectedAddon.manifest.types?.join(', ')}
              </Text>

              <View style={styles.actionsRow}>
                {selectedAddon.manifest.behaviorHints?.configurable && (
                  <Button
                    title="Configure"
                    variant="primary"
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
                  variant="primary"
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
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
});

/* ────────────────────────────────────────────── */
/* ADDON ROW                                      */
/* ────────────────────────────────────────────── */

const AddonRow = ({
  addon,
  addonPlaceholder,
  label,
  focused,
  onPress,
  onFocus,
  hasTVPreferredFocus,
}: {
  addon?: InstalledAddon;
  addonPlaceholder?: boolean;
  label?: string;
  focused: boolean;
  onPress: () => void;
  onFocus?: () => void;
  hasTVPreferredFocus?: boolean;
}) => {
  const displayLabel = addonPlaceholder ? label : (addon?.manifest.name ?? '');

  return (
    <View style={styles.rowWrapper}>
      <TouchableOpacity
        focusable
        hasTVPreferredFocus={hasTVPreferredFocus}
        onFocus={onFocus}
        onBlur={() => {}}
        onPress={onPress}
        style={[styles.row, focused ? styles.rowFocused : styles.rowDimmed]}>
        <Box flexDirection="row" gap="m" alignItems="center">
          <Ionicons
            name={addonPlaceholder ? 'add-circle-outline' : 'extension-puzzle-outline'}
            size={36}
            color={focused ? theme.colors.primaryBackground : theme.colors.textSecondary}
          />
          <Box flex={1}>
            <Text variant="cardTitle">{displayLabel}</Text>
            {!addonPlaceholder && addon && (
              <Text variant="caption" color="textSecondary">
                v{addon.manifest.version}
              </Text>
            )}
          </Box>
        </Box>
      </TouchableOpacity>
    </View>
  );
};

/* ────────────────────────────────────────────── */
/* STYLES                                         */
/* ────────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    padding: 24,
    gap: 32,
  },

  listPane: {
    width: '100%',
  },

  rowWrapper: {
    borderRadius: 16,
    overflow: 'hidden', // fixes shadow radius
  },

  row: {
    padding: 20,
    backgroundColor: theme.colors.cardBackground,
    borderRadius: 16,
  },

  rowFocused: {
    transform: [{ scale: 1.06 }],
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 8,
    borderRadius: 16, // keep rounded
  },

  rowDimmed: {
    opacity: 0.4,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40, // spacing from screen edges
  },

  details: {
    width: SCREEN_WIDTH * 0.6, // 60% width
    maxHeight: SCREEN_HEIGHT * 0.7, // not full height
    padding: 32,
    borderRadius: 24,
    backgroundColor: theme.colors.cardBackground,
  },

  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'center', // center the buttons
    marginTop: 40,
    gap: 20,
  },

  buttonDestructive: {
    backgroundColor: theme.colors.danger,
  },
  input: {
    padding: 12,
    borderWidth: 1,
    borderRadius: 12,
    borderColor: '#666',
    marginTop: 16,
  },
});
