import { useEffect, useRef } from 'react';
import { BackHandler, Platform } from 'react-native';

/**
 * Hook to handle TV remote back button
 * Calls the provided callback when back button is pressed on TV
 */
export function useTVBackButton(onBackPress?: () => boolean | null | undefined) {
  const onBackPressRef = useRef(onBackPress);
  onBackPressRef.current = onBackPress;

  useEffect(() => {
    if (!Platform.isTV) return;

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      const handled = onBackPressRef.current?.();
      // Return true if handled, false to let default behavior occur
      return handled ?? false;
    });

    return () => {
      backHandler.remove();
    };
  }, []);
}
