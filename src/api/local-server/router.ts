import type { HttpRequest, HttpResponse } from 'react-native-nitro-http-server';

import {
  deleteAddon,
  getProfileAddons,
  getProfiles,
  installAddon,
  patchProfileAddon,
  reorderProfileAddons,
} from './handlers';

// ─── Helpers ────────────────────────────────────────────────────────────────

function json(statusCode: number, body: unknown): HttpResponse {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  };
}

function toResponse(result: { status: number; body?: unknown }): HttpResponse {
  if (result.status === 204) {
    return { statusCode: 204, headers: {}, body: '' };
  }
  return json(result.status, result.body ?? {});
}

function parseBody(raw: string | undefined): unknown {
  if (!raw) return {};
  return JSON.parse(raw) as unknown;
}

function getAuthPin(req: HttpRequest, rawPath: string): string {
  const authHeader =
    Object.entries(req.headers).find(([k]) => k.toLowerCase() === 'authorization')?.[1] ?? '';
  if (authHeader.startsWith('Bearer ')) return authHeader.slice(7);
  const qs = rawPath.includes('?') ? rawPath.slice(rawPath.indexOf('?') + 1) : '';
  return new URLSearchParams(qs).get('pin') ?? '';
}

// ─── Route table ────────────────────────────────────────────────────────────

type RouteHandler = (
  params: Record<string, string>,
  req: HttpRequest
) => Promise<HttpResponse> | HttpResponse;

interface Route {
  method: string;
  pattern: RegExp;
  paramNames: string[];
  handler: RouteHandler;
}

function route(method: string, path: string, handler: RouteHandler): Route {
  // Convert :param segments to named capture groups
  const paramNames: string[] = [];
  const regexStr = path.replace(/:([^/]+)/g, (_, name: string) => {
    paramNames.push(name);
    return '([^/]+)';
  });
  return { method, pattern: new RegExp(`^${regexStr}$`), paramNames, handler };
}

const ROUTES: Route[] = [
  route('GET', '/api/v1/profiles', () => toResponse(getProfiles())),
  route('GET', '/api/v1/profiles/:profileId/addons', ({ profileId }) =>
    toResponse(getProfileAddons(decodeURIComponent(profileId)))
  ),
  route('POST', '/api/v1/addons', (_, req) => installAddon(parseBody(req.body)).then(toResponse)),
  route('DELETE', '/api/v1/addons/:addonId', ({ addonId }) =>
    toResponse(deleteAddon(decodeURIComponent(addonId)))
  ),
  route('PATCH', '/api/v1/profiles/:profileId/addons/:addonId', ({ profileId, addonId }, req) =>
    toResponse(
      patchProfileAddon(
        decodeURIComponent(profileId),
        decodeURIComponent(addonId),
        parseBody(req.body)
      )
    )
  ),
  route('PUT', '/api/v1/profiles/:profileId/addons/order', ({ profileId }, req) =>
    toResponse(reorderProfileAddons(decodeURIComponent(profileId), parseBody(req.body)))
  ),
];

// ─── Router factory ─────────────────────────────────────────────────────────

export function createRouter(pin: string, webUiHtml: string) {
  return async (req: HttpRequest): Promise<HttpResponse> => {
    const method = req.method.toUpperCase();
    const rawPath = req.path ?? '/';
    const path = rawPath.split('?')[0].replace(/\/+$/, '') || '/';

    // Serve web UI
    if (method === 'GET' && path === '/') {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        body: webUiHtml,
      };
    }

    // Auth check for API routes
    if (path.startsWith('/api/')) {
      if (getAuthPin(req, rawPath) !== pin) {
        return json(401, { error: 'Unauthorized' });
      }
    }

    // Match route table
    for (const { method: m, pattern, paramNames, handler } of ROUTES) {
      if (m !== method) continue;
      const match = pattern.exec(path);
      if (!match) continue;

      const params = Object.fromEntries(paramNames.map((name, i) => [name, match[i + 1]]));
      try {
        return await handler(params, req);
      } catch (err) {
        if (err instanceof SyntaxError) return json(400, { error: 'Invalid JSON body' });
        return json(500, { error: 'Internal server error' });
      }
    }

    return json(404, { error: 'Not found' });
  };
}
