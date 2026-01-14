import type {
    MetaPreview as SDKMetaPreview,
    MetaDetail,
    MetaLink,
    MetaVideo as SDKMetaVideo,
    Manifest,
    ManifestCatalog,
    Stream as SDKStream,
    Subtitle,
    ContentType
} from '@types/stremio-addon-sdk';

export interface MetaPreview extends SDKMetaPreview {
    genres?: string[];
}

export interface MetaVideo extends SDKMetaVideo {
    name?: string;
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
    useCatalogsOnHome: boolean;
    useCatalogsInSearch: boolean;
    useForSubtitles: boolean;
}

export { MetaLink, MetaVideo, Manifest, ManifestCatalog, Subtitle, ContentType, MetaDetail };
