import { memo } from 'react';
import { ScrollView } from 'react-native';
import { Box } from '@/theme/theme';
import { Tag } from '@/components/basic/Tag';
import { LoadingIndicator } from '@/components/basic/LoadingIndicator';

export interface TagOption {
  id: string;
  label: string;
  isLoading?: boolean;
  disabled?: boolean;
}

interface TagFiltersProps {
  options: TagOption[];
  selectedId: string | null;
  onSelectId: (id: string | null) => void;
  includeAllOption?: boolean;
  allLabel?: string;
}

const TagFiltersItem = memo(
  ({
    id,
    label,
    isLoading,
    disabled,
    selected,
    hasTVPreferredFocus,
    onPress,
  }: {
    id: string | null;
    label: string;
    isLoading?: boolean;
    disabled?: boolean;
    selected: boolean;
    hasTVPreferredFocus?: boolean;
    onPress: (id: string | null) => void;
  }) => {
    return (
      <Tag
        label={label}
        selected={selected}
        focusable={true}
        disabled={disabled ?? false}
        hasTVPreferredFocus={hasTVPreferredFocus}
        rightElement={
          id === null || !isLoading ? null : <LoadingIndicator type="simple" size="small" />
        }
        onPress={() => onPress(id)}
      />
    );
  }
);

export const TagFilters = memo(
  ({
    options,
    selectedId,
    onSelectId,
    includeAllOption = true,
    allLabel = 'All',
  }: TagFiltersProps) => {
    const allSelected = selectedId === null;

    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Box flexDirection="row" gap="s">
          {includeAllOption ? (
            <TagFiltersItem
              id={null}
              label={allLabel}
              selected={allSelected}
              hasTVPreferredFocus={true}
              onPress={onSelectId}
            />
          ) : null}
          {options.map((o) => (
            <TagFiltersItem
              key={o.id}
              id={o.id}
              label={o.label}
              isLoading={o.isLoading}
              disabled={o.disabled}
              selected={selectedId === o.id}
              onPress={onSelectId}
            />
          ))}
        </Box>
      </ScrollView>
    );
  }
);
