
export const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
// Only when Sentry dsn is explicitly set (not in the default releases)
export const isSentryEnabled = !!SENTRY_DSN;