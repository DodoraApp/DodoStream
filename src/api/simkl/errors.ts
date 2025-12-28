export class SimklApiError extends Error {
    constructor(
        message: string,
        public readonly statusCode?: number,
        public readonly endpoint?: string,
        public readonly originalError?: unknown
    ) {
        super(message);
        this.name = 'SimklApiError';

        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, SimklApiError);
        }
    }

    static fromResponse(response: Response, endpoint: string): SimklApiError {
        return new SimklApiError(
            `Request failed: ${response.status} ${response.statusText}`,
            response.status,
            endpoint
        );
    }

    static fromError(error: unknown, endpoint: string, message?: string): SimklApiError {
        const errorMessage =
            message ?? (error instanceof Error ? error.message : 'An unknown error occurred');
        return new SimklApiError(errorMessage, undefined, endpoint, error);
    }
}
