import { getAllItems, getPinCode, getUserSettings } from '../client';

jest.mock('@/api/simkl/config', () => ({
  SIMKL_CLIENT_ID: 'test-client-id',
  SIMKL_APP_NAME: 'dodostream',
}));

jest.mock('@/hooks/useAppInfo', () => ({
  getInstalledAppVersion: jest.fn(() => '1.0.0'),
}));

const mockFetch = jest.fn();

function mockResponse(data: unknown, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(data),
  });
}

describe('simkl client', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  it('getPinCode sends correct URL with client_id and app params', async () => {
    // Arrange
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        result: 'OK',
        device_code: 'device-abc',
        user_code: 'USER1',
        verification_url: 'https://simkl.com/pin/',
        expires_in: 900,
        interval: 5,
      })
    );

    // Act
    await getPinCode('client-123');

    // Assert
    const calledUrl = String(mockFetch.mock.calls[0][0]);
    const parsed = new URL(calledUrl);

    expect(parsed.pathname).toBe('/oauth/pin');
    expect(parsed.searchParams.get('client_id')).toBe('client-123');
    expect(parsed.searchParams.get('app-name')).toBe('dodostream');
    expect(parsed.searchParams.get('app-version')).toBe('1.0.0');
  });

  it('getUserSettings sends Authorization Bearer header', async () => {
    // Arrange
    mockFetch.mockResolvedValueOnce(
      mockResponse({ user: { name: 'U', avatar: undefined }, account: { id: 1 } })
    );

    // Act
    await getUserSettings('token-abc', 'client-id');

    // Assert
    const options = mockFetch.mock.calls[0][1] as RequestInit;
    const headers = options.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer token-abc');
  });

  it('getAllItems includes date_from when provided and omits when not provided', async () => {
    // Arrange
    mockFetch.mockResolvedValue(mockResponse({ movies: [] }));

    // Act
    await getAllItems('token-1', 'client-id', 'movies', '2026-01-01T00:00:00.000Z');
    await getAllItems('token-1', 'client-id', 'movies');

    // Assert
    const firstUrl = new URL(String(mockFetch.mock.calls[0][0]));
    const secondUrl = new URL(String(mockFetch.mock.calls[1][0]));

    expect(firstUrl.searchParams.get('date_from')).toBe('2026-01-01T00:00:00.000Z');
    expect(secondUrl.searchParams.get('date_from')).toBeNull();
  });

  it('simklFetch throws on non-ok response via exported function', async () => {
    // Arrange
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });

    // Act / Assert
    await expect(getUserSettings('bad-token', 'client-id')).rejects.toThrow('Simkl API error 500');
  });

  it('simklFetch includes User-Agent header', async () => {
    // Arrange
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        result: 'OK',
        device_code: 'device-xyz',
        user_code: 'USER2',
        verification_url: 'https://simkl.com/pin/',
        expires_in: 900,
        interval: 5,
      })
    );

    // Act
    await getPinCode('client-123');

    // Assert
    const options = mockFetch.mock.calls[0][1] as RequestInit;
    const headers = options.headers as Record<string, string>;
    expect(headers['User-Agent']).toBe('dodostream/1.0.0');
  });
});
