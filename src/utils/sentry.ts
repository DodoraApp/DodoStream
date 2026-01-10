import { getSentryDsn, isSentryEnabled as checkSentryEnabled } from '@/store/developer.store';

/**
 * Get the Sentry DSN from the developer store.
 * Falls back to the env variable if the store value is empty.
 */
export const SENTRY_DSN = getSentryDsn();

/**
 * Check if Sentry is enabled based on the current DSN.
 * Only enabled when a Sentry DSN is explicitly set.
 */
export const isSentryEnabled = checkSentryEnabled();