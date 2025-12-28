import { createDebugLogger } from '@/utils/debug';

const debug = createDebugLogger('env');

/**
 * Get Simkl client ID from environment
 * @throws if not configured
 */
export const getSimklClientId = (): string => {
    const value = process.env.EXPO_PUBLIC_SIMKL_CLIENT_ID;
    if (typeof value !== 'string' || value.trim().length === 0) {
        debug('missingEnv', { key: 'EXPO_PUBLIC_SIMKL_CLIENT_ID' });
        throw new Error('Missing required env var: EXPO_PUBLIC_SIMKL_CLIENT_ID');
    }
    return value;
};

/**
 * Check if Simkl is configured
 */
export const isSimklConfigured = (): boolean => {
    const value = process.env.EXPO_PUBLIC_SIMKL_CLIENT_ID;
    return typeof value === 'string' && value.trim().length > 0;
};
