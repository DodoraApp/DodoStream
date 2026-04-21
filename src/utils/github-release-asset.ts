import type { GithubReleaseAsset } from '@/api/github/types';

/** Canonical ABI names in descending preference order. */
const ABI_PRIORITY = ['arm64-v8a', 'armeabi-v7a', 'x86_64', 'x86'] as const;
type KnownAbi = (typeof ABI_PRIORITY)[number];

/**
 * Returns the build variant slug embedded in the APK filename.
 * TV builds use "production_tv"; mobile builds use "production".
 */
export function getVariantSlug(isTV: boolean): string {
  return isTV ? 'production_tv' : 'production';
}

/**
 * Returns the ordered list of ABIs to try, filtered to known values.
 * Falls back to the full ABI_PRIORITY list when supportedAbis is null/empty.
 */
export function getAbiPriority(supportedAbis: string[] | null): string[] {
  if (!supportedAbis || supportedAbis.length === 0) return [...ABI_PRIORITY];
  const filtered = supportedAbis.filter((abi): abi is KnownAbi =>
    (ABI_PRIORITY as readonly string[]).includes(abi)
  );
  return filtered.length > 0 ? filtered : [...ABI_PRIORITY];
}

/**
 * Finds the best-matching APK asset for the given version, platform variant,
 * and CPU architecture list.
 *
 * Filename pattern: DodoStream-{version}-{variant}-{abi}.apk
 *
 * Returns the first asset whose filename matches the highest-priority ABI,
 * or null if no match is found.
 */
export function findMatchingAsset(
  assets: GithubReleaseAsset[],
  version: string,
  isTV: boolean,
  supportedAbis: string[] | null
): GithubReleaseAsset | null {
  if (assets.length === 0) return null;

  const variant = getVariantSlug(isTV);
  const abiOrder = getAbiPriority(supportedAbis);

  for (const abi of abiOrder) {
    const expectedName = `DodoStream-${version}-${variant}-${abi}.apk`;
    const match = assets.find((a) => a.name === expectedName);
    if (match) return match;
  }

  return null;
}
