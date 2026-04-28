import React, { type ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';

import * as db from '@/db';
import { useProfileStore } from '@/store/profile.store';

import { useMediaWatchStatus } from '../useMediaWatchStatus';

jest.mock('@/db', () => ({
  getMetaWatchStatus: jest.fn(),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  return ({ children }: { children: ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

describe('useMediaWatchStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useProfileStore.setState({ activeProfileId: 'profile-1' } as any);
    (db.getMetaWatchStatus as jest.Mock).mockResolvedValue({
      state: 'not-watched',
      source: undefined,
    });
  });

  it('returns completed state from DB', async () => {
    (db.getMetaWatchStatus as jest.Mock).mockResolvedValue({
      state: 'completed',
      source: 'internal',
    });

    const { result } = renderHook(() => useMediaWatchStatus('movie-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.state).toBe('completed');
    expect(result.current.source).toBe('internal');
  });

  it('returns watching state from DB', async () => {
    (db.getMetaWatchStatus as jest.Mock).mockResolvedValue({ state: 'watching', source: 'simkl' });

    const { result } = renderHook(() => useMediaWatchStatus('show-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.state).toBe('watching');
    expect(result.current.source).toBe('simkl');
  });

  it('returns not-watched when profile is missing', async () => {
    useProfileStore.setState({ activeProfileId: undefined } as any);

    const { result } = renderHook(() => useMediaWatchStatus('movie-1'), {
      wrapper: createWrapper(),
    });

    expect(result.current.state).toBe('not-watched');
    expect(result.current.source).toBeUndefined();
    expect(db.getMetaWatchStatus).not.toHaveBeenCalled();
  });
});
