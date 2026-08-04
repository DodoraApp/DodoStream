import { act, renderHook } from '@testing-library/react-native';

import { useAppSettingsStore } from '@/store/app-settings.store';

import { useWhatsNew } from '../useWhatsNew';

// Use a stable fixture registry so tests don't depend on shipped content
jest.mock('@/constants/whats-new/_registry', () => ({
  whatsNewEntries: [
    { id: '0001', version: 'v0.1.0', title: 'A', body: '# A' },
    { id: '0002', version: 'v0.1.0', title: 'B', body: '# B' },
    { id: '0003', version: 'v0.2.0', title: 'C', body: '# C' },
  ],
}));

// Mock debug logger to prevent console spam
jest.mock('@/utils/debug', () => ({
  createDebugLogger: () => jest.fn(),
}));

describe('useWhatsNew', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAppSettingsStore.setState({ lastSeenWhatsNewId: null, showWhatsNewOnStartup: true });
  });

  it('shows all entries on first launch (null cursor)', () => {
    const { result } = renderHook(() => useWhatsNew());

    expect(result.current.isVisible).toBe(true);
    expect(result.current.unseenEntries).toHaveLength(3);
    expect(result.current.currentEntry?.id).toBe('0001');
  });

  it('shows only entries after the cursor', () => {
    useAppSettingsStore.setState({ lastSeenWhatsNewId: '0001' });
    const { result } = renderHook(() => useWhatsNew());

    expect(result.current.unseenEntries.map((entry) => entry.id)).toEqual(['0002', '0003']);
    expect(result.current.currentEntry?.id).toBe('0002');
  });

  it('shows all entries when the cursor is not in the registry', () => {
    useAppSettingsStore.setState({ lastSeenWhatsNewId: '9999' });
    const { result } = renderHook(() => useWhatsNew());

    expect(result.current.unseenEntries).toHaveLength(3);
    expect(result.current.currentEntry?.id).toBe('0001');
  });

  it('is not visible when showOnStartup is disabled', () => {
    useAppSettingsStore.setState({ showWhatsNewOnStartup: false });
    const { result } = renderHook(() => useWhatsNew());

    expect(result.current.isVisible).toBe(false);
  });

  it('goNext advances through entries and is a no-op at the last entry', () => {
    const { result } = renderHook(() => useWhatsNew());

    expect(result.current.currentEntry?.id).toBe('0001');
    act(() => result.current.goNext());
    expect(result.current.currentEntry?.id).toBe('0002');
    act(() => result.current.goNext());
    expect(result.current.currentEntry?.id).toBe('0003');

    const indexBeforeNoop = result.current.currentIndex;
    act(() => result.current.goNext());
    expect(result.current.currentIndex).toBe(indexBeforeNoop);
    expect(result.current.currentEntry?.id).toBe('0003');
  });

  it('dismiss advances the cursor to the last entry and resets the index', () => {
    const { result } = renderHook(() => useWhatsNew());

    act(() => result.current.goNext());
    act(() => result.current.dismiss());

    expect(useAppSettingsStore.getState().lastSeenWhatsNewId).toBe('0003');
    expect(result.current.currentIndex).toBe(0);
  });

  it('dismiss with no unseen entries leaves the cursor unchanged', () => {
    useAppSettingsStore.setState({ lastSeenWhatsNewId: '0003' });
    const { result } = renderHook(() => useWhatsNew());

    act(() => result.current.dismiss());

    expect(useAppSettingsStore.getState().lastSeenWhatsNewId).toBe('0003');
  });
});
