import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

const DEFAULT_SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';

interface DeveloperState {
    sentryDsn: string;
    setSentryDsn: (dsn: string) => void;
    resetSentryDsn: () => void;
}

export const useDeveloperStore = create<DeveloperState>()(
    persist(
        (set) => ({
            sentryDsn: DEFAULT_SENTRY_DSN,
            setSentryDsn: (dsn) => set({ sentryDsn: dsn }),
            resetSentryDsn: () => set({ sentryDsn: DEFAULT_SENTRY_DSN }),
        }),
        {
            name: 'developer-storage',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({ sentryDsn: state.sentryDsn }),
        }
    )
);

/**
 * Get the current Sentry DSN synchronously.
 * This should be used during app initialization before React renders.
 */
export function getSentryDsn(): string {
    const state = useDeveloperStore.getState();
    return state.sentryDsn || DEFAULT_SENTRY_DSN;
}

/**
 * Check if Sentry is enabled based on the current DSN.
 */
export function isSentryEnabled(): boolean {
    return !!getSentryDsn();
}
