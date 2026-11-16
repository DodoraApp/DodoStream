import { act } from '@testing-library/react-native';
import * as Network from 'expo-network';

import { useIntegrationsStore } from '@/store/integrations.store';
import { showToast } from '@/store/toast.store';
import { renderHookWithProviders } from '@/utils/test-utils';

import {
  type IntegrationSyncProvider,
  isDeviceOnline,
  useIntegrationSync,
} from '../use-integration-sync';

jest.mock('expo-network', () => ({ getNetworkStateAsync: jest.fn() }));
jest.mock('@/store/toast.store', () => ({ showToast: jest.fn() }));

const mockedNetwork = jest.mocked(Network);

const online = () =>
  mockedNetwork.getNetworkStateAsync.mockResolvedValue({
    isConnected: true,
    isInternetReachable: true,
  } as Network.NetworkState);
const offline = () =>
  mockedNetwork.getNetworkStateAsync.mockResolvedValue({
    isConnected: false,
    isInternetReachable: false,
  } as Network.NetworkState);

describe('useIntegrationSync', () => {
  const runExport = jest.fn();
  const runImport = jest.fn();

  const config: IntegrationSyncProvider = {
    provider: 'simkl',
    profileId: 'sync-profile',
    getConnection: () => ({ accessToken: 'token' }),
    getSyncMode: () => 'push',
    runImport,
    runExport,
    errorTitleKey: 'settings:simkl.sync_failed',
    errorMessageKey: 'settings:simkl.sync_failed_desc',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    runExport.mockResolvedValue(true);
    runImport.mockResolvedValue(true);
    useIntegrationsStore.setState({ lastSyncAt: {} });
    online();
  });

  it('skips the sync while offline without an error toast or a new sync time', async () => {
    offline();
    const { result } = renderHookWithProviders(() =>
      useIntegrationSync(config, { autoSync: false })
    );

    await act(() => result.current.sync());

    expect(runExport).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
    expect(useIntegrationsStore.getState().lastSyncAt['sync-profile']).toBeUndefined();
  });

  it('exports once the device is online again', async () => {
    const { result } = renderHookWithProviders(() =>
      useIntegrationSync(config, { autoSync: false })
    );

    await act(() => result.current.sync());

    expect(runExport).toHaveBeenCalledWith('sync-profile', 'token');
    expect(useIntegrationsStore.getState().lastSyncAt['sync-profile']?.simkl).toBeGreaterThan(0);
  });

  it('never runs the same sync twice at once, across hook instances', async () => {
    let finishExport: (ok: boolean) => void = () => {};
    runExport.mockReturnValueOnce(
      new Promise<boolean>((resolve) => {
        finishExport = resolve;
      })
    );
    const first = renderHookWithProviders(() => useIntegrationSync(config, { autoSync: false }));
    const second = renderHookWithProviders(() => useIntegrationSync(config, { autoSync: false }));

    let running: Promise<void> = Promise.resolve();
    await act(async () => {
      running = first.result.current.sync();
    });
    await act(() => second.result.current.sync());
    expect(runExport).toHaveBeenCalledTimes(1);

    await act(async () => {
      finishExport(true);
      await running;
    });
    await act(() => second.result.current.sync());
    expect(runExport).toHaveBeenCalledTimes(2);
  });

  it('only syncs on mount when auto sync is on', async () => {
    renderHookWithProviders(() => useIntegrationSync(config, { autoSync: false }));
    await act(async () => {});
    expect(runExport).not.toHaveBeenCalled();

    renderHookWithProviders(() => useIntegrationSync(config));
    await act(async () => {});
    expect(runExport).toHaveBeenCalledTimes(1);
  });
});

describe('isDeviceOnline', () => {
  it('treats an unknown state as online and only a known offline state as offline', async () => {
    mockedNetwork.getNetworkStateAsync.mockResolvedValueOnce({} as Network.NetworkState);
    await expect(isDeviceOnline()).resolves.toBe(true);

    mockedNetwork.getNetworkStateAsync.mockRejectedValueOnce(new Error('no module'));
    await expect(isDeviceOnline()).resolves.toBe(true);

    mockedNetwork.getNetworkStateAsync.mockResolvedValueOnce({
      isConnected: true,
      isInternetReachable: false,
    } as Network.NetworkState);
    await expect(isDeviceOnline()).resolves.toBe(false);
  });
});
