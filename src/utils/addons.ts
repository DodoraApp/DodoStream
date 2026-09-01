import type { InstalledAddon } from '@/types/stremio';

/**
 * Sorts addons by the given per-profile order.
 *
 * Addons present in `order` come first, in the given order; addons missing
 * from it (installed before order tracking existed) go to the end, sorted by
 * id as a deterministic tiebreaker. Returns the input array untouched when
 * there is no order to apply.
 */
export const sortAddonsByOrder = (
  addons: InstalledAddon[],
  order: string[] | undefined
): InstalledAddon[] => {
  if (!order || order.length === 0) return addons;

  const orderMap = new Map(order.map((id, index) => [id, index]));
  return [...addons].sort((a, b) => {
    const aIndex = orderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const bIndex = orderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    return aIndex - bIndex || a.id.localeCompare(b.id);
  });
};
