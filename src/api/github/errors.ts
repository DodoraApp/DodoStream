/**
 * Custom error class for GitHub API errors.
 */
export class GithubApiError extends Error {
    constructor(
        message: string,
        public readonly statusCode?: number,
        public readonly endpoint?: string,
        public readonly originalError?: unknown
    ) {
        super(message);
        this.name = 'GithubApiError';

        if (typeof (Error as any).captureStackTrace === 'function') {
            (Error as any).captureStackTrace(this, GithubApiError);
        }
    }

    static fromResponse(response: Response, endpoint: string): GithubApiError {
        return new GithubApiError(
            `Request failed: ${response.status} ${response.statusText}`,
            response.status,
            endpoint
        );
    }

    static fromError(error: unknown, endpoint: string, message?: string): GithubApiError {
        const errorMessage =
            message ?? (error instanceof Error ? error.message : 'An unknown error occurred');

        return new GithubApiError(errorMessage, undefined, endpoint, error);
    }
}
