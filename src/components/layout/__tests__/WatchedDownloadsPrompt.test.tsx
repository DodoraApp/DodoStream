import React from 'react';

import { fireEvent } from '@testing-library/react-native';

import { removeDownload } from '@/api/downloads/download-manager';
import type { DbDownload } from '@/db';
import { useDownloadsStore } from '@/store/downloads.store';
import { renderWithProviders } from '@/utils/test-utils';

import { WatchedDownloadsPrompt } from '../WatchedDownloadsPrompt';

let mockPathname = '/details/tt-1';

jest.mock('expo-router', () => ({ usePathname: () => mockPathname }));
jest.mock('@/api/downloads/download-manager', () => ({
  removeDownload: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/utils/debug', () => ({ createDebugLogger: () => jest.fn() }));

const watched = (id: number): DbDownload =>
  ({ id, title: `Episode ${id}`, status: 'completed' }) as DbDownload;

describe('WatchedDownloadsPrompt', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname = '/details/tt-1';
    useDownloadsStore.setState({ watchedDownloads: [] });
  });

  it('stays hidden while nothing was watched', () => {
    const { queryByTestId } = renderWithProviders(<WatchedDownloadsPrompt />);

    expect(queryByTestId('watched-downloads-prompt')).toBeNull();
  });

  it('waits until the player is closed', () => {
    mockPathname = '/play';
    useDownloadsStore.setState({ watchedDownloads: [watched(1)] });

    const { queryByTestId } = renderWithProviders(<WatchedDownloadsPrompt />);

    expect(queryByTestId('watched-downloads-prompt')).toBeNull();
  });

  it('deletes every watched download after confirmation and asks only once', () => {
    useDownloadsStore.setState({ watchedDownloads: [watched(1), watched(2)] });
    const { getByTestId } = renderWithProviders(<WatchedDownloadsPrompt />);

    fireEvent.press(getByTestId('watched-downloads-prompt-confirm'));

    expect(removeDownload).toHaveBeenCalledWith(1);
    expect(removeDownload).toHaveBeenCalledWith(2);
    expect(useDownloadsStore.getState().watchedDownloads).toHaveLength(0);
  });

  it('keeps the downloads when the user chooses to keep them', () => {
    useDownloadsStore.setState({ watchedDownloads: [watched(1)] });
    const { getByTestId } = renderWithProviders(<WatchedDownloadsPrompt />);

    fireEvent.press(getByTestId('watched-downloads-prompt-cancel'));

    expect(removeDownload).not.toHaveBeenCalled();
    expect(useDownloadsStore.getState().watchedDownloads).toHaveLength(0);
  });
});
