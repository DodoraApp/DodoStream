import React from 'react';

import * as watchStatus from '@/hooks/useMediaWatchStatus';
import { renderWithProviders } from '@/utils/test-utils';

import { MediaInfo } from '../MediaInfo';

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

    expect(getByText('completed')).toBeTruthy();
    expect(getByText('IMDb')).toBeTruthy();
  });

  it('does not show completed badge when not completed', () => {
    (watchStatus.useMediaWatchStatus as jest.Mock).mockReturnValue({
      state: 'not-watched',
      source: undefined,
      isLoading: false,
    });

    const { queryByText } = renderWithProviders(<MediaInfo media={media} />);

    expect(queryByText('completed')).toBeNull();
  });

  it('shows watching badge when media is in-progress', () => {
    (watchStatus.useMediaWatchStatus as jest.Mock).mockReturnValue({
      state: 'watching',
      source: 'internal',
      isLoading: false,
    });

    const { getByText, queryByText } = renderWithProviders(<MediaInfo media={media} />);

    expect(getByText('watching')).toBeTruthy();
    expect(queryByText('completed')).toBeNull();
  });

  it('shows the simkl icon when the entry came from simkl', () => {
    (watchStatus.useMediaWatchStatus as jest.Mock).mockReturnValue({
      state: 'completed',
      source: 'simkl',
      isLoading: false,
    });

    const { getByText, getByTestId, queryByTestId } = renderWithProviders(
      <MediaInfo media={media} />
    );

    expect(getByText('completed')).toBeTruthy();
    expect(getByTestId('status-provider-simkl')).toBeTruthy();
    expect(queryByTestId('status-provider-trakt')).toBeNull();
  });

  it('shows the trakt icon when the entry came from trakt', () => {
    (watchStatus.useMediaWatchStatus as jest.Mock).mockReturnValue({
      state: 'completed',
      source: 'trakt',
      isLoading: false,
    });

    const { getByText, getByTestId, queryByTestId } = renderWithProviders(
      <MediaInfo media={media} />
    );

    expect(getByText('completed')).toBeTruthy();
    expect(getByTestId('status-provider-trakt')).toBeTruthy();
    expect(queryByTestId('status-provider-simkl')).toBeNull();
  });

  it('shows no provider icon when the entry was watched locally', () => {
    (watchStatus.useMediaWatchStatus as jest.Mock).mockReturnValue({
      state: 'completed',
      source: 'internal',
      isLoading: false,
    });

    const { getByText, queryByTestId } = renderWithProviders(<MediaInfo media={media} />);

    expect(getByText('completed')).toBeTruthy();
    expect(queryByTestId('status-provider-simkl')).toBeNull();
    expect(queryByTestId('status-provider-trakt')).toBeNull();
  });
});
