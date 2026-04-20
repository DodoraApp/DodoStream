import type { ImageSourcePropType } from 'react-native';

export const getImageSource = (
  uri?: string | null,
  fallback?: ImageSourcePropType
): ImageSourcePropType | undefined => {
  if (uri) return { uri };
  return fallback;
};
