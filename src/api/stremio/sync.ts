import { StremioApiError } from '@/api/errors';
import { fetchManifest } from '@/api/stremio/client';
import { Manifest } from '@/types/stremio';
import { createDebugLogger } from '@/utils/debug';

const debug = createDebugLogger('StremioSync');

const STREMIO_API_ENDPOINT = 'https://api.strem.io';

/** Known official Stremio addon transport URL patterns to skip during sync */
const OFFICIAL_ADDON_PATTERNS = [
    'v3-cinemeta.strem.io',
    'v3-channels.strem.io',
    'watchhub.strem.io',
    'opensubtitles',
    'opensubtitlesv3',
    'caching.stremio.net',
    'api.strem.io',
];

/** Addon descriptor as returned by the Stremio API */
export interface StremioAddonDescriptor {
    transportUrl: string;
    manifest?: {
        id: string;
        name: string;
        version: string;
        [key: string]: unknown;
    };
    flags?: Record<string, unknown>;
}

/** Result of Stremio login */
export interface StremioLoginResult {
    authKey: string;
    email: string;
}

/** Result of syncing addons from Stremio */
export interface StremioSyncResult {
    total: number;
    installed: number;
    skipped: number;
    failed: number;
    alreadyInstalled: number;
    details: StremioSyncAddonDetail[];
}

export interface StremioSyncAddonDetail {
    name: string;
    transportUrl: string;
    status: 'installed' | 'skipped' | 'failed' | 'already_installed';
    reason?: string;
}

/**
 * Makes a request to the Stremio API
 */
async function stremioApiRequest<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const response = await fetch(`${STREMIO_API_ENDPOINT}/api/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
    });

    if (!response.ok) {
        throw new StremioApiError(
            `Stremio API request failed: ${response.status} ${response.statusText}`,
            response.status,
            `${STREMIO_API_ENDPOINT}/api/${method}`
        );
    }

    const body = await response.json();

    if (body.error) {
        const message = typeof body.error === 'string' ? body.error : body.error.message ?? 'Unknown error';
        throw new StremioApiError(message, undefined, `${STREMIO_API_ENDPOINT}/api/${method}`);
    }

    if (!body.result) {
        throw new StremioApiError('Response has no result', undefined, `${STREMIO_API_ENDPOINT}/api/${method}`);
    }

    return body.result as T;
}

/**
 * Logs in to Stremio with email and password.
 * Returns the authKey and user email.
 */
export async function stremioLogin(email: string, password: string): Promise<StremioLoginResult> {
    debug('login', { email });

    const result = await stremioApiRequest<{ authKey: string; user: { email: string } }>('login', {
        email,
        password,
    });

    if (!result.authKey) {
        throw new StremioApiError('Login succeeded but no authKey returned', undefined, 'login');
    }

    debug('loginSuccess', { email: result.user?.email });
    return { authKey: result.authKey, email: result.user?.email ?? email };
}

/**
 * Fetches the addon collection for an authenticated Stremio user.
 */
export async function stremioGetAddons(authKey: string): Promise<StremioAddonDescriptor[]> {
    debug('getAddons');

    const result = await stremioApiRequest<{ addons: StremioAddonDescriptor[] }>('addonCollectionGet', {
        authKey,
        update: true,
    });

    if (!Array.isArray(result.addons)) {
        throw new StremioApiError('No addons array in response', undefined, 'addonCollectionGet');
    }

    debug('getAddonsSuccess', { count: result.addons.length });
    return result.addons;
}

/**
 * Checks whether a transport URL belongs to an official/built-in Stremio addon.
 */
function isOfficialAddon(transportUrl: string): boolean {
    const lower = transportUrl.toLowerCase();
    return OFFICIAL_ADDON_PATTERNS.some((pattern) => lower.includes(pattern));
}

/**
 * Ensures a transport URL ends with /manifest.json
 */
function normalizeTransportUrl(transportUrl: string): string {
    let url = transportUrl.replace(/^stremio:\/\//i, 'https://');
    if (!url.endsWith('/manifest.json')) {
        url = url.replace(/\/?$/, '/manifest.json');
    }
    return url;
}

/**
 * Syncs addons from a Stremio account into the DodoStream addon store.
 * Logs in, fetches the addon collection, and installs non-official addons.
 *
 * @param email - Stremio account email
 * @param password - Stremio account password
 * @param addAddon - Function to add an addon to the store
 * @param hasAddon - Function to check if an addon is already installed
 * @param onProgress - Optional callback for progress updates
 */
export async function syncFromStremio(
    email: string,
    password: string,
    addAddon: (id: string, manifestUrl: string, manifest: Manifest) => void,
    hasAddon: (id: string) => boolean,
    onProgress?: (current: number, total: number) => void,
): Promise<StremioSyncResult> {
    // Step 1: Login
    const { authKey } = await stremioLogin(email, password);

    // Step 2: Fetch addons
    const allAddons = await stremioGetAddons(authKey);

    // Step 3: Filter to third-party addons only
    const thirdPartyAddons = allAddons.filter((addon) => !isOfficialAddon(addon.transportUrl));

    debug('syncStart', { totalAddons: allAddons.length, thirdParty: thirdPartyAddons.length });

    const result: StremioSyncResult = {
        total: thirdPartyAddons.length,
        installed: 0,
        skipped: 0,
        failed: 0,
        alreadyInstalled: 0,
        details: [],
    };

    // Step 4: Install each third-party addon
    for (let i = 0; i < thirdPartyAddons.length; i++) {
        const addon = thirdPartyAddons[i];
        const manifestUrl = normalizeTransportUrl(addon.transportUrl);
        const addonName = addon.manifest?.name ?? manifestUrl;

        onProgress?.(i + 1, thirdPartyAddons.length);

        try {
            // Fetch manifest to get the full manifest object and validate
            const manifest = await fetchManifest(manifestUrl);

            // Check if already installed
            if (hasAddon(manifest.id)) {
                result.alreadyInstalled++;
                result.details.push({
                    name: manifest.name ?? addonName,
                    transportUrl: manifestUrl,
                    status: 'already_installed',
                });
                continue;
            }

            // Install
            addAddon(manifest.id, manifestUrl, manifest);
            result.installed++;
            result.details.push({
                name: manifest.name ?? addonName,
                transportUrl: manifestUrl,
                status: 'installed',
            });

            debug('addonInstalled', { id: manifest.id, name: manifest.name });
        } catch (error) {
            result.failed++;
            result.details.push({
                name: addonName,
                transportUrl: manifestUrl,
                status: 'failed',
                reason: error instanceof Error ? error.message : 'Unknown error',
            });
            debug('addonInstallFailed', { transportUrl: manifestUrl, error });
        }
    }

    debug('syncComplete', {
        installed: result.installed,
        skipped: result.skipped,
        failed: result.failed,
        alreadyInstalled: result.alreadyInstalled,
    });

    return result;
}
