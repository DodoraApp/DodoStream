import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';

import { LoadingIndicator } from '@/components/basic/LoadingIndicator';
import { Tag } from '@/components/basic/Tag';
import { Box } from '@/theme/theme';

export interface TagOption {
  id: string;
  label: string;
  isLoading?: boolean;
  disabled?: boolean;
}

type TagSize = 'default' | 'large';

interface TagFiltersProps {
  options: TagOption[];
  selectedId: string | null;
  onSelectId: (id: string | null) => void;
  includeAllOption?: boolean;
  allLabel?: string;
  /** Size variant for tags: 'default' or 'large' */
  size?: TagSize;
}

const TagFiltersItem = memo(
  ({
    id,
    label,
    isLoading,
    disabled,
    selected,
    hasTVPreferredFocus,
    size,
    onPress,
  }: {
    id: string | null;
    label: string;
    isLoading?: boolean;
    disabled?: boolean;
    selected: boolean;
    hasTVPreferredFocus?: boolean;
    size?: TagSize;
    onPress: (id: string | null) => void;
  }) => {
    return (
      <Tag
        label={label}
        selected={selected}
        focusable={true}
        disabled={disabled ?? false}
        hasTVPreferredFocus={hasTVPreferredFocus}
        size={size}
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
    allLabel,
    size = 'default',
  }: TagFiltersProps) => {
    const { t } = useTranslation('media');
    const effectiveAllLabel = allLabel || t('all');
    const allSelected = selectedId === null;

    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
        <Box flexDirection="row" gap="s" alignItems="flex-start">
          {includeAllOption ? (
            <TagFiltersItem
              id={null}
              label={effectiveAllLabel}
              selected={allSelected}
              hasTVPreferredFocus={true}
              size={size}
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
              size={size}
              onPress={onSelectId}
            />
          ))}
        </Box>
      </ScrollView>
    );
  }
);
