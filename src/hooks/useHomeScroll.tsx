import { HERO_HEIGHT } from '@/constants/ui';
import { createContext, useContext, useCallback, useRef, ReactNode } from 'react';
import { Platform, SectionList, View } from 'react-native';

interface HomeScrollContextValue {
  /** Scroll to the very top of the home screen (show hero section) */
  scrollToTop: () => void;
  /** Scroll to a specific section by key */
  scrollToSection: (sectionKey: string) => void;
  sectionListRef: React.RefObject<SectionList<any, any> | null>;
  /** Register the section index map for scrollToSection */
  setSectionIndexMap: (map: Record<string, number>) => void;
}

const HomeScrollContext = createContext<HomeScrollContextValue | null>(null);

interface HomeScrollProviderProps {
  children: ReactNode;
}

/**
 * Provider for home screen scroll functionality.
 * Enables child components to scroll the home SectionList.
 */
export function HomeScrollProvider({ children }: HomeScrollProviderProps) {
  const sectionListRef = useRef<SectionList<any, any> | null>(null);
  const sectionIndexMapRef = useRef<Record<string, number>>({});
  const lastScrolledKeyRef = useRef<string | null>(null);
  const isTV = Platform.isTV;

  const setSectionIndexMap = useCallback((map: Record<string, number>) => {
    sectionIndexMapRef.current = map;
  }, []);

  const scrollToTop = useCallback(() => {
    if (!isTV) return;
    // Reset last scrolled key since we're going to top
    lastScrolledKeyRef.current = null;
    sectionListRef.current?.scrollToLocation({
      sectionIndex: 0,
      itemIndex: 0,
      viewPosition: 0,
      viewOffset: HERO_HEIGHT,
      animated: true,
    });
  }, [isTV]);

  const scrollToSection = useCallback(
    (sectionKey: string) => {
      if (!isTV) return;
      // Prevent duplicate scrolls to same section
      if (lastScrolledKeyRef.current === sectionKey) return;
      lastScrolledKeyRef.current = sectionKey;

      const sectionIndex = sectionIndexMapRef.current[sectionKey];
      if (sectionIndex === undefined) return;

      sectionListRef.current?.scrollToLocation({
        sectionIndex,
        itemIndex: 0,
        viewPosition: 0,
        viewOffset: 0,
        animated: true,
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
        sectionListRef,
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
