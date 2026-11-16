import React from 'react';

import { act } from '@testing-library/react-native';
import * as Network from 'expo-network';

import { hasUnsyncedWatches } from '@/api/integrations/pending-watch-sync';
import { useIntegrationsStore } from '@/store/integrations.store';
import { useProfileStore } from '@/store/profile.store';
import { renderWithProviders } from '@/utils/test-utils';

import { PendingWatchSync } from '../PendingWatchSync';

const mockSyncSimkl = jest.fn(() => Promise.resolve());
const mockSyncTrakt = jest.fn(() => Promise.resolve());
let mockNetworkListener: ((state: Network.NetworkState) => void) | undefined;

jest.mock('expo-network', () => ({
  addNetworkStateListener: jest.fn((listener) => {
    mockNetworkListener = listener;
    return { remove: jest.fn() };
  }),
}));
jest.mock('@/api/integrations/pending-watch-sync', () => ({ hasUnsyncedWatches: jest.fn() }));
jest.mock('@/api/simkl/hooks', () => ({ useSimklSync: () => ({ sync: mockSyncSimkl }) }));
jest.mock('@/api/trakt/hooks', () => ({ useTraktSync: () => ({ sync: mockSyncTrakt }) }));
jest.mock('@/utils/debug', () => ({ createDebugLogger: () => jest.fn() }));

const mockedHasUnsynced = jest.mocked(hasUnsyncedWatches);
const flush = () => act(async () => {});

describe('PendingWatchSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNetworkListener = undefined;
    useProfileStore.setState({ activeProfileId: 'p1' });
    useIntegrationsStore.setState({
      settings: { p1: { simkl: { connection: { accessToken: 'token' } } } },
    } as never);
    mockedHasUnsynced.mockResolvedValue(true);
  });

  it('syncs what was watched while offline when the app starts', async () => {
    renderWithProviders(<PendingWatchSync />);
    await flush();

    expect(mockedHasUnsynced).toHaveBeenCalledWith('p1', 'simkl');
    expect(mockSyncSimkl).toHaveBeenCalledTimes(1);
    // Trakt is not connected.
    expect(mockSyncTrakt).not.toHaveBeenCalled();
  });

  it('syncs again as soon as the connection is back, not while offline', async () => {
    renderWithProviders(<PendingWatchSync />);
    await flush();
    mockSyncSimkl.mockClear();

    await act(async () => {
      mockNetworkListener?.({ isConnected: false, isInternetReachable: false });
    });
    expect(mockSyncSimkl).not.toHaveBeenCalled();

    await act(async () => {
      mockNetworkListener?.({ isConnected: true, isInternetReachable: true });
    });
    expect(mockSyncSimkl).toHaveBeenCalledTimes(1);
  });

  it('still syncs Trakt when the Simkl sync fails', async () => {
    useIntegrationsStore.setState({
      settings: {
        p1: {
          simkl: { connection: { accessToken: 'token' } },
          trakt: { connection: { accessToken: 'token' } },
        },
      },
    } as never);
    mockSyncSimkl.mockRejectedValueOnce(new Error('Simkl down'));

    renderWithProviders(<PendingWatchSync />);
    await flush();

    expect(mockSyncSimkl).toHaveBeenCalledTimes(1);
    expect(mockSyncTrakt).toHaveBeenCalledTimes(1);
  });

  it('adds no sync while everything is already synced', async () => {
    mockedHasUnsynced.mockResolvedValue(false);

    renderWithProviders(<PendingWatchSync />);
    await flush();
    await act(async () => {
      mockNetworkListener?.({ isConnected: true, isInternetReachable: true });
    });

    expect(mockSyncSimkl).not.toHaveBeenCalled();
  });
});
