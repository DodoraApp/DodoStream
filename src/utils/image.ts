import type { ImageRequireSource } from 'react-native';

import type { ImageSource } from 'expo-image';

export const getImageSource = (
  uri?: string | null,
  fallback?: ImageSource | ImageRequireSource
): ImageSource | ImageRequireSource | undefined => {
  if (uri) return { uri };
  return fallback;
};
