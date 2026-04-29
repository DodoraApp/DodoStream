import { traktRateLimiter } from '../rate-limiter';

describe('Trakt Rate Limiter', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // Reset rate limiter state for tests (we access private members via any)
    (traktRateLimiter as any).lastPostTime = 0;
    (traktRateLimiter as any).retryAfter = 0;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('throttles POST requests to 1 per second', async () => {
    const promise1 = traktRateLimiter.throttlePost();

    // First call should resolve immediately
    await expect(promise1).resolves.toBeUndefined();

    // Advance time by 100ms
    jest.advanceTimersByTime(100);

    // Second call should block
    let resolved = false;
    const promise2 = traktRateLimiter.throttlePost().then(() => {
      resolved = true;
    });

    // Allow promise chain to process
    await Promise.resolve();
    expect(resolved).toBe(false);

    // Advance time past the 1 second mark (1000 - 100 = 900)
    jest.advanceTimersByTime(900);

    // Now it should resolve
    await promise2;
    expect(resolved).toBe(true);
  });

  it('respects setRetryAfter', async () => {
    // Set retry after 5 seconds
    traktRateLimiter.setRetryAfter(5);

    let resolved = false;
    const promise = traktRateLimiter.throttlePost().then(() => {
      resolved = true;
    });

    // Advance time by 4 seconds
    jest.advanceTimersByTime(4000);
    await Promise.resolve();
    expect(resolved).toBe(false);

    // Advance remaining 1 second
    jest.advanceTimersByTime(1000);
    await promise;
    expect(resolved).toBe(true);
  });
});
