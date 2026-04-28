import type {
  ContentType,
  Manifest,
  ManifestCatalog,
  MetaDetail as SDKMetaDetail,
  MetaLink,
  MetaPreview as SDKMetaPreview,
  MetaVideo as SDKMetaVideo,
  Stream as SDKStream,
  Subtitle,
} from '@types/stremio-addon-sdk';

export interface MetaPreview extends SDKMetaPreview {
  genres?: string[];
}

export interface MetaVideo extends SDKMetaVideo {
  name?: string;
}

export interface CastMember {
  name: string;
  character?: string;
  photo?: string;
}

export interface MetaDetail extends SDKMetaDetail {
  /** Series airing status, e.g. "Ended", "Continuing" */
  status?: string;
  /** YouTube trailer streams provided by metadata addons */
  trailerStreams?: { title: string; ytId: string; lang?: string }[];
  /** Landscape backdrop poster URL */
  landscapePoster?: string;
  /** Extended metadata provided by compatible addons */
  app_extras?: {
    cast?: CastMember[];
    directors?: CastMember[];
    writers?: CastMember[];
    /** Age/content rating, e.g. "TV-14", "PG" */
    certification?: string;
    seasonPosters?: string[];
  };
}

export interface MetaResponse {
  meta: MetaDetail;
}

export interface CatalogResponse {
  metas: MetaPreview[];
}

export interface StreamResponse {
  streams: Stream[];
}

export interface SubtitlesResponse {
  subtitles: Subtitle[];
}

export interface AddonSubtitle extends Subtitle {
  addonId?: string;
  addonName?: string;
  addonManifestUrl?: string;
}

export interface Stream extends SDKStream {
  description?: string;
  addonId?: string;
  addonName?: string;
  addonManifestUrl?: string;
}

/**
 * Internal app types for addon management
 */
export interface InstalledAddon {
  id: string;
  manifestUrl: string;
  manifest: Manifest;
  installedAt: number;
}

export { ContentType, Manifest, ManifestCatalog, MetaLink, Subtitle };
