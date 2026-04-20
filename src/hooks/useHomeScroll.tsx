import type { LegendListRef } from '@legendapp/list/react-native';
import { createContext, useContext, useCallback, useRef, ReactNode } from 'react';
import { Platform } from 'react-native';
import { TV_SCROLL_DEBOUNCE_MS } from '@/constants/ui';

interface HomeScrollContextValue {
  /** Scroll to the very top of the home screen (show hero section) */
  scrollToTop: () => void;
  /** Scroll to a specific section by key */
  scrollToSection: (sectionIndex: number) => void;
  /** LegendList ref for the home screen */
  listRef: React.RefObject<LegendListRef | null>;
  lastScrolledIndex: React.RefObject<number | null>;
  /** Register the section index map for scrollToSection */
  setSectionIndexMap: (map: Record<string, number>) => void;
}

const HomeScrollContext = createContext<HomeScrollContextValue | null>(null);

interface HomeScrollProviderProps {
  children: ReactNode;
}

/**
 * Provider for home screen scroll functionality.
 * Enables child components to scroll the home LegendList.
 */
export function HomeScrollProvider({ children }: HomeScrollProviderProps) {
  const listRef = useRef<LegendListRef | null>(null);
  const sectionIndexMapRef = useRef<Record<string, number>>({});
  const lastScrolledIndex = useRef<number | null>(null);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTV = Platform.isTV;

  const setSectionIndexMap = useCallback((map: Record<string, number>) => {
    sectionIndexMapRef.current = map;
  }, []);

  const scrollToTop = useCallback(() => {
    if (!isTV) return;
    // Reset last scrolled key since we're going to top
    lastScrolledIndex.current = null;
    listRef.current?.scrollToOffset({
      offset: 0,
      animated: true,
    });
  }, [isTV]);

  const scrollToSection = useCallback(
    (sectionIndex: number) => {
      if (!isTV) return;
      // Prevent duplicate scrolls to same section
      if (lastScrolledIndex.current === sectionIndex) return;

      lastScrolledIndex.current = sectionIndex;

      // Debounce: cancel any pending scroll so rapid D-pad presses only
      // trigger a single animated scroll once the user pauses.
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      scrollTimeoutRef.current = setTimeout(() => {
        listRef.current?.scrollToIndex({
          index: sectionIndex,
          animated: true,
          viewPosition: 0.5,
        });
      }, TV_SCROLL_DEBOUNCE_MS);
    },
    [isTV]
  );

  return (
    <HomeScrollContext.Provider
      value={{
        scrollToTop,
        scrollToSection,
        setSectionIndexMap,
        lastScrolledIndex,
        listRef,
      }}>
      {children}
    </HomeScrollContext.Provider>
  );
}

/**
 * Hook to access home screen scroll functionality.
 * Must be used within a HomeScrollProvider.
 */
export function useHomeScroll(): HomeScrollContextValue {
  const context = useContext(HomeScrollContext);
  if (!context) {
    throw new Error('useHomeScroll must be used within a HomeScrollProvider');
  }
  return context;
}
