import { getSimklClientId } from '@/utils/env';
import { createDebugLogger } from '@/utils/debug';
import { SimklApiError } from '@/api/simkl/errors';

const debug = createDebugLogger('SimklApi');

const SIMKL_API_BASE_URL = 'https://api.simkl.com';

export interface SimklRequestOptions {
    method?: 'GET' | 'POST' | 'DELETE';
    token?: string;
    query?: Record<string, string | number | boolean | undefined | null>;
    body?: unknown;
}

const buildQuery = (query?: SimklRequestOptions['query']): string => {
    if (!query) return '';
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
        if (value === undefined || value === null) continue;
        params.set(key, String(value));
    }
    const s = params.toString();
    return s.length > 0 ? `?${s}` : '';
};

export const simklRequest = async <T>(path: string, options: SimklRequestOptions = {}): Promise<T> => {
    const method = options.method ?? 'GET';
    const clientId = getSimklClientId();

    const query = { ...options.query };
    // Many Simkl endpoints accept client_id as a query parameter.
    // We still also send simkl-api-key for token-required endpoints.
    if (!('client_id' in query)) {
        query.client_id = clientId;
    }

    const url = `${SIMKL_API_BASE_URL}${path}${buildQuery(query)}`;

    const headers: Record<string, string> = {
        Accept: 'application/json',
    };

    if (options.token) {
        headers.Authorization = `Bearer ${options.token}`;
        headers['simkl-api-key'] = clientId;
    }

    const init: RequestInit = {
        method,
        headers,
    };

    if (options.body !== undefined) {
        headers['Content-Type'] = 'application/json';
        init.body = JSON.stringify(options.body);
    }

    debug('request', { method, path, url, hasToken: !!options.token });

    let response: Response;
    try {
        response = await fetch(url, init);
    } catch (error) {
        throw SimklApiError.fromError(error, url);
    }

    if (!response.ok) {
        throw SimklApiError.fromResponse(response, url);
    }

    // 204 responses have no body.
    if (response.status === 204) {
        return undefined as T;
    }

    try {
        return (await response.json()) as T;
    } catch (error) {
        throw SimklApiError.fromError(error, url, 'Failed to parse JSON');
    }
};
