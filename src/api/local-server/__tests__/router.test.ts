import type { HttpRequest } from 'react-native-nitro-http-server';

import {
  deleteAddon,
  getProfileAddons,
  getProfiles,
  installAddon,
  patchProfileAddon,
  reorderProfileAddons,
} from '../handlers';
import { createRouter } from '../router';

jest.mock('../handlers', () => ({
  getProfiles: jest.fn(),
  getProfileAddons: jest.fn(),
  installAddon: jest.fn(),
  deleteAddon: jest.fn(),
  patchProfileAddon: jest.fn(),
  reorderProfileAddons: jest.fn(),
}));

function req(
  method: string,
  path: string,
  opts: { headers?: Record<string, string>; body?: string } = {}
): HttpRequest {
  return { requestId: '1', method, path, headers: opts.headers ?? {}, body: opts.body };
}

describe('local-server router', () => {
  const PIN = '123456';
  const HTML = '<html>test</html>';

  const getProfilesMock = jest.mocked(getProfiles);
  const getProfileAddonsMock = jest.mocked(getProfileAddons);
  const installAddonMock = jest.mocked(installAddon);
  const deleteAddonMock = jest.mocked(deleteAddon);
  const patchProfileAddonMock = jest.mocked(patchProfileAddon);
  const reorderProfileAddonsMock = jest.mocked(reorderProfileAddons);

  let router: ReturnType<typeof createRouter>;

  beforeEach(() => {
    jest.resetAllMocks();
    router = createRouter(PIN, HTML);

    getProfilesMock.mockReturnValue({ status: 200, body: { ok: true } });
    getProfileAddonsMock.mockReturnValue({ status: 200, body: { ok: true } });
    installAddonMock.mockResolvedValue({ status: 200, body: { ok: true } });
    deleteAddonMock.mockReturnValue({ status: 204 });
    patchProfileAddonMock.mockReturnValue({ status: 200, body: { ok: true } });
    reorderProfileAddonsMock.mockReturnValue({ status: 200, body: { ok: true } });
  });

  describe('Web UI', () => {
    it('GET / returns HTML page', async () => {
      // Arrange
      const request = req('GET', '/');

      // Act
      const response = await router(request);

      // Assert
      expect(response.statusCode).toBe(200);
      expect(response.headers?.['Content-Type']).toBe('text/html; charset=utf-8');
      expect(response.body).toBe(HTML);
    });

    it('GET / with trailing slash still serves web UI', async () => {
      // Arrange
      const request = req('GET', '///');

      // Act
      const response = await router(request);

      // Assert
      expect(response.statusCode).toBe(200);
      expect(response.headers?.['Content-Type']).toBe('text/html; charset=utf-8');
      expect(response.body).toBe(HTML);
    });
  });

  describe('Auth', () => {
    it('rejects /api route without auth', async () => {
      const response = await router(req('GET', '/api/v1/profiles'));

      expect(response.statusCode).toBe(401);
      expect(response.headers?.['Content-Type']).toBe('application/json; charset=utf-8');
      expect(response.body).toBe(JSON.stringify({ error: 'Unauthorized' }));
    });

    it('rejects wrong Bearer token', async () => {
      const response = await router(
        req('GET', '/api/v1/profiles', { headers: { Authorization: 'Bearer wrong' } })
      );

      expect(response.statusCode).toBe(401);
    });

    it('accepts correct Bearer token', async () => {
      const response = await router(
        req('GET', '/api/v1/profiles', { headers: { Authorization: `Bearer ${PIN}` } })
      );

      expect(response.statusCode).toBe(200);
    });

    it('accepts pin in query param', async () => {
      const response = await router(req('GET', `/api/v1/profiles?pin=${PIN}`));

      expect(response.statusCode).toBe(200);
    });

    it('rejects wrong pin in query param', async () => {
      const response = await router(req('GET', '/api/v1/profiles?pin=WRONG'));

      expect(response.statusCode).toBe(401);
    });

    it('accepts lowercase authorization header', async () => {
      const response = await router(
        req('GET', '/api/v1/profiles', { headers: { authorization: `Bearer ${PIN}` } })
      );

      expect(response.statusCode).toBe(200);
    });
  });

  describe('Route matching', () => {
    const auth = { Authorization: `Bearer ${PIN}` };

    it('GET /api/v1/profiles calls getProfiles', async () => {
      const response = await router(req('GET', '/api/v1/profiles', { headers: auth }));

      expect(response.statusCode).toBe(200);
      expect(getProfilesMock).toHaveBeenCalledTimes(1);
    });

    it('GET /api/v1/profiles/:profileId/addons calls getProfileAddons', async () => {
      const response = await router(req('GET', '/api/v1/profiles/p1/addons', { headers: auth }));

      expect(response.statusCode).toBe(200);
      expect(getProfileAddonsMock).toHaveBeenCalledWith('p1');
    });

    it('POST /api/v1/addons calls installAddon with parsed body', async () => {
      const payload = { transportUrl: 'https://example.com/addon' };

      const response = await router(
        req('POST', '/api/v1/addons', { headers: auth, body: JSON.stringify(payload) })
      );

      expect(response.statusCode).toBe(200);
      expect(installAddonMock).toHaveBeenCalledWith(payload);
    });

    it('DELETE /api/v1/addons/:addonId calls deleteAddon', async () => {
      const response = await router(req('DELETE', '/api/v1/addons/some-addon', { headers: auth }));

      expect(response.statusCode).toBe(204);
      expect(deleteAddonMock).toHaveBeenCalledWith('some-addon');
    });

    it('PATCH /api/v1/profiles/:profileId/addons/:addonId calls patchProfileAddon', async () => {
      const payload = { enabled: true };

      const response = await router(
        req('PATCH', '/api/v1/profiles/p1/addons/addon1', {
          headers: auth,
          body: JSON.stringify(payload),
        })
      );

      expect(response.statusCode).toBe(200);
      expect(patchProfileAddonMock).toHaveBeenCalledWith('p1', 'addon1', payload);
    });

    it('PUT /api/v1/profiles/:profileId/addons/order calls reorderProfileAddons', async () => {
      const payload = { addonIds: ['a1', 'a2'] };

      const response = await router(
        req('PUT', '/api/v1/profiles/p1/addons/order', {
          headers: auth,
          body: JSON.stringify(payload),
        })
      );

      expect(response.statusCode).toBe(200);
      expect(reorderProfileAddonsMock).toHaveBeenCalledWith('p1', payload);
    });

    it('unknown route returns 404', async () => {
      const response = await router(req('GET', '/api/v1/unknown', { headers: auth }));

      expect(response.statusCode).toBe(404);
      expect(response.headers?.['Content-Type']).toBe('application/json; charset=utf-8');
      expect(response.body).toBe(JSON.stringify({ error: 'Not found' }));
    });
  });

  describe('Error handling', () => {
    const auth = { Authorization: `Bearer ${PIN}` };

    it('returns 400 when handler throws SyntaxError', async () => {
      installAddonMock.mockRejectedValueOnce(new SyntaxError('invalid json'));

      const response = await router(
        req('POST', '/api/v1/addons', { headers: auth, body: JSON.stringify({ a: 1 }) })
      );

      expect(response.statusCode).toBe(400);
      expect(response.headers?.['Content-Type']).toBe('application/json; charset=utf-8');
      expect(response.body).toBe(JSON.stringify({ error: 'Invalid JSON body' }));
    });

    it('returns 500 when handler throws generic error', async () => {
      installAddonMock.mockRejectedValueOnce(new Error('boom'));

      const response = await router(
        req('POST', '/api/v1/addons', { headers: auth, body: JSON.stringify({ a: 1 }) })
      );

      expect(response.statusCode).toBe(500);
      expect(response.headers?.['Content-Type']).toBe('application/json; charset=utf-8');
      expect(response.body).toBe(JSON.stringify({ error: 'Internal server error' }));
    });
  });

  describe('Response format', () => {
    const auth = { Authorization: `Bearer ${PIN}` };

    it('204 response has empty body', async () => {
      const response = await router(req('DELETE', '/api/v1/addons/some-addon', { headers: auth }));

      expect(response.statusCode).toBe(204);
      expect(response.body).toBe('');
      expect(response.headers).toEqual({});
    });

    it('JSON responses have application/json content type', async () => {
      const response = await router(req('GET', '/api/v1/profiles', { headers: auth }));

      expect(response.statusCode).toBe(200);
      expect(response.headers?.['Content-Type']).toBe('application/json; charset=utf-8');
      expect(response.body).toBe(JSON.stringify({ ok: true }));
    });
  });
});
