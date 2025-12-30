import { useQuery, useMutation, useQueryClient, useQueries } from '@tanstack/react-query';
import {
    fetchManifest,
    fetchCatalogWithPagination,
    fetchMeta,
    fetchStreams,
    fetchCatalog,
    fetchSubtitles,
} from './client';
import { useAddonStore } from '@/store/addon.store';
import { AddonSubtitle, ContentType, InstalledAddon, Stream } from '@/types/stremio';
import { useDebugLogger } from '@/utils/debug';
import { StremioApiError } from '@/api/errors';

// Normalize `stremio://` scheme to `https://`
const normalizeManifestUrl = (url: string): string => url.replace(/^stremio:\/\//i, 'https://');

const toStremioApiError = (error: unknown, endpoint: string): StremioApiError => {
    return error instanceof StremioApiError
        ? error
        : StremioApiError.fromError(error, endpoint, 'Request failed');
};

export const stremioKeys = {
    all: ['stremio'] as const,

    manifests: () => [...stremioKeys.all, 'manifests'] as const,
    manifest: (url: string) => [...stremioKeys.manifests(), url] as const,

    catalogs: () => [...stremioKeys.all, 'catalogs'] as const,
    catalog: (manifestUrl: string, type: string, id: string, skip?: number) =>
        [...stremioKeys.catalogs(), { manifestUrl, type, id, skip }] as const,

    metas: () => [...stremioKeys.all, 'metas'] as const,
    meta: (type: string, id: string) => [...stremioKeys.metas(), { type, id }] as const,

    streams: () => [...stremioKeys.all, 'streams'] as const,
    stream: (type: string, id: string) => [...stremioKeys.streams(), { type, id }] as const,

    subtitles: () => [...stremioKeys.all, 'subtitles'] as const,
    subtitle: (type: string, id: string, extra?: Record<string, string>) =>
        [...stremioKeys.subtitles(), { type, id, extra: extra ?? null }] as const,
};

/**
 * Hook to fetch and install an addon manifest
 */
export function useInstallAddon() {
    const queryClient = useQueryClient();
    const addAddon = useAddonStore((state) => state.addAddon);
    const debug = useDebugLogger('useInstallAddon');

    return useMutation({
        mutationFn: async (manifestUrl: string) => {
            const normalizedUrl = normalizeManifestUrl(manifestUrl);
            const manifest = await fetchManifest(normalizedUrl);
            return { manifestUrl: normalizedUrl, manifest };
        },
        onSuccess: ({ manifestUrl, manifest }) => {
            addAddon(manifest.id, manifestUrl, manifest);
            // Invalidate manifest query cache
            queryClient.invalidateQueries({ queryKey: stremioKeys.manifests() });
        },
        onError: (error) => {
            debug('failedToInstallAddon', { error });
        },
    });
}

/**
 * Hook to update an addon manifest
 */
export function useUpdateAddon() {
    const updateAddon = useAddonStore((state) => state.updateAddon);
    const debug = useDebugLogger('useUpdateAddon');

    return useMutation({
        mutationFn: async ({ id, manifestUrl }: { id: string; manifestUrl: string }) => {
            const manifest = await fetchManifest(manifestUrl);
            return { id, manifest };
        },
        onSuccess: ({ id, manifest }) => {
            updateAddon(id, manifest);
        },
        onError: (error) => {
            debug('failedToUpdateAddon', { error });
        },
    });
}

/**
 * Hook to fetch a catalog from an addon
 * @param manifestUrl - The addon's manifest URL
 * @param type - The content type (movie, series, etc.)
 * @param id - The catalog ID
 * @param skip - Number of items to skip (for pagination)
 * @param enabled - Whether to run the query
 */
export function useCatalog(
    manifestUrl: string,
    type: string,
    id: string,
    skip: number = 0,
    enabled: boolean = true
) {
    return useQuery({
        queryKey: stremioKeys.catalog(manifestUrl, type, id, skip),
        queryFn: () => fetchCatalogWithPagination(manifestUrl, type, id, skip),
        enabled: enabled && !!manifestUrl && !!type && !!id,
        staleTime: 1000 * 60 * 10, // 10 minutes (catalogs rarely change)
    });
}

/**
 * Hook to fetch multiple catalogs from an addon
 * Useful for displaying all catalogs from a single addon on the home screen
 */
export function useAddonCatalogs(
    manifestUrl: string,
    catalogs: { type: string; id: string }[],
    enabled: boolean = true
) {
    return useQueries({
        queries: catalogs.map(({ type, id }) => ({
            queryKey: stremioKeys.catalog(manifestUrl, type, id, 0),
            queryFn: () => fetchCatalogWithPagination(manifestUrl, type, id, 0),
            enabled: enabled && !!manifestUrl,
            staleTime: 1000 * 60 * 10, // 10 minutes
        })),
    });
}

/**
 * Hook to prefetch the next page of a catalog
 * Useful for implementing infinite scroll
 */
export function usePrefetchCatalog() {
    const queryClient = useQueryClient();

    return (manifestUrl: string, type: string, id: string, skip: number) => {
        queryClient.prefetchQuery({
            queryKey: stremioKeys.catalog(manifestUrl, type, id, skip),
            queryFn: () => fetchCatalogWithPagination(manifestUrl, type, id, skip),
            staleTime: 1000 * 60 * 10,
        });
    };
}

/**
 * Helper function to get all searchable catalogs from an addon
 * @param addon - The addon to check
 * @returns Array of searchable catalog info
 */
function getSearchableCatalogs(addon: InstalledAddon) {
    const { manifest } = addon;

    if (!manifest.catalogs || manifest.catalogs.length === 0) {
        return [];
    }

    return manifest.catalogs
        .filter((catalog) => {
            if (!catalog.extra) {
                return false;
            }
            return catalog.extra.some((extraItem) => extraItem.name === 'search');
        })
        .map((catalog) => ({
            manifestUrl: addon.manifestUrl,
            addonName: manifest.name,
            catalogType: catalog.type,
            catalogId: catalog.id,
            catalogName: catalog.name,
        }));
}

/**
 * Hook to search across all addons that support search
 * Returns grouped results by catalog instead of deduplicated flat list
 * @param query - The search query string
 * @param enabled - Whether to run the query
 */
export function useSearchCatalogs(query: string, enabled: boolean = true) {
    const getAddonsList = useAddonStore((state) => state.getAddonsList);
    const addons = getAddonsList();

    // Get all searchable catalogs from addons with useCatalogsInSearch enabled
    const searchableCatalogs = addons
        .filter((addon) => addon.useCatalogsInSearch)
        .flatMap(getSearchableCatalogs);

    // Use useQueries to search all catalogs in parallel
    const results = useQueries({
        queries: searchableCatalogs.map(({ manifestUrl, catalogType, catalogId, catalogName, addonName }) => ({
            queryKey: [...stremioKeys.catalog(manifestUrl, catalogType, catalogId, 0), { search: query }],
            queryFn: () => fetchCatalog(manifestUrl, catalogType, catalogId, { search: query }),
            enabled: enabled && query.length > 0,
            staleTime: 1000 * 60 * 15, // 15 minutes
            retry: 1,
            meta: { catalogName, addonName, manifestUrl, catalogType, catalogId },
        })),
    });

    // Group results by catalog
    const catalogResults = results
        .map((result, index) => {
            const catalog = searchableCatalogs[index];
            return {
                ...catalog,
                metas: result.isSuccess && result.data?.metas ? result.data.metas : [],
                isLoading: result.isLoading,
                isError: result.isError,
            };
        })
        .filter((result) => result.metas.length > 0); // Only include catalogs with results

    return {
        data: catalogResults,
        isLoading: results.some((result) => result.isLoading),
        isError: results.length > 0 && results.every((result) => result.isError),
        searchableCatalogs,
        allResults: results,
    };
}

/**
 * Helper function to check if an addon supports a given content type and ID
 * Based on idPrefixes and types in the manifest
 */
function addonSupportsContent(
    addon: InstalledAddon,
    type: ContentType,
    id: string
): boolean {
    const { manifest } = addon;

    // Check if addon supports this type
    if (!manifest.types.includes(type)) {
        return false;
    }

    // Check if addon has meta resource
    const hasMetaResource = manifest.resources.some((resource) => {
        if (typeof resource === 'string') {
            return resource === 'meta';
        }
        return resource.name === 'meta' && (!resource.types || resource.types.includes(type));
    });

    if (!hasMetaResource) {
        return false;
    }

    // Check idPrefixes if they exist
    if (manifest.idPrefixes && manifest.idPrefixes.length > 0) {
        return manifest.idPrefixes.some((prefix) => id.startsWith(prefix));
    }

    // If no idPrefixes specified, assume it supports all IDs for this type
    return true;
}

/**
 * Hook to fetch metadata from all compatible addons
 * Tries to fetch from all addons that support the given type and ID prefix
 * Returns the first successful response
 */
export function useMeta(type: ContentType, id: string, enabled: boolean = true) {
    const getAddonsList = useAddonStore((state) => state.getAddonsList);
    const addons = getAddonsList();

    // Find all addons that support this content
    const compatibleAddons = addons.filter((addon) =>
        addonSupportsContent(addon, type, id)
    );

    // Use useQueries to fetch from all compatible addons in parallel
    const results = useQueries({
        queries: compatibleAddons.map((addon) => ({
            queryKey: [...stremioKeys.meta(type, id), addon.manifestUrl],
            queryFn: () => fetchMeta(addon.manifestUrl, type, id),
            enabled: enabled && !!type && !!id,
            staleTime: 1000 * 60 * 60 * 24, // 24 hours (metadata rarely changes)
            gcTime: 1000 * 60 * 60 * 24 * 7, // 7 days
            retry: 1,
        })),
    });

    // Find the first successful result
    const successfulResult = results.find((result) => result.isSuccess && result.data);
    const rawError = results.find((result) => result.error)?.error as unknown;

    return {
        data: successfulResult?.data?.meta,
        isLoading: results.some((result) => result.isLoading),
        isError: results.length > 0 && results.every((result) => result.isError),
        error: rawError ? toStremioApiError(rawError, 'useMeta') : undefined,
        // Return all results for debugging
        allResults: results,
    };
}

/**
 * Hook to fetch streams from all compatible addons
 * Aggregates streams from all addons that support the given type and ID
 */
export function useStreams(type: ContentType, metaId: string, videoId?: string, enabled: boolean = true) {
    const id = videoId ?? metaId;
    const getAddonsList = useAddonStore((state) => state.getAddonsList);
    const addons = getAddonsList();

    // Find all addons that support this content and have stream resource
    const compatibleAddons = addons.filter((addon) => {
        const { manifest } = addon;

        // Check if addon supports this type
        if (!manifest.types.includes(type)) {
            return false;
        }

        // Check if addon has stream resource
        const hasStreamResource = manifest.resources.some((resource) => {
            if (typeof resource === 'string') {
                return resource === 'stream';
            }
            return resource.name === 'stream' && (!resource.types || resource.types.includes(type));
        });

        if (!hasStreamResource) {
            return false;
        }

        // Check idPrefixes if they exist
        if (manifest.idPrefixes && manifest.idPrefixes.length > 0) {
            return manifest.idPrefixes.some((prefix) => id.startsWith(prefix));
        }

        return true;
    });

    // Use useQueries to fetch from all compatible addons in parallel
    const results = useQueries({
        queries: compatibleAddons.map((addon) => ({
            queryKey: [...stremioKeys.stream(type, id), addon.manifestUrl],
            queryFn: () => fetchStreams(addon.manifestUrl, type, id),
            enabled: enabled && !!type && !!id,
            staleTime: 1000 * 60 * 15, // 15 minutes (streams can change)
            gcTime: 1000 * 60 * 30, // 30 minutes
            retry: 1,
            refetchOnMount: false
        })),
    });

    // Aggregate all streams from successful responses
    const allStreams: Stream[] = [];
    const addonNames: Map<string, string> = new Map();

    results.forEach((result, index) => {
        if (result.isSuccess && result.data?.streams) {
            const addon = compatibleAddons[index];
            result.data.streams.forEach((stream) => {
                allStreams.push({
                    ...stream,
                    addonId: addon.manifest.id,
                    addonName: addon.manifest.name,
                    addonManifestUrl: addon.manifestUrl,
                });
                // Track which addon provided this stream
                if (stream.name || stream.title) {
                    addonNames.set(stream.name || stream.title || '', addon.manifest.name);
                }
            });
        }
    });

    const rawError = results.find((result) => result.error)?.error as unknown;

    return {
        data: allStreams,
        addons: compatibleAddons.map((addon) => ({
            id: addon.manifest.id,
            name: addon.manifest.name,
            manifestUrl: addon.manifestUrl,
        })),
        addonNames,
        isLoading: results.some((result) => result.isLoading),
        isError: results.length > 0 && results.every((result) => result.isError),
        error: rawError ? toStremioApiError(rawError, 'useStreams') : undefined,
        // Return all results for debugging
        allResults: results,
    };
}

/**
 * Hook to fetch external subtitles from all compatible addons.
 *
 * Note: `extra` is optional. Some subtitle providers rely on `videoHash`/`videoSize`.
 */
export function useSubtitles(
    type: ContentType,
    metaId: string,
    videoId?: string,
    extra?: Record<string, string>,
    enabled: boolean = true
) {
    const id = videoId ?? metaId;
    const getAddonsList = useAddonStore((state) => state.getAddonsList);
    const addons = getAddonsList();

    const compatibleAddons = addons.filter((addon) => {
        const { manifest } = addon;

        if (!manifest.types.includes(type)) {
            return false;
        }

        const hasSubtitlesResource = manifest.resources.some((resource) => {
            if (typeof resource === 'string') {
                return resource === 'subtitles';
            }
            return resource.name === 'subtitles' && (!resource.types || resource.types.includes(type));
        });

        if (!hasSubtitlesResource) {
            return false;
        }

        if (manifest.idPrefixes && manifest.idPrefixes.length > 0) {
            return manifest.idPrefixes.some((prefix) => id.startsWith(prefix));
        }

        return true;
    });

    const results = useQueries({
        queries: compatibleAddons.map((addon) => ({
            queryKey: [...stremioKeys.subtitle(type, id, extra), addon.manifestUrl],
            queryFn: () => fetchSubtitles(addon.manifestUrl, type, id, extra),
            enabled: enabled && !!type && !!id,
            staleTime: 1000 * 60 * 60 * 24, // 24 hours
            gcTime: 1000 * 60 * 60 * 24 * 7, // 7 days
            retry: 1,
        })),
    });

    const allSubtitles: AddonSubtitle[] = [];

    results.forEach((result, index) => {
        if (result.isSuccess && result.data?.subtitles) {
            const addon = compatibleAddons[index];
            result.data.subtitles.forEach((subtitle) => {
                allSubtitles.push({
                    ...subtitle,
                    // Ensure IDs are stable+unique across addons
                    id: `${addon.manifest.id}:${subtitle.id}`,
                    addonId: addon.manifest.id,
                    addonName: addon.manifest.name,
                    addonManifestUrl: addon.manifestUrl,
                });
            });
        }
    });

    const rawError = results.find((result) => result.error)?.error as unknown;

    return {
        data: allSubtitles,
        isLoading: results.some((result) => result.isLoading),
        isError: results.length > 0 && results.every((result) => result.isError),
        error: rawError ? toStremioApiError(rawError, 'useSubtitles') : undefined,
        allResults: results,
    };
}
