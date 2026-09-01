import type { InstalledAddon } from '@/types/stremio';

import { sortAddonsByOrder } from '../addons';

describe('sortAddonsByOrder', () => {
  const createAddon = (id: string): InstalledAddon => ({
    id,
    manifestUrl: `https://example.com/${id}/manifest.json`,
    manifest: { id, name: id } as InstalledAddon['manifest'],
    installedAt: 0,
  });

  it('returns the input unchanged when no order is given', () => {
    const addons = [createAddon('z'), createAddon('a')];

    expect(sortAddonsByOrder(addons, undefined)).toBe(addons);
    expect(sortAddonsByOrder(addons, [])).toBe(addons);
  });

  it('orders addons by the given order', () => {
    const addons = [createAddon('a'), createAddon('b'), createAddon('c')];

    const result = sortAddonsByOrder(addons, ['c', 'a', 'b']);

    expect(result.map((a) => a.id)).toEqual(['c', 'a', 'b']);
  });

  it('puts addons missing from the order last, sorted by id', () => {
    const addons = [createAddon('a'), createAddon('z'), createAddon('m'), createAddon('b')];

    const result = sortAddonsByOrder(addons, ['b']);

    expect(result.map((a) => a.id)).toEqual(['b', 'a', 'm', 'z']);
  });

  it('does not mutate the input array', () => {
    const addons = [createAddon('a'), createAddon('b')];
    const snapshot = [...addons];

    sortAddonsByOrder(addons, ['b', 'a']);

    expect(addons).toEqual(snapshot);
  });
});
