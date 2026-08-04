import { useCallback, useMemo, useState } from 'react';

import { whatsNewEntries } from '@/constants/whats-new/_registry';
import { useAppSettingsStore } from '@/store/app-settings.store';
import type { WhatsNewEntry } from '@/types/whats-new';
import { createDebugLogger } from '@/utils/debug';

const debug = createDebugLogger('useWhatsNew');

export interface UseWhatsNewReturn {
  /** Whether the modal should be visible */
  isVisible: boolean;
  /** Entries that haven't been seen yet */
  unseenEntries: WhatsNewEntry[];
  /** Current index in the unseen entries array */
  currentIndex: number;
  /** Current entry being displayed */
  currentEntry: WhatsNewEntry | null;
  /** Whether to show What's New on startup */
  showOnStartup: boolean;
  /** Set whether to show What's New on startup */
  setShowOnStartup: (value: boolean) => void;
  /** Advance to the next entry */
  goNext: () => void;
  /** Dismiss the modal and update the cursor */
  dismiss: () => void;
}

/**
 * Hook to manage What's New modal visibility and pagination.
 *
 * Filtering logic:
 * 1. Get lastSeenWhatsNewId from store (cursor)
 * 2. If lastSeenWhatsNewId === null (first launch): show all entries
 * 3. Otherwise: show entries whose id comes after lastSeenWhatsNewId in the ordered array
 * 4. isVisible = showOnStartup && unseenEntries.length > 0
 *
 * Dismiss behavior:
 * - Sets lastSeenWhatsNewId = lastEntry.id (not current version)
 * - This means: if a user dismisses after seeing entries 0001-0003, and later 0004 is added,
 *   they see only 0004 on next launch
 *
 * Toggle note: turning "show at startup" off while the modal is open hides it without advancing
 * the cursor, so re-enabling replays all entries — intentional, not a bug.
 */
export function useWhatsNew(): UseWhatsNewReturn {
  const showOnStartup = useAppSettingsStore((state) => state.showWhatsNewOnStartup);
  const setShowOnStartup = useAppSettingsStore((state) => state.setShowWhatsNewOnStartup);
  const lastSeenWhatsNewId = useAppSettingsStore((state) => state.lastSeenWhatsNewId);
  const setLastSeenWhatsNewId = useAppSettingsStore((state) => state.setLastSeenWhatsNewId);

  const [currentIndex, setCurrentIndex] = useState(0);

  // Filter entries based on the cursor
  const unseenEntries = useMemo(() => {
    let result: WhatsNewEntry[];

    if (lastSeenWhatsNewId === null) {
      // First launch: show all entries
      result = whatsNewEntries;
    } else {
      // Show entries that come after the last seen ID
      const lastIndex = whatsNewEntries.findIndex((entry) => entry.id === lastSeenWhatsNewId);
      if (lastIndex === -1) {
        // If cursor not found (e.g., cleared data), show all
        result = whatsNewEntries;
      } else {
        result = whatsNewEntries.slice(lastIndex + 1);
      }
    }

    debug('filtered', {
      cursor: lastSeenWhatsNewId,
      unseen: result.length,
      total: whatsNewEntries.length,
    });

    return result;
  }, [lastSeenWhatsNewId]);

  const isVisible = showOnStartup && unseenEntries.length > 0;
  const currentEntry = unseenEntries[currentIndex] ?? null;

  const goNext = useCallback(() => {
    debug('next', { from: currentIndex });
    if (currentIndex < unseenEntries.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  }, [currentIndex, unseenEntries.length]);

  const dismiss = useCallback(() => {
    if (unseenEntries.length > 0) {
      // Set cursor to the last entry in the list, not the current one
      const lastEntry = unseenEntries[unseenEntries.length - 1];
      debug('dismiss', { cursor: lastEntry.id });
      setLastSeenWhatsNewId(lastEntry.id);
    }
    setCurrentIndex(0);
  }, [unseenEntries, setLastSeenWhatsNewId]);

  return {
    isVisible,
    unseenEntries,
    currentIndex,
    currentEntry,
    showOnStartup,
    setShowOnStartup,
    goNext,
    dismiss,
  };
}
