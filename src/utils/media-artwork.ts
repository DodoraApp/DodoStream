import { NO_POSTER_LANDSCAPE } from '@/constants/images';
import type { MetaDetail } from '@/types/stremio';
import { getImageSource } from '@/utils/image';

type DetailsCoverInput = Pick<MetaDetail, 'background' | 'poster'>;
type DetailsLogoInput = Pick<MetaDetail, 'logo'>;

export const getDetailsCoverSource = (
  background: DetailsCoverInput['background'],
  poster: DetailsCoverInput['poster']
) => {
  const uri = background || poster;
  return getImageSource(uri, NO_POSTER_LANDSCAPE);
};

export const getDetailsLogoSource = (logo: DetailsLogoInput['logo']) => {
  const uri = logo;
  return getImageSource(uri);
};

/**
 * Maps a Simkl poster value to a full URL.
 * Example: "12/129597638d4467f431" -> "https://simkl.in/posters/12/129597638d4467f431_ca.jpg"
 */
export const getSimklPosterUrl = (poster: string | undefined | null) => {
  if (!poster) return undefined;
  if (poster.startsWith('http')) return poster;
  return `https://simkl.in/posters/${poster}_ca.jpg`;
};

/**
 * Maps a Trakt images object to a poster URL.
 */
export const getTraktPosterUrl = (images: { poster?: string[] } | undefined | null) => {
  const poster = images?.poster?.[0];
  if (!poster) return undefined;
  if (poster.startsWith('http')) return poster;
  return `https://${poster}`;
};
