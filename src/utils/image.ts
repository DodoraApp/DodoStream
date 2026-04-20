import type { ImageRequireSource } from 'react-native';
import type { Source } from '@d11/react-native-fast-image';

export const getImageSource = (
  uri?: string | null,
  fallback?: Source | ImageRequireSource
): Source | ImageRequireSource | undefined => {
  if (uri) return { uri };
  return fallback;
};
