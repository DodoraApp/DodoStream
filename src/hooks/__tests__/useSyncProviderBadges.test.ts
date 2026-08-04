import { renderHook } from '@testing-library/react-native';

import { useIntegrationsStore } from '@/store/integrations.store';
import { useProfileStore } from '@/store/profile.store';

import { useSyncProviderBadges } from '../useSyncProviderBadges';

const simklConnection = { accessToken: 'token', userId: 'u', username: 'n' };
const traktConnection = {
  accessToken: 'token',
  refreshToken: 'r',
  expiresAt: 0,
  userId: 'u',
  username: 'n',
};

describe('useSyncProviderBadges', () => {
  beforeEach(() => {
    useProfileStore.setState({ activeProfileId: undefined } as any);
    useIntegrationsStore.setState({ settings: {}, lastSyncAt: {}, syncStatus: {} });
  });

  it('returns no badges without an active profile', () => {
    useProfileStore.setState({ activeProfileId: 'profile-1' } as any);
    useIntegrationsStore.setState({
      settings: {
        'profile-1': { simkl: { connection: simklConnection, syncMode: 'full' } },
      },
    });

    useProfileStore.setState({ activeProfileId: undefined } as any);
    const { result } = renderHook(() => useSyncProviderBadges());

    expect(result.current).toEqual([]);
  });

  it('emits a simkl badge when only simkl is connected', () => {
    useProfileStore.setState({ activeProfileId: 'profile-1' } as any);
    useIntegrationsStore.setState({
      settings: {
        'profile-1': { simkl: { connection: simklConnection, syncMode: 'full' } },
      },
    });

    const { result } = renderHook(() => useSyncProviderBadges());

    expect(result.current).toEqual([{ key: 'simkl', status: 'waiting' }]);
  });

  it('emits a trakt badge when only trakt is connected', () => {
    useProfileStore.setState({ activeProfileId: 'profile-1' } as any);
    useIntegrationsStore.setState({
      settings: {
        'profile-1': { trakt: { connection: traktConnection, syncMode: 'full' } },
      },
    });

    const { result } = renderHook(() => useSyncProviderBadges());

    expect(result.current).toEqual([{ key: 'trakt', status: 'waiting' }]);
  });

  it('marks the trakt badge as error on sync error', () => {
    useProfileStore.setState({ activeProfileId: 'profile-1' } as any);
    useIntegrationsStore.setState({
      settings: {
        'profile-1': { trakt: { connection: traktConnection, syncMode: 'full' } },
      },
      syncStatus: { 'profile-1': { trakt: 'error' } },
    });

    const { result } = renderHook(() => useSyncProviderBadges());

    expect(result.current).toEqual([{ key: 'trakt', status: 'error' }]);
  });

  it('marks the trakt badge as synced after a successful sync', () => {
    useProfileStore.setState({ activeProfileId: 'profile-1' } as any);
    useIntegrationsStore.setState({
      settings: {
        'profile-1': { trakt: { connection: traktConnection, syncMode: 'full' } },
      },
      lastSyncAt: { 'profile-1': { trakt: 123 } },
    });

    const { result } = renderHook(() => useSyncProviderBadges());

    expect(result.current).toEqual([{ key: 'trakt', status: 'synced' }]);
  });

  it('emits badges for both connected providers, simkl first', () => {
    useProfileStore.setState({ activeProfileId: 'profile-1' } as any);
    useIntegrationsStore.setState({
      settings: {
        'profile-1': {
          simkl: { connection: simklConnection, syncMode: 'full' },
          trakt: { connection: traktConnection, syncMode: 'full' },
        },
      },
    });

    const { result } = renderHook(() => useSyncProviderBadges());

    expect(result.current).toEqual([
      { key: 'simkl', status: 'waiting' },
      { key: 'trakt', status: 'waiting' },
    ]);
  });
});
