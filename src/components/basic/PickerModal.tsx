import React, { useMemo, useState, useCallback, memo } from 'react';
import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import { Box, Text, Theme } from '@/theme/theme';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@shopify/restyle';
import { Focusable } from '@/components/basic/Focusable';
import { Modal } from '@/components/basic/Modal';
import { TagFilters } from '@/components/basic/TagFilters';
import { useGroupOptions } from '@/hooks/useGroupOptions';
import { getFocusableBackgroundColor, getFocusableForegroundColor } from '@/utils/focus-colors';

const getPickerListItemColors = ({
  tone,
  isSelected,
  isFocused,
}: {
  tone: PickerItem['tone'];
  isSelected: boolean;
  isFocused: boolean;
}): {
  backgroundColor: keyof Theme['colors'];
  foregroundColor: keyof Theme['colors'];
} => {
  const isDestructive = tone === 'destructive';
  const isActiveOrFocused = isSelected || isFocused;

  if (isDestructive) {
    return {
      backgroundColor: isActiveOrFocused ? 'danger' : 'inputBackground',
      foregroundColor: isActiveOrFocused ? 'mainForeground' : 'danger',
    };
  }

  return {
    backgroundColor: getFocusableBackgroundColor({
      isActive: isSelected,
      isFocused,
      defaultColor: 'inputBackground',
    }),
    foregroundColor: getFocusableForegroundColor({
      isActive: isSelected,
      isFocused,
      defaultColor: 'mainForeground',
    }),
  };
};

export interface PickerItem<T extends string | number = string | number> {
  label: string;
  value: T;
  groupId?: string | null; // optional grouping identifier (e.g., language code)
  tag?: string; // optional tag displayed as a badge (e.g., "Addon", "Video")
  icon?: keyof typeof Ionicons.glyphMap;
  tone?: 'default' | 'destructive';
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

interface PickerListItemProps {
  item: PickerItem<string | number>;
  isSelected: boolean;
  onPress: (value: string | number) => void;
}

/** Memoized list item to prevent re-renders during filter/scroll */
const PickerListItem = memo(({ item, isSelected, onPress }: PickerListItemProps) => {
  const theme = useTheme<Theme>();

  return (
    <Focusable onPress={() => onPress(item.value)} hasTVPreferredFocus={isSelected}>
      {({ isFocused }) => {
        const { backgroundColor, foregroundColor } = getPickerListItemColors({
          tone: item.tone,
          isSelected,
          isFocused,
        });

        return (
          <Box
            backgroundColor={backgroundColor}
            borderRadius="m"
            paddingHorizontal="m"
            paddingVertical="m"
            flexDirection="row"
            alignItems="center"
            justifyContent="space-between">
            <Box flexDirection="row" alignItems="center" gap="s" flex={1}>
              {item.icon && (
                <Box>
                  <Ionicons
                    name={item.icon}
                    size={theme.sizes.iconMedium}
                    color={theme.colors[foregroundColor]}
                  />
                </Box>
              )}
              <Text variant="body" color={foregroundColor} style={{ flex: 1 }}>
                {item.label}
              </Text>
            </Box>
            {item.tag && (
              <Box
                backgroundColor="focusBackground"
                borderRadius="s"
                paddingHorizontal="s"
                paddingVertical="xs"
                marginLeft="s">
                <Text variant="caption" color="textSecondary">
                  {item.tag}
                </Text>
              </Box>
            )}
          </Box>
        );
      }}
    </Focusable>
  );
});

PickerListItem.displayName = 'PickerListItem';

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
  const handleValueChange = useCallback(
    (value: T) => {
      onValueChange(value);
      onClose();
    },
    [onValueChange, onClose]
  );

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

  // Initialize filter to the group of the selected item
  const initialGroupId = useMemo(() => {
    if (selectedValue == null) return null;
    const selectedItem = items.find((i) => i.value === selectedValue);
    return selectedItem ? groupIdOf(selectedItem) : null;
  }, [items, selectedValue, groupIdOf]);

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(initialGroupId);

  const filteredItems = useMemo(() => {
    if (!selectedGroupId) return items;
    return items.filter((i) => groupIdOf(i) === selectedGroupId);
  }, [items, selectedGroupId, groupIdOf]);

  // Find index of selected item for initial scroll position
  const initialScrollIndex = useMemo(() => {
    if (selectedValue == null) return undefined;
    const idx = filteredItems.findIndex((i) => i.value === selectedValue);
    return idx >= 0 ? idx : undefined;
  }, [filteredItems, selectedValue]);

  const renderItem: ListRenderItem<PickerItem<T>> = useCallback(
    ({ item }) => (
      <PickerListItem
        item={item}
        isSelected={item.value === selectedValue}
        onPress={handleValueChange as (value: string | number) => void}
      />
    ),
    [selectedValue, handleValueChange]
  );

  const keyExtractor = useCallback((item: PickerItem<T>) => item.value?.toString() ?? '', []);

  return (
    <Modal visible={visible} onClose={onClose} label={label} icon={icon}>
      {groups.length > 0 && (
        <TagFilters
          options={groups}
          selectedId={selectedGroupId}
          onSelectId={setSelectedGroupId}
          includeAllOption
          allLabel="All"
        />
      )}
      <FlashList
        data={filteredItems}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        initialScrollIndex={initialScrollIndex}
        showsVerticalScrollIndicator={false}
      />
    </Modal>
  );
}
