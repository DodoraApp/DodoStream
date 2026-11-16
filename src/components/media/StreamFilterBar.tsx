import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { PickerInput } from '@/components/basic/PickerInput';
import type { PickerItem } from '@/components/basic/PickerModal';
import { Box } from '@/theme/theme';
import {
  STREAM_MAX_SIZE_OPTIONS_GB,
  type StreamFilters,
  type StreamResolution,
} from '@/utils/stream-filters';

const ANY_RESOLUTION = 'any';
const ANY_SIZE = 0;

type ResolutionValue = StreamResolution | typeof ANY_RESOLUTION;

export interface StreamFilterBarProps {
  filters: StreamFilters;
  /** Resolutions that occur among the streams. */
  availableResolutions: StreamResolution[];
  onChange: (filters: StreamFilters) => void;
}

/** Filters the stream list by resolution and by maximum file size. */
export const StreamFilterBar = memo(
  ({ filters, availableResolutions, onChange }: StreamFilterBarProps) => {
    const { t } = useTranslation('media');

    const resolutionItems = useMemo<PickerItem<ResolutionValue>[]>(() => {
      // Keep the active filter selectable even when no current stream matches it.
      const resolutions =
        filters.resolution && !availableResolutions.includes(filters.resolution)
          ? [filters.resolution, ...availableResolutions]
          : availableResolutions;
      return [
        { label: t('stream_filter_any'), value: ANY_RESOLUTION },
        ...resolutions.map((resolution) => ({ label: resolution, value: resolution })),
      ];
    }, [availableResolutions, filters.resolution, t]);

    const sizeItems = useMemo<PickerItem<number>[]>(
      () => [
        { label: t('stream_filter_any'), value: ANY_SIZE },
        ...STREAM_MAX_SIZE_OPTIONS_GB.map((size) => ({
          label: t('stream_filter_max_size', { size }),
          value: size,
        })),
      ],
      [t]
    );

    const handleResolutionChange = useCallback(
      (value: ResolutionValue) => {
        onChange({ ...filters, resolution: value === ANY_RESOLUTION ? null : value });
      },
      [filters, onChange]
    );

    const handleSizeChange = useCallback(
      (value: number) => {
        onChange({ ...filters, maxSizeGb: value === ANY_SIZE ? null : value });
      },
      [filters, onChange]
    );

    return (
      <Box flexDirection="row" flexWrap="wrap" gap="s" testID="stream-filter-bar">
        <PickerInput
          label={t('stream_filter_resolution')}
          icon="tv-outline"
          items={resolutionItems}
          selectedValue={filters.resolution ?? ANY_RESOLUTION}
          selectedLabel={t('stream_filter_resolution_value', {
            value: filters.resolution ?? t('stream_filter_any'),
          })}
          onValueChange={handleResolutionChange}
          testID="stream-filter-resolution"
        />
        <PickerInput
          label={t('stream_filter_size')}
          icon="server-outline"
          items={sizeItems}
          selectedValue={filters.maxSizeGb ?? ANY_SIZE}
          selectedLabel={t('stream_filter_size_value', {
            value:
              filters.maxSizeGb === null
                ? t('stream_filter_any')
                : t('stream_filter_max_size', { size: filters.maxSizeGb }),
          })}
          onValueChange={handleSizeChange}
          testID="stream-filter-size"
        />
      </Box>
    );
  }
);

StreamFilterBar.displayName = 'StreamFilterBar';
