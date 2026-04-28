import { useAddonStore } from '@/store/addon.store';
import { useProfileStore } from '@/store/profile.store';
import { type AddonConfig } from '@/types/addon-config';
import type { Manifest } from '@/types/stremio';

export interface RouteResult {
  status: number;
  body?: unknown;
}

interface AddAddonRequestBody {
  manifestUrl: string;
}

interface PatchAddonConfigBody {
  isActive?: boolean;
  useCatalogsOnHome?: boolean;
  useCatalogsInSearch?: boolean;
  useForSubtitles?: boolean;
}

interface ReorderAddonsBody {
  orderedIds: string[];
}

function badRequest(message: string): RouteResult {
  return { status: 400, body: { error: message } };
}

export function getProfiles(): RouteResult {
  const { profiles } = useProfileStore.getState();
  const data = Object.values(profiles).map((profile) => ({
    id: profile.id,
    name: profile.name,
    color: profile.avatarColor,
  }));

  return { status: 200, body: data };
}

export function getProfileAddons(profileId: string): RouteResult {
  const { profiles } = useProfileStore.getState();
  if (!profiles[profileId]) {
    return { status: 404, body: { error: 'Profile not found' } };
  }

  const addonStore = useAddonStore.getState();
  const addons = addonStore.getOrderedAddonsList(profileId).map((addon) => ({
    id: addon.id,
    name: addon.manifest.name,
    version: addon.manifest.version,
    description: addon.manifest.description,
    configurable: addon.manifest.behaviorHints?.configurable ?? false,
    manifestUrl: addon.manifestUrl,
    config: addonStore.getAddonConfig(addon.id, profileId) ?? {
      isActive: false,
      useCatalogsOnHome: true,
      useCatalogsInSearch: true,
      useForSubtitles: true,
    },
  }));

  return { status: 200, body: addons };
}

export async function installAddon(input: unknown): Promise<RouteResult> {
  const body = input as AddAddonRequestBody;
  if (!body?.manifestUrl || typeof body.manifestUrl !== 'string') {
    return badRequest('manifestUrl is required');
  }

  let manifest: Manifest;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);
    const response = await fetch(body.manifestUrl, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));
    if (!response.ok) {
      return { status: 400, body: { error: `Failed to fetch manifest (${response.status})` } };
    }
    manifest = (await response.json()) as Manifest;
  } catch {
    return { status: 400, body: { error: 'Failed to fetch manifest' } };
  }

  if (!manifest?.id || !manifest?.name || !manifest?.version) {
    return badRequest('Invalid manifest: missing required fields');
  }

  useAddonStore.getState().addAddon(manifest.id, body.manifestUrl, manifest);
  return { status: 200, body: { id: manifest.id } };
}

export function deleteAddon(addonId: string): RouteResult {
  useAddonStore.getState().removeAddon(addonId);
  return { status: 204 };
}

export function patchProfileAddon(profileId: string, addonId: string, input: unknown): RouteResult {
  const { profiles } = useProfileStore.getState();
  if (!profiles[profileId]) {
    return { status: 404, body: { error: 'Profile not found' } };
  }

  const body = (input ?? {}) as PatchAddonConfigBody;
  const store = useAddonStore.getState();

  // Build the partial config from explicitly-provided boolean fields.
  const updates: Partial<AddonConfig> = {};
  if (typeof body.isActive === 'boolean') updates.isActive = body.isActive;
  if (typeof body.useCatalogsOnHome === 'boolean')
    updates.useCatalogsOnHome = body.useCatalogsOnHome;
  if (typeof body.useCatalogsInSearch === 'boolean')
    updates.useCatalogsInSearch = body.useCatalogsInSearch;
  if (typeof body.useForSubtitles === 'boolean') updates.useForSubtitles = body.useForSubtitles;

  if (Object.keys(updates).length === 0) {
    return { status: 200, body: { ok: true } };
  }

  // Deactivation requires an existing config entry.
  if (updates.isActive === false) {
    const currentConfig = store.getAddonConfig(addonId, profileId);
    if (!currentConfig) {
      return { status: 404, body: { error: 'Addon config not found' } };
    }
  }

  // setAddonConfig upserts the entry with inactive defaults when no config exists,
  store.setAddonConfig(addonId, updates, profileId);

  return { status: 200, body: { ok: true } };
}

export function reorderProfileAddons(profileId: string, input: unknown): RouteResult {
  const { profiles } = useProfileStore.getState();
  if (!profiles[profileId]) {
    return { status: 404, body: { error: 'Profile not found' } };
  }

  const body = input as ReorderAddonsBody;
  if (!Array.isArray(body?.orderedIds) || !body.orderedIds.every((id) => typeof id === 'string')) {
    return badRequest('orderedIds must be an array of strings');
  }

  const store = useAddonStore.getState();
  const currentIds = store.getOrderedAddonsList(profileId).map((addon) => addon.id);
  const workingOrder = [...currentIds];

  for (let targetIndex = 0; targetIndex < body.orderedIds.length; targetIndex += 1) {
    const addonId = decodeURIComponent(body.orderedIds[targetIndex]);
    const fromIndex = workingOrder.indexOf(addonId);
    if (fromIndex === -1) continue;
    if (fromIndex === targetIndex) continue;

    store.reorderAddon(fromIndex, targetIndex, profileId);

    workingOrder.splice(fromIndex, 1);
    workingOrder.splice(targetIndex, 0, addonId);
  }

  return { status: 200, body: { ok: true } };
}
