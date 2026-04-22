import React from 'react';
import { renderWithProviders } from '@/utils/test-utils';
import { MediaInfo } from '../MediaInfo';
import * as watchStatus from '@/hooks/useMediaWatchStatus';

jest.mock('@/hooks/useMediaWatchStatus', () => ({
  useMediaWatchStatus: jest.fn(),
}));

describe('MediaInfo', () => {
  const media = {
    id: 'movie-1',
    type: 'movie',
    name: 'My Movie',
    description: 'A movie',
    imdbRating: '7.8',
    links: [],
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows completed badge in quick info row when completed', () => {
    (watchStatus.useMediaWatchStatus as jest.Mock).mockReturnValue({
      state: 'completed',
      source: 'internal',
      isLoading: false,
    });

    const { getByText } = renderWithProviders(<MediaInfo media={media} />);

    expect(getByText('Completed')).toBeTruthy();
    expect(getByText('IMDb')).toBeTruthy();
  });

  it('does not show completed badge when not completed', () => {
    (watchStatus.useMediaWatchStatus as jest.Mock).mockReturnValue({
      state: 'not-watched',
      source: undefined,
      isLoading: false,
    });

    const { queryByText } = renderWithProviders(<MediaInfo media={media} />);

    expect(queryByText('Completed')).toBeNull();
  });

  it('shows watching badge when media is in-progress', () => {
    (watchStatus.useMediaWatchStatus as jest.Mock).mockReturnValue({
      state: 'watching',
      source: 'internal',
      isLoading: false,
    });

    const { getByText, queryByText } = renderWithProviders(<MediaInfo media={media} />);

    expect(getByText('Watching')).toBeTruthy();
    expect(queryByText('Completed')).toBeNull();
  });

  it('shows provider icon marker when source is simkl', () => {
    (watchStatus.useMediaWatchStatus as jest.Mock).mockReturnValue({
      state: 'completed',
      source: 'simkl',
      isLoading: false,
    });

    const { getByText, getByTestId } = renderWithProviders(<MediaInfo media={media} />);

    expect(getByText('Completed')).toBeTruthy();
    expect(getByTestId('status-provider-simkl')).toBeTruthy();
  });
});
