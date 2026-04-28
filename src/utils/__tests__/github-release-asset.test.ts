import type { GithubReleaseAsset } from '@/api/github/types';

import { findMatchingAsset, getAbiPriority, getVariantSlug } from '../github-release-asset';

const makeAsset = (name: string): GithubReleaseAsset => ({
  name,
  browserDownloadUrl: `https://example.com/${name}`,
});

const MOBILE_ASSETS: GithubReleaseAsset[] = [
  makeAsset('DodoStream-0.9.0-production-arm64-v8a.apk'),
  makeAsset('DodoStream-0.9.0-production-armeabi-v7a.apk'),
  makeAsset('DodoStream-0.9.0-production-x86.apk'),
  makeAsset('DodoStream-0.9.0-production-x86_64.apk'),
];

const TV_ASSETS: GithubReleaseAsset[] = [
  makeAsset('DodoStream-0.9.0-production_tv-arm64-v8a.apk'),
  makeAsset('DodoStream-0.9.0-production_tv-armeabi-v7a.apk'),
  makeAsset('DodoStream-0.9.0-production_tv-x86.apk'),
  makeAsset('DodoStream-0.9.0-production_tv-x86_64.apk'),
];

const ALL_ASSETS = [...MOBILE_ASSETS, ...TV_ASSETS];

describe('getVariantSlug', () => {
  it('returns production_tv for TV', () => {
    expect(getVariantSlug(true)).toBe('production_tv');
  });
  it('returns production for mobile', () => {
    expect(getVariantSlug(false)).toBe('production');
  });
});

describe('getAbiPriority', () => {
  it('returns default priority when null', () => {
    expect(getAbiPriority(null)).toEqual(['arm64-v8a', 'armeabi-v7a', 'x86_64', 'x86']);
  });
  it('returns default priority when empty array', () => {
    expect(getAbiPriority([])).toEqual(['arm64-v8a', 'armeabi-v7a', 'x86_64', 'x86']);
  });
  it('filters unknown ABIs', () => {
    expect(getAbiPriority(['arm64-v8a', 'unknown-abi'])).toEqual(['arm64-v8a']);
  });
  it('preserves device order', () => {
    expect(getAbiPriority(['armeabi-v7a', 'arm64-v8a'])).toEqual(['armeabi-v7a', 'arm64-v8a']);
  });
  it('falls back to default when all ABIs are unknown', () => {
    expect(getAbiPriority(['unknown'])).toEqual(['arm64-v8a', 'armeabi-v7a', 'x86_64', 'x86']);
  });
});

describe('findMatchingAsset', () => {
  it('matches TV arm64-v8a asset', () => {
    const result = findMatchingAsset(ALL_ASSETS, '0.9.0', true, ['arm64-v8a']);
    expect(result?.name).toBe('DodoStream-0.9.0-production_tv-arm64-v8a.apk');
  });

  it('matches mobile armeabi-v7a asset', () => {
    const result = findMatchingAsset(ALL_ASSETS, '0.9.0', false, ['armeabi-v7a']);
    expect(result?.name).toBe('DodoStream-0.9.0-production-armeabi-v7a.apk');
  });

  it('picks highest-priority ABI when device supports multiple', () => {
    const result = findMatchingAsset(ALL_ASSETS, '0.9.0', false, ['armeabi-v7a', 'arm64-v8a']);
    expect(result?.name).toBe('DodoStream-0.9.0-production-armeabi-v7a.apk');
  });

  it('returns null when no asset matches version', () => {
    const result = findMatchingAsset(ALL_ASSETS, '1.0.0', false, ['arm64-v8a']);
    expect(result).toBeNull();
  });

  it('returns null when assets array is empty', () => {
    const result = findMatchingAsset([], '0.9.0', false, ['arm64-v8a']);
    expect(result).toBeNull();
  });

  it('falls back to default ABI priority when supportedAbis is null', () => {
    // Only x86 asset available
    const assets = [makeAsset('DodoStream-0.9.0-production-x86.apk')];
    const result = findMatchingAsset(assets, '0.9.0', false, null);
    expect(result?.name).toBe('DodoStream-0.9.0-production-x86.apk');
  });
});
