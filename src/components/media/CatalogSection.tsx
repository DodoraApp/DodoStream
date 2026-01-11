import { memo } from 'react';
import { MediaList } from '@/components/media/MediaList';
import { MediaListSkeleton } from '@/components/media/MediaListSkeleton';
import { MetaPreview } from '@/types/stremio';
import { useCatalog } from '@/api/stremio';

export interface StaticCatalogSectionProps {
  metas: MetaPreview[];
  onMediaPress: (media: MetaPreview) => void;
  hasTVPreferredFocus?: boolean;
  sectionKey?: string;
  onSectionFocused?: (sectionKey: string) => void;
}

export const StaticCatalogSection = memo(
  ({
    metas,
    onMediaPress,
    hasTVPreferredFocus = false,
    sectionKey,
    onSectionFocused,
  }: StaticCatalogSectionProps) => {
    if (!metas || metas.length === 0) return null;
    return (
      <MediaList
        data={metas}
        onMediaPress={onMediaPress}
        hasTVPreferredFocus={hasTVPreferredFocus}
        onItemFocused={
          sectionKey && onSectionFocused ? () => onSectionFocused(sectionKey) : undefined
        }
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
  sectionKey?: string;
  onSectionFocused?: (sectionKey: string) => void;
}

export const CatalogSection = memo(
  ({
    manifestUrl,
    catalogType,
    catalogId,
    onMediaPress,
    hasTVPreferredFocus = false,
    sectionKey,
    onSectionFocused,
  }: CatalogSectionProps) => {
    const { data, isLoading, isError } = useCatalog(manifestUrl, catalogType, catalogId, 0, true);

    if (isLoading) {
      return <MediaListSkeleton />;
    }

    if (isError || !data || !data.metas) {
      return null;
    }

    return (
      <StaticCatalogSection
        metas={data.metas}
        onMediaPress={onMediaPress}
        hasTVPreferredFocus={hasTVPreferredFocus}
        onSectionFocused={onSectionFocused}
        sectionKey={sectionKey}
      />
    );
  }
);

CatalogSection.displayName = 'CatalogSection';
