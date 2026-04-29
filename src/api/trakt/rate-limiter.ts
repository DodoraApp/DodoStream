/**
 * strict rate-limiter for trakt API:
 * 1/sec POST, 1000/5min GET
 */
import { createDebugLogger } from '@/utils/debug';

const debug = createDebugLogger('TraktRateLimiter');

class RateLimiter {
  private lastPostTime = 0;
  private retryAfter = 0;

  async throttlePost() {
    const now = Date.now();

    // Respect Retry-After header if set
    if (this.retryAfter > now) {
      const waitTime = this.retryAfter - now;
      debug('throttlePost', `waiting for Retry-After: ${waitTime}ms`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    const diff = Date.now() - this.lastPostTime;
    if (diff < 1000) {
      await new Promise((resolve) => setTimeout(resolve, 1000 - diff));
    }
    this.lastPostTime = Date.now();
  }

  setRetryAfter(seconds: number) {
    this.retryAfter = Date.now() + seconds * 1000;
  }
}

export const traktRateLimiter = new RateLimiter();
