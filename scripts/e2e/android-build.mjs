const DEFAULT_ADDON_PORT = 8765;
const APP_ID = 'app.dodora.dodostream.dev';
const PROFILES = new Set(['phone', 'tablet', 'tv']);

export const createBuildConfig = ({
  profile,
  addonManifestUrl = `http://10.0.2.2:${DEFAULT_ADDON_PORT}/manifest.json`,
}) => {
  if (!PROFILES.has(profile)) {
    throw new Error(`unknown profile: ${profile} (expected phone|tablet|tv)`);
  }

  const orientation = profile === 'phone' ? 'portrait' : 'landscape';
  return {
    appId: APP_ID,
    profile,
    orientation,
    addonManifestUrl,
    environment: {
      APP_VARIANT: 'dev',
      EXPO_PUBLIC_E2E: '1',
      E2E_ORIENTATION: orientation,
      EXPO_TV: profile === 'tv' ? '1' : '0',
      ADDON_MANIFEST_URL: addonManifestUrl,
    },
  };
};
