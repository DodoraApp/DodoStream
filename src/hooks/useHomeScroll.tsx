import { FlashListRef } from '@shopify/flash-list';
import { createContext, useContext, useCallback, useRef, ReactNode } from 'react';
import { Platform } from 'react-native';

interface HomeScrollContextValue {
  /** Scroll to the very top of the home screen (show hero section) */
  scrollToTop: () => void;
  /** Scroll to a specific section by key */
  scrollToSection: (sectionIndex: number) => void;
  /** FlashList ref for the home screen */
  flashListRef: React.RefObject<FlashListRef<any> | null>;
  lastScrolledIndex: React.RefObject<number | null>;
  /** Register the section index map for scrollToSection */
  setSectionIndexMap: (map: Record<string, number>) => void;
}

const HomeScrollContext = createContext<HomeScrollContextValue | null>(null);

interface HomeScrollProviderProps {
  children: ReactNode;
}

// Debounce delay for scroll operations to prevent jitter during fast navigation
const SCROLL_DEBOUNCE_MS = 100;

/**
 * Provider for home screen scroll functionality.
 * Enables child components to scroll the home FlashList.
 */
export function HomeScrollProvider({ children }: HomeScrollProviderProps) {
  const flashListRef = useRef<FlashListRef<any> | null>(null);
  const sectionIndexMapRef = useRef<Record<string, number>>({});
  const lastScrolledIndex = useRef<number | null>(null);
  const isTV = Platform.isTV;

  const setSectionIndexMap = useCallback((map: Record<string, number>) => {
    sectionIndexMapRef.current = map;
  }, []);

  const scrollToTop = useCallback(() => {
    if (!isTV) return;
    // Reset last scrolled key since we're going to top
    lastScrolledIndex.current = null;
    flashListRef.current?.scrollToOffset({
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
      flashListRef.current?.scrollToIndex({
        index: sectionIndex,
        animated: false,
        viewPosition: 0.5,
      });
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
        flashListRef,
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
