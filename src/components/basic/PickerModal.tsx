import React, { useMemo, useState, useCallback } from 'react';
import { Modal, Pressable, StyleSheet, TVFocusGuideView } from 'react-native';
import { Box, Text, Theme } from '@/theme/theme';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@shopify/restyle';
import { ScrollView } from 'react-native-gesture-handler';
import { Focusable } from '@/components/basic/Focusable';
import { TagFilters } from '@/components/basic/TagFilters';
import { useGroupOptions } from '@/hooks/useGroupOptions';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getFocusableBackgroundColor, getFocusableForegroundColor } from '@/utils/focus-colors';

export interface PickerItem<T extends string | number = string | number> {
  label: string;
  value: T;
  groupId?: string | null; // optional grouping identifier (e.g., language code)
}

export interface PickerModalProps<T extends string | number = string | number> {
  visible: boolean;
  onClose: () => void;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  items: PickerItem<T>[];
  selectedValue?: T | null;
  onValueChange: (value: T) => void;
  // Optional grouping configuration
  getItemGroupId?: (item: PickerItem<T>) => string | null;
  getGroupLabel?: (groupId: string) => string;
  preferredGroupIds?: string[]; // bring these groups to the front
}

export function PickerModal<T extends string | number = string | number>({
  visible,
  onClose,
  label,
  icon,
  items,
  selectedValue,
  onValueChange,
  getItemGroupId,
  getGroupLabel,
  preferredGroupIds,
}: PickerModalProps<T>) {
  const theme = useTheme<Theme>();
  const insets = useSafeAreaInsets();

  const handleValueChange = (value: T) => {
    onValueChange(value);
    onClose();
  };

  const groupIdOf = useCallback(
    (item: PickerItem<T>) => {
      return getItemGroupId?.(item) ?? item.groupId ?? null;
    },
    [getItemGroupId]
  );

  const groups = useGroupOptions<T>({
    items,
    getItemGroupId: (i) => groupIdOf(i),
    getGroupLabel,
    preferredGroupIds,
  });

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  const filteredItems = useMemo(() => {
    if (!selectedGroupId) return items;
    return items.filter((i) => groupIdOf(i) === selectedGroupId);
  }, [items, selectedGroupId, groupIdOf]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={[
          StyleSheet.absoluteFillObject,
          {
            backgroundColor: theme.colors.overlayBackground,
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
            paddingLeft: insets.left,
            paddingRight: insets.right,
            justifyContent: 'center',
            alignItems: 'center',
          },
        ]}
        onPress={onClose}
        focusable={false}>
        <Box flex={1} justifyContent="center" alignItems="center" pointerEvents="box-none">
          <TVFocusGuideView
            autoFocus
            trapFocusUp
            trapFocusDown
            trapFocusLeft
            trapFocusRight
            style={{ alignItems: 'center', justifyContent: 'center' }}>
            <Pressable onPress={() => {}} focusable={false}>
              <Box
                backgroundColor="cardBackground"
                borderRadius="l"
                padding="l"
                style={{
                  minWidth: theme.sizes.modalMinWidth,
                  maxWidth: theme.sizes.modalMaxWidth,
                }}>
                <Box gap="xs">
                  {label && (
                    <Box flexDirection="row" alignItems="center" gap="s" marginBottom="s">
                      {icon && (
                        <Ionicons name={icon} size={24} color={theme.colors.mainForeground} />
                      )}
                      <Text variant="body" style={{ fontSize: 18, fontWeight: '600' }}>
                        {label}
                      </Text>
                    </Box>
                  )}
                  {groups.length > 0 && (
                    <TagFilters
                      options={groups}
                      selectedId={selectedGroupId}
                      onSelectId={setSelectedGroupId}
                      includeAllOption
                      allLabel="All"
                    />
                  )}
                  <ScrollView
                    contentContainerStyle={{ gap: 8 }}
                    showsVerticalScrollIndicator={false}>
                    {filteredItems.map((item, index) => {
                      const isSelected = item.value === selectedValue;
                      return (
                        <Focusable
                          key={item.value?.toString() || index}
                          onPress={() => handleValueChange(item.value)}
                          hasTVPreferredFocus={isSelected}>
                          {({ isFocused }) => (
                            <Box
                              backgroundColor={getFocusableBackgroundColor({
                                isActive: isSelected,
                                isFocused,
                                defaultColor: 'inputBackground',
                              })}
                              borderRadius="m"
                              paddingHorizontal="m"
                              paddingVertical="m">
                              <Text
                                variant="body"
                                color={getFocusableForegroundColor({
                                  isActive: isSelected,
                                  isFocused,
                                  defaultColor: 'mainForeground',
                                })}
                                fontSize={16}>
                                {item.label}
                              </Text>
                            </Box>
                          )}
                        </Focusable>
                      );
                    })}
                  </ScrollView>
                </Box>
              </Box>
            </Pressable>
          </TVFocusGuideView>
        </Box>
      </Pressable>
    </Modal>
  );
}
