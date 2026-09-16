import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createBuildConfig } from '../android-build.mjs';
import { parseBuildArgs, selectReleaseArtifact } from '../build-release.mjs';

test('selects TV build environment and metadata', () => {
  const addonManifestUrl = 'http://10.0.2.2:8765/manifest.json';
  const config = createBuildConfig({ profile: 'tv', addonManifestUrl });

  assert.deepEqual(config, {
    appId: 'app.dodora.dodostream.dev',
    profile: 'tv',
    orientation: 'landscape',
    addonManifestUrl,
    environment: {
      APP_VARIANT: 'dev',
      EXPO_PUBLIC_E2E: '1',
      E2E_ORIENTATION: 'landscape',
      EXPO_TV: '1',
      ADDON_MANIFEST_URL: addonManifestUrl,
    },
  });
});

test('selects phone and tablet orientation without TV mode', () => {
  const phone = createBuildConfig({ profile: 'phone' });
  const tablet = createBuildConfig({ profile: 'tablet' });

  assert.equal(phone.orientation, 'portrait');
  assert.equal(phone.environment.EXPO_TV, '0');
  assert.equal(tablet.orientation, 'landscape');
  assert.equal(tablet.environment.EXPO_TV, '0');
});

test('rejects an unsupported build profile', () => {
  assert.throws(() => createBuildConfig({ profile: 'desktop' }), /phone\|tablet\|tv/);
});

test('parses build arguments with deterministic defaults', () => {
  const args = parseBuildArgs([], {});

  assert.equal(args.profile, 'phone');
  assert.equal(args.abi, undefined);
  assert.equal(args.skipLint, true);
  assert.equal(args.addonManifestUrl, undefined);
});

test('parses explicit profile, ABI, lint, and manifest overrides', () => {
  const args = parseBuildArgs(['--profile', 'tablet', '--abi', 'arm64-v8a'], {
    E2E_LINT: '1',
    ADDON_MANIFEST_URL: 'http://10.0.2.2:9999/manifest.json',
  });

  assert.equal(args.profile, 'tablet');
  assert.equal(args.abi, 'arm64-v8a');
  assert.equal(args.skipLint, false);
  assert.equal(args.addonManifestUrl, 'http://10.0.2.2:9999/manifest.json');
});

test('rejects missing option values', () => {
  assert.throws(() => parseBuildArgs(['--profile'], {}), /missing value/);
  assert.throws(() => parseBuildArgs(['--abi'], {}), /missing value/);
});

test('prefers the universal artifact when no ABI is requested', () => {
  const files = ['app-arm64-v8a-release.apk', 'app-universal-release.apk'];

  assert.equal(selectReleaseArtifact(files, undefined), 'app-universal-release.apk');
  assert.equal(selectReleaseArtifact(files, 'arm64-v8a'), 'app-arm64-v8a-release.apk');
  assert.equal(selectReleaseArtifact(['app-release.apk'], undefined), 'app-release.apk');
});

test('fails with the available artifact list', () => {
  assert.throws(
    () => selectReleaseArtifact(['app-x86_64-release.apk'], 'arm64-v8a'),
    /app-x86_64-release\.apk/
  );
  assert.throws(() => selectReleaseArtifact([], undefined), /available: none/);
});
