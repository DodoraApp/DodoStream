/**
 * Custom error class for Stremio API errors.
 * Provides structured error information for better error handling and debugging.
 */
export class StremioApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly endpoint?: string,
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = 'StremioApiError';

    // Maintains proper stack trace for where error was thrown (only in V8 engines)
    if (typeof (Error as any).captureStackTrace === 'function') {
      (Error as any).captureStackTrace(this, StremioApiError);
    }
  }

  /**
   * Creates a StremioApiError from a fetch response.
   */
  static fromResponse(response: Response, endpoint: string): StremioApiError {
    return new StremioApiError(
      `Request failed: ${response.status} ${response.statusText}`,
      response.status,
      endpoint
    );
  }

  /**
   * Creates a StremioApiError from an unknown error.
   */
  static fromError(error: unknown, endpoint: string, message?: string): StremioApiError {
    const errorMessage =
      message ?? (error instanceof Error ? error.message : 'An unknown error occurred');

    return new StremioApiError(errorMessage, undefined, endpoint, error);
  }
}
