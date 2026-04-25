import { getSimklPosterUrl } from '../media-artwork';

describe('getSimklPosterUrl', () => {
  it('maps a Simkl poster path to a full URL', () => {
    const poster = '12/129597638d4467f431';
    const expected = 'https://simkl.in/posters/12/129597638d4467f431_ca.jpg';
    expect(getSimklPosterUrl(poster)).toBe(expected);
  });

  it('returns undefined if poster is null or undefined', () => {
    expect(getSimklPosterUrl(undefined)).toBeUndefined();
    expect(getSimklPosterUrl(null)).toBeUndefined();
  });

  it('returns the same string if it already starts with http', () => {
    const url = 'https://example.com/poster.jpg';
    expect(getSimklPosterUrl(url)).toBe(url);
  });
});
