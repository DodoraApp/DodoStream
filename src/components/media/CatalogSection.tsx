import { memo, useCallback } from 'react';
import { MediaList } from '@/components/media/MediaList';
import {
  SectionErrorPlaceholder,
  SectionEmptyPlaceholder,
  SectionLoadingPlaceholder,
} from '@/components/media/SectionPlaceholders';
import { MetaPreview } from '@/types/stremio';
import { useCatalog } from '@/api/stremio';

export interface StaticCatalogSectionProps {
  metas: MetaPreview[];
  onMediaPress: (media: MetaPreview) => void;
  hasTVPreferredFocus?: boolean;
  onSectionFocused?: () => void;
}

export const StaticCatalogSection = memo(
  ({
    metas,
    onMediaPress,
    hasTVPreferredFocus = false,
    onSectionFocused,
  }: StaticCatalogSectionProps) => {
    if (!metas || metas.length === 0) {
      return <SectionEmptyPlaceholder sectionType="media" />;
    }
    return (
      <MediaList
        data={metas}
        onMediaPress={onMediaPress}
        hasTVPreferredFocus={hasTVPreferredFocus}
        onItemFocused={onSectionFocused}
      />
    );
  }
);

StaticCatalogSection.displayName = 'StaticCatalogSection';

export interface CatalogSectionProps {
  manifestUrl: string;
  catalogType: string;
  catalogId: string;
  catalogName?: string;
  onMediaPress: (media: MetaPreview) => void;
  hasTVPreferredFocus?: boolean;
  onSectionFocused?: () => void;
}

export const CatalogSection = memo(
  ({
    manifestUrl,
    catalogType,
    catalogId,
    onMediaPress,
    hasTVPreferredFocus = false,
    onSectionFocused,
  }: CatalogSectionProps) => {
    const { data, isLoading, isError, refetch } = useCatalog(
      manifestUrl,
      catalogType,
      catalogId,
      0,
      true
    );

    const handleRetry = useCallback(() => {
      refetch();
    }, [refetch]);

    if (isLoading) {
      return <SectionLoadingPlaceholder sectionType="media" />;
    }

    if (isError) {
      return (
        <SectionErrorPlaceholder
          sectionType="media"
          onRetry={handleRetry}
          onFocused={onSectionFocused}
          hasTVPreferredFocus={hasTVPreferredFocus}
        />
      );
    }

    if (!data) {
      return <SectionEmptyPlaceholder sectionType="media" />;
    }

    return (
      <StaticCatalogSection
        metas={data.metas}
        onMediaPress={onMediaPress}
        hasTVPreferredFocus={hasTVPreferredFocus}
        onSectionFocused={onSectionFocused}
      />
    );
  }
);

CatalogSection.displayName = 'CatalogSection';
