import { act, waitFor } from '@testing-library/react-native';
import { createTestQueryClient, renderHookWithProviders } from '@/utils/test-utils';

const mockUpsertWatchProgress = jest.fn().mockResolvedValue(undefined);
const mockRemoveWatchHistoryMeta = jest.fn().mockResolvedValue(undefined);
const mockRemoveWatchHistoryItem = jest.fn().mockResolvedValue(undefined);
const mockListWatchHistoryForMeta = jest.fn().mockResolvedValue([]);

jest.mock('@/db', () => ({
  upsertWatchProgress: (...args: any[]) => mockUpsertWatchProgress(...args),
  removeWatchHistoryMeta: (...args: any[]) => mockRemoveWatchHistoryMeta(...args),
  removeWatchHistoryItem: (...args: any[]) => mockRemoveWatchHistoryItem(...args),
  listWatchHistoryForMeta: (...args: any[]) => mockListWatchHistoryForMeta(...args),
  initializeDatabase: jest.fn(),
}));

const mockShowToast = jest.fn();
jest.mock('@/store/toast.store', () => ({
  showToast: (...args: any[]) => mockShowToast(...args),
}));

const mockUseProfileStore = jest.fn();
jest.mock('@/store/profile.store', () => ({
  useProfileStore: (selector: any) => mockUseProfileStore(selector),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        mark_as_watched: 'Mark as watched',
        remove_from_history: 'Remove from history',
        completed: 'Completed',
      };
      return translations[key] ?? key;
    },
  }),
}));

// Mock watch history hooks to return controlled values
let mockWatchState: 'not-watched' | 'in-progress' | 'watched' = 'not-watched';
let mockHistoryItem: any = null;

jest.mock('@/hooks/useWatchHistoryDb', () => ({
  useWatchState: () => mockWatchState,
  useWatchProgress: () => 0,
  useWatchHistoryItem: () => ({ data: mockHistoryItem }),
  watchHistoryKeys: {
    all: ['watch-history-db'],
    itemsForMeta: (pid: string, mid: string) => ['watch-history-db', 'items-for-meta', pid, mid],
  },
}));

jest.mock('@/hooks/useContinueWatching', () => ({
  useContinueWatchingForMeta: () => ({ entry: undefined, isLoading: false }),
}));

import { useMediaDetailsActions } from '../useMediaDetailsActions';

function setupProfile(profileId: string | null = 'profile-1') {
  mockUseProfileStore.mockImplementation((selector: any) =>
    selector({ activeProfileId: profileId })
  );
}

const baseParams = {
  metaId: 'tt1234567',
  type: 'movie' as const,
  metaName: 'Test Movie',
};

describe('useMediaDetailsActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupProfile();
    mockWatchState = 'not-watched';
    mockHistoryItem = null;
    mockListWatchHistoryForMeta.mockResolvedValue([]);
  });

  // ──────────────────────────────────────────────────────────
  // Items computation
  // ──────────────────────────────────────────────────────────

  describe('items', () => {
    it('shows only "mark as watched" when not-watched (no history to remove)', () => {
      const { result } = renderHookWithProviders(() =>
        useMediaDetailsActions(baseParams)
      );
      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0].value).toBe('mark-as-watched');
    });

    it('shows "mark as watched" when in-progress', () => {
      mockWatchState = 'in-progress';
      mockHistoryItem = { durationSeconds: 3600 };
      const { result } = renderHookWithProviders(() =>
        useMediaDetailsActions(baseParams)
      );
      expect(result.current.items).toHaveLength(2);
      expect(result.current.items[0].value).toBe('mark-as-watched');
      expect(result.current.items[1].value).toBe('remove-from-history');
    });

    it('shows only "remove from history" when fully watched', () => {
      mockWatchState = 'watched';
      mockHistoryItem = { durationSeconds: 3600 };
      const { result } = renderHookWithProviders(() =>
        useMediaDetailsActions(baseParams)
      );
      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0].value).toBe('remove-from-history');
    });

    it('"remove from history" has destructive tone', () => {
      mockWatchState = 'in-progress';
      mockHistoryItem = { durationSeconds: 3600 };
      const { result } = renderHookWithProviders(() =>
        useMediaDetailsActions(baseParams)
      );
      expect(result.current.items[1].tone).toBe('destructive');
    });
  });

  // ──────────────────────────────────────────────────────────
  // Multi-video (series) items
  // ──────────────────────────────────────────────────────────

  describe('multi-video items', () => {
    const seriesParams = {
      ...baseParams,
      videos: [
        { id: 'tt1234567:1:1', title: 'E1', released: '' },
        { id: 'tt1234567:1:2', title: 'E2', released: '' },
      ],
    };

    it('always shows "mark as watched" for series', () => {
      const { result } = renderHookWithProviders(() =>
        useMediaDetailsActions(seriesParams)
      );
      expect(result.current.items.some((i) => i.value === 'mark-as-watched')).toBe(true);
    });

    it('shows "remove from history" when meta has history', async () => {
      mockListWatchHistoryForMeta.mockResolvedValue([{ id: 'tt1234567' }]);
      const { result } = renderHookWithProviders(() =>
        useMediaDetailsActions(seriesParams)
      );
      await waitFor(() => {
        expect(result.current.items.some((i) => i.value === 'remove-from-history')).toBe(true);
      });
    });

    it('hides "remove from history" when no meta history', () => {
      mockListWatchHistoryForMeta.mockResolvedValue([]);
      const { result } = renderHookWithProviders(() =>
        useMediaDetailsActions(seriesParams)
      );
      expect(result.current.items.some((i) => i.value === 'remove-from-history')).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────
  // Visibility
  // ──────────────────────────────────────────────────────────

  describe('visibility', () => {
    it('starts hidden', () => {
      const { result } = renderHookWithProviders(() =>
        useMediaDetailsActions(baseParams)
      );
      expect(result.current.isVisible).toBe(false);
    });

    it('openActions makes it visible', () => {
      const { result } = renderHookWithProviders(() =>
        useMediaDetailsActions(baseParams)
      );
      act(() => result.current.openActions());
      expect(result.current.isVisible).toBe(true);
    });

    it('closeActions hides it', () => {
      const { result } = renderHookWithProviders(() =>
        useMediaDetailsActions(baseParams)
      );
      act(() => result.current.openActions());
      act(() => result.current.closeActions());
      expect(result.current.isVisible).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────
  // handleAction — mark-as-watched (single video)
  // ──────────────────────────────────────────────────────────

  describe('mark-as-watched (single video)', () => {
    beforeEach(() => {
      mockWatchState = 'in-progress';
      mockHistoryItem = { videoId: 'tt1234567:1:1', durationSeconds: 3600 };
    });

    it('calls upsertWatchProgress with correct params', async () => {
      const { result } = renderHookWithProviders(() =>
        useMediaDetailsActions(baseParams)
      );

      await act(async () => {
        result.current.handleAction('mark-as-watched');
      });

      await waitFor(() => {
        expect(mockUpsertWatchProgress).toHaveBeenCalledTimes(1);
        expect(mockUpsertWatchProgress).toHaveBeenCalledWith({
          profileId: 'profile-1',
          metaId: 'tt1234567',
          videoId: 'tt1234567:1:1',
          type: 'movie',
          progressSeconds: 3600,
          durationSeconds: 3600,
        });
      });
    });

    it('uses fallback duration of 1 when durationSeconds is 0', async () => {
      mockHistoryItem = { videoId: 'tt1234567', durationSeconds: 0 };
      mockWatchState = 'not-watched';
      const { result } = renderHookWithProviders(() =>
        useMediaDetailsActions({
          ...baseParams,
          targetVideoId: 'tt1234567',
        })
      );

      await act(async () => {
        result.current.handleAction('mark-as-watched');
      });

      await waitFor(() => {
        expect(mockUpsertWatchProgress).toHaveBeenCalledWith(
          expect.objectContaining({ progressSeconds: 1, durationSeconds: 1 })
        );
      });
    });

    it('closes the picker after action', async () => {
      const { result } = renderHookWithProviders(() =>
        useMediaDetailsActions(baseParams)
      );

      act(() => result.current.openActions());
      await act(async () => {
        result.current.handleAction('mark-as-watched');
      });

      expect(result.current.isVisible).toBe(false);
    });

    it('shows toast on success', async () => {
      const { result } = renderHookWithProviders(() =>
        useMediaDetailsActions(baseParams)
      );

      await act(async () => {
        result.current.handleAction('mark-as-watched');
      });

      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith(
          expect.objectContaining({ title: 'Completed', message: 'Test Movie' })
        );
      });
    });
  });

  // ──────────────────────────────────────────────────────────
  // handleAction — mark-as-watched (bulk)
  // ──────────────────────────────────────────────────────────

  describe('mark-as-watched (bulk)', () => {
    it('upserts every video in videos array', async () => {
      const { result } = renderHookWithProviders(() =>
        useMediaDetailsActions({
          ...baseParams,
          videos: [
            { id: 'tt1234567:1:1', title: 'E1', released: '' },
            { id: 'tt1234567:1:2', title: 'E2', released: '' },
            { id: 'tt1234567:1:3', title: 'E3', released: '' },
          ],
        })
      );

      await act(async () => {
        result.current.handleAction('mark-as-watched');
      });

      await waitFor(() => {
        expect(mockUpsertWatchProgress).toHaveBeenCalledTimes(3);
        expect(mockUpsertWatchProgress).toHaveBeenCalledWith(
          expect.objectContaining({ videoId: 'tt1234567:1:1', durationSeconds: 1 })
        );
        expect(mockUpsertWatchProgress).toHaveBeenCalledWith(
          expect.objectContaining({ videoId: 'tt1234567:1:2', durationSeconds: 1 })
        );
        expect(mockUpsertWatchProgress).toHaveBeenCalledWith(
          expect.objectContaining({ videoId: 'tt1234567:1:3', durationSeconds: 1 })
        );
      });
    });

    it('shows single toast after all upserts', async () => {
      const { result } = renderHookWithProviders(() =>
        useMediaDetailsActions({
          ...baseParams,
          videos: [
            { id: 'tt1234567:1:1', title: 'E1', released: '' },
            { id: 'tt1234567:1:2', title: 'E2', released: '' },
          ],
        })
      );

      await act(async () => {
        result.current.handleAction('mark-as-watched');
      });

      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledTimes(1);
      });
    });
  });

  // ──────────────────────────────────────────────────────────
  // handleAction — remove-from-history
  // ──────────────────────────────────────────────────────────

  describe('remove-from-history', () => {
    it('calls removeWatchHistoryMeta by default (meta scope)', async () => {
      mockWatchState = 'in-progress';
      mockHistoryItem = { durationSeconds: 3600 };
      const { result } = renderHookWithProviders(() =>
        useMediaDetailsActions(baseParams)
      );

      await act(async () => {
        result.current.handleAction('remove-from-history');
      });

      await waitFor(() => {
        expect(mockRemoveWatchHistoryMeta).toHaveBeenCalledWith('profile-1', 'tt1234567');
        expect(mockRemoveWatchHistoryItem).not.toHaveBeenCalled();
      });
    });

    it('calls removeWatchHistoryItem when removalScope is item', async () => {
      mockWatchState = 'in-progress';
      mockHistoryItem = { videoId: 'tt1234567:1:5', durationSeconds: 3600 };
      const { result } = renderHookWithProviders(() =>
        useMediaDetailsActions({
          ...baseParams,
          targetVideoId: 'tt1234567:1:5',
          removalScope: 'item',
        })
      );

      await act(async () => {
        result.current.handleAction('remove-from-history');
      });

      await waitFor(() => {
        expect(mockRemoveWatchHistoryItem).toHaveBeenCalledWith(
          'profile-1',
          'tt1234567',
          'tt1234567:1:5'
        );
        expect(mockRemoveWatchHistoryMeta).not.toHaveBeenCalled();
      });
    });

    it('closes the picker and shows toast', async () => {
      mockWatchState = 'in-progress';
      mockHistoryItem = { durationSeconds: 3600 };
      const { result } = renderHookWithProviders(() =>
        useMediaDetailsActions(baseParams)
      );

      act(() => result.current.openActions());
      await act(async () => {
        result.current.handleAction('remove-from-history');
      });

      expect(result.current.isVisible).toBe(false);
      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith(
          expect.objectContaining({ title: 'Remove from history', message: 'Test Movie' })
        );
      });
    });
  });

  // ──────────────────────────────────────────────────────────
  // No profile
  // ──────────────────────────────────────────────────────────

  describe('no profile', () => {
    it('does nothing when profileId is null', async () => {
      setupProfile(null);
      mockWatchState = 'in-progress';
      mockHistoryItem = { durationSeconds: 3600 };
      const { result } = renderHookWithProviders(() =>
        useMediaDetailsActions(baseParams)
      );

      await act(async () => {
        result.current.handleAction('mark-as-watched');
      });

      expect(mockUpsertWatchProgress).not.toHaveBeenCalled();
      expect(mockRemoveWatchHistoryMeta).not.toHaveBeenCalled();
    });
  });
});
