import React, { memo, useCallback } from 'react';
import { useTheme } from '@shopify/restyle';
import { Ionicons } from '@expo/vector-icons';
import { Box, Text, Theme } from '@/theme/theme';
import { moveItem } from '@/utils/array';
import { Focusable } from '@/components/basic/Focusable';
import { Button } from '@/components/basic/Button';
import { getFocusableBackgroundColor, getFocusableForegroundColor } from '@/utils/focus-colors';

export interface OrderableItem {
  /** Unique identifier for the item */
  id: string;
  /** Display label */
  label: string;
  /** Optional secondary label or description */
  secondaryLabel?: string;
}

interface OrderableListSectionProps<T extends OrderableItem> {
  /** Items currently selected (in order) */
  selectedItems: T[];
  /** Items available to add */
  availableItems: T[];
  /** Called when the selection changes */
  onChange: (next: T[]) => void;
  /** Label for the selected section */
  selectedLabel?: string;
  /** Label for the available section */
  availableLabel?: string;
  /** Placeholder text when no items are selected */
  emptyPlaceholder?: string;
  /** Get unique key for item */
  getItemKey?: (item: T) => string;
}

/**
 * Reusable orderable list section for selecting and ordering items inline.
 * Used for language preferences, catalog sources, etc.
 */
function OrderableListSectionImpl<T extends OrderableItem>({
  selectedItems,
  availableItems,
  onChange,
  selectedLabel = 'Selected (in order)',
  availableLabel = 'Add item',
  emptyPlaceholder = 'None selected',
  getItemKey,
}: OrderableListSectionProps<T>) {
  const keyFn = useCallback((item: T) => (getItemKey ? getItemKey(item) : item.id), [getItemKey]);

  const handleMoveUp = useCallback(
    (index: number) => {
      if (index > 0) {
        onChange(moveItem(selectedItems, index, index - 1));
      }
    },
    [selectedItems, onChange]
  );

  const handleMoveDown = useCallback(
    (index: number) => {
      if (index < selectedItems.length - 1) {
        onChange(moveItem(selectedItems, index, index + 1));
      }
    },
    [selectedItems, onChange]
  );

  const handleRemove = useCallback(
    (item: T) => {
      onChange(selectedItems.filter((s) => keyFn(s) !== keyFn(item)));
    },
    [selectedItems, onChange, keyFn]
  );

  const handleAdd = useCallback(
    (item: T) => {
      onChange([...selectedItems, item]);
    },
    [selectedItems, onChange]
  );

  return (
    <Box gap="m">
      {/* Selected items section */}
      <Box gap="s">
        <Text variant="caption" color="textPrimary">
          {selectedLabel}
        </Text>

        {selectedItems.length === 0 ? (
          <Text variant="body" color="textSecondary">
            {emptyPlaceholder}
          </Text>
        ) : (
          <Box gap="s">
            {selectedItems.map((item, index) => (
              <SelectedRow
                key={keyFn(item)}
                item={item}
                index={index}
                total={selectedItems.length}
                onMoveUp={() => handleMoveUp(index)}
                onMoveDown={() => handleMoveDown(index)}
                onRemove={() => handleRemove(item)}
              />
            ))}
          </Box>
        )}
      </Box>

      {/* Available items section */}
      {availableItems.length > 0 && (
        <Box gap="s">
          <Text variant="caption" color="textPrimary">
            {availableLabel}
          </Text>

          <Box gap="s">
            {availableItems.map((item) => (
              <AddRow key={keyFn(item)} item={item} onAdd={() => handleAdd(item)} />
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
}

export const OrderableListSection = memo(
  OrderableListSectionImpl
) as typeof OrderableListSectionImpl;

interface SelectedRowProps<T extends OrderableItem> {
  item: T;
  index: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}

function SelectedRowImpl<T extends OrderableItem>({
  item,
  index,
  total,
  onMoveUp,
  onMoveDown,
  onRemove,
}: SelectedRowProps<T>) {
  const theme = useTheme<Theme>();
  const [isFocused, setIsFocused] = React.useState(false);

  return (
    <Box
      flexDirection="row"
      alignItems="center"
      justifyContent="space-between"
      paddingHorizontal="m"
      paddingVertical="s"
      borderRadius="m"
      backgroundColor="inputBackground"
      style={{
        borderWidth: theme.focus.borderWidthSmall,
        borderColor: isFocused ? theme.colors.primaryBackground : theme.colors.transparent,
      }}>
      <Box flex={1} gap="xs">
        <Text variant="body" numberOfLines={1}>
          {item.label}
        </Text>
        {item.secondaryLabel && (
          <Text variant="caption" color="textSecondary" numberOfLines={1}>
            {item.secondaryLabel}
          </Text>
        )}
      </Box>

      <Box flexDirection="row" alignItems="center" gap="s">
        <Button
          icon="chevron-up"
          disabled={index === 0}
          onPress={onMoveUp}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
        <Button
          icon="chevron-down"
          disabled={index === total - 1}
          onPress={onMoveDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
        <Button
          icon="trash"
          onPress={onRemove}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
      </Box>
    </Box>
  );
}

const SelectedRow = memo(SelectedRowImpl) as typeof SelectedRowImpl;

interface AddRowProps<T extends OrderableItem> {
  item: T;
  onAdd: () => void;
}

function AddRowImpl<T extends OrderableItem>({ item, onAdd }: AddRowProps<T>) {
  const theme = useTheme<Theme>();

  return (
    <Focusable onPress={onAdd}>
      {({ isFocused }) => (
        <Box
          flexDirection="row"
          alignItems="center"
          justifyContent="space-between"
          paddingHorizontal="m"
          paddingVertical="s"
          borderRadius="m"
          backgroundColor={getFocusableBackgroundColor({
            isFocused,
            defaultColor: 'inputBackground',
          })}
          style={{
            borderWidth: theme.focus.borderWidthSmall,
            borderColor: isFocused ? theme.colors.primaryBackground : theme.colors.transparent,
          }}>
          <Box flex={1} gap="xs">
            <Text
              variant="body"
              numberOfLines={1}
              color={getFocusableForegroundColor({ isFocused, defaultColor: 'textPrimary' })}>
              {item.label}
            </Text>
            {item.secondaryLabel && (
              <Text variant="caption" color="textSecondary" numberOfLines={1}>
                {item.secondaryLabel}
              </Text>
            )}
          </Box>
          <Ionicons
            name="add"
            size={20}
            color={isFocused ? theme.colors.focusForeground : theme.colors.textSecondary}
          />
        </Box>
      )}
    </Focusable>
  );
}

const AddRow = memo(AddRowImpl) as typeof AddRowImpl;
