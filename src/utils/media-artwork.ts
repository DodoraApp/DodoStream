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
