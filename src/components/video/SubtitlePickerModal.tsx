import React, { FC, memo, useMemo, useState, useCallback } from 'react';
import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import { Box, Text, Theme } from '@/theme/theme';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@shopify/restyle';

import { Focusable } from '@/components/basic/Focusable';
import { Modal } from '@/components/basic/Modal';
import { PickerInput } from '@/components/basic/PickerInput';
import { SubtitleSyncPanel } from '@/components/video/SubtitleSyncPanel';

import type { TextTrack } from '@/types/player';
import { useGroupOptions } from '@/hooks/useGroupOptions';
import { getFocusableBackgroundColor, getFocusableForegroundColor } from '@/utils/focus-colors';
import {
  normalizeLanguageCode,
  getPreferredLanguageCodes,
  getLanguageDisplayName,
} from '@/utils/languages';
import { buildSubtitleLabel } from '@/utils/subtitles';

export interface SubtitlePickerItem {
  label: string;
  value: number;
  groupId: string | null;
  tag?: string;
  track: TextTrack | null; // null for "None" option
}

export interface SubtitlePickerModalProps {
  visible: boolean;
  onClose: () => void;
  /** All available subtitle tracks */
  tracks: TextTrack[];
  /** Currently selected track (undefined = none) */
  selectedTrack?: TextTrack;
  /** Callback when track selection changes */
  onSelectTrack: (index?: number) => void;
  /** Preferred subtitle language codes for sorting */
  preferredLanguages?: string[];
  /** Current playback time in seconds */
  currentTime: number;
  /** Current subtitle delay in seconds */
  delay: number;
  /** Callback when delay changes */
  onDelayChange: (delay: number) => void;
}

interface SubtitleListItemProps {
  item: SubtitlePickerItem;
  isSelected: boolean;
  onPress: (value: number) => void;
}

/** Memoized list item */
const SubtitleListItem = memo<SubtitleListItemProps>(({ item, isSelected, onPress }) => (
  <Focusable onPress={() => onPress(item.value)} hasTVPreferredFocus={isSelected}>
    {({ isFocused }) => (
      <Box
        backgroundColor={getFocusableBackgroundColor({
          isActive: isSelected,
          isFocused,
          defaultColor: 'inputBackground',
        })}
        borderRadius="m"
        paddingHorizontal="m"
        paddingVertical="m"
        flexDirection="row"
        alignItems="center"
        justifyContent="space-between">
        <Text
          variant="body"
          color={getFocusableForegroundColor({
            isActive: isSelected,
            isFocused,
            defaultColor: 'mainForeground',
          })}
          fontSize={16}
          style={{ flex: 1 }}>
          {item.label}
        </Text>
        {item.tag && (
          <Box
            backgroundColor="focusBackground"
            borderRadius="s"
            paddingHorizontal="s"
            paddingVertical="xs"
            marginLeft="s">
            <Text variant="caption" color="textSecondary" fontSize={12}>
              {item.tag}
            </Text>
          </Box>
        )}
      </Box>
    )}
  </Focusable>
));

SubtitleListItem.displayName = 'SubtitleListItem';

/**
 * Two-panel modal for subtitle selection and syncing.
 * Left panel: Subtitle track selector with language filtering
 * Right panel: Sync controls (delay slider + cue preview) for addon subtitles only
 */
export const SubtitlePickerModal: FC<SubtitlePickerModalProps> = ({
  visible,
  onClose,
  tracks,
  selectedTrack,
  onSelectTrack,
  preferredLanguages,
  currentTime,
  delay,
  onDelayChange,
}) => {
  const theme = useTheme<Theme>();

  // Convert tracks to picker items
  const items = useMemo<SubtitlePickerItem[]>(() => {
    const result: SubtitlePickerItem[] = [{ label: 'None', value: -1, groupId: null, track: null }];

    for (const track of tracks) {
      result.push({
        label: buildSubtitleLabel(track),
        value: track.index,
        groupId: normalizeLanguageCode(track.language) ?? null,
        tag: track.source === 'addon' ? 'Addon' : 'Video',
        track,
      });
    }

    return result;
  }, [tracks]);

  const groups = useGroupOptions<number>({
    items: items.map((i) => ({ label: i.label, value: i.value, groupId: i.groupId })),
    getItemGroupId: (i) => i.groupId ?? null,
    getGroupLabel: getLanguageDisplayName,
    preferredGroupIds: getPreferredLanguageCodes(preferredLanguages),
  });

  // Initialize filter to the group of the selected item
  const initialGroupId = useMemo(() => {
    if (!selectedTrack) return null;
    return normalizeLanguageCode(selectedTrack.language) ?? null;
  }, [selectedTrack]);

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(initialGroupId);

  const filteredItems = useMemo(() => {
    if (!selectedGroupId) return items;
    return items.filter((i) => i.groupId === selectedGroupId || i.value === -1);
  }, [items, selectedGroupId]);

  // Find index of selected item for initial scroll position
  const selectedValue = selectedTrack?.index ?? -1;
  const initialScrollIndex = useMemo(() => {
    const idx = filteredItems.findIndex((i) => i.value === selectedValue);
    return idx >= 0 ? idx : undefined;
  }, [filteredItems, selectedValue]);

  const handleSelectTrack = useCallback(
    (value: number) => {
      onSelectTrack(value === -1 ? undefined : value);
      // Don't close modal - allow user to adjust sync
    },
    [onSelectTrack]
  );

  const renderItem: ListRenderItem<SubtitlePickerItem> = useCallback(
    ({ item }) => (
      <SubtitleListItem
        item={item}
        isSelected={item.value === selectedValue}
        onPress={handleSelectTrack}
      />
    ),
    [selectedValue, handleSelectTrack]
  );

  const keyExtractor = useCallback((item: SubtitlePickerItem) => item.value.toString(), []);

  return (
    <Modal visible={visible} onClose={onClose}>
      <Box
        backgroundColor="cardBackground"
        borderRadius="l"
        padding="l"
        flexDirection="row"
        gap="l"
        style={{
          minWidth: 600,
          maxWidth: 900,
          minHeight: 400,
          maxHeight: 600,
        }}>
        {/* Left Panel: Subtitle Selector */}
        <Box flex={1} gap="s">
          <Box flexDirection="row" alignItems="center" gap="s" marginBottom="s">
            <Ionicons name="text" size={24} color={theme.colors.mainForeground} />
            <Text variant="body" style={{ fontSize: 18, fontWeight: '600' }}>
              Select Subtitles
            </Text>
          </Box>

          {/* Language filters */}
          {groups.length > 1 && (
            <PickerInput
              icon="language"
              label="Language"
              selectedLabel={selectedGroupId ? getLanguageDisplayName(selectedGroupId) : 'All'}
              items={[
                { label: 'All', value: '' },
                ...groups.map((g) => ({ label: g.label, value: g.id })),
              ]}
              selectedValue={selectedGroupId ?? ''}
              onValueChange={(value: string) => setSelectedGroupId(value === '' ? null : value)}
            />
          )}

          {/* Subtitle list */}
          <Box flex={1}>
            <FlashList
              data={filteredItems}
              renderItem={renderItem}
              keyExtractor={keyExtractor}
              initialScrollIndex={initialScrollIndex}
              showsVerticalScrollIndicator={false}
            />
          </Box>
        </Box>

        {/* Divider */}
        <Box width={1} backgroundColor="cardBorder" />

        {/* Right Panel: Sync Controls */}
        <Box flex={1}>
          <SubtitleSyncPanel
            selectedTrack={selectedTrack}
            currentTime={currentTime}
            delay={delay}
            onDelayChange={onDelayChange}
          />
        </Box>
      </Box>
    </Modal>
  );
};

SubtitlePickerModal.displayName = 'SubtitlePickerModal';
