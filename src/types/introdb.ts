/**
 * IntroDB API types
 * @see https://introdb.app
 */

/**
 * Response from the IntroDB /intro endpoint
 */
export interface IntroData {
    /** IMDb ID */
    imdb_id: string;
    /** Season number */
    season: number;
    /** Episode number */
    episode: number;
    /** Intro start time in milliseconds */
    start_ms: number;
    /** Intro end time in milliseconds */
    end_ms: number;
    /** Confidence score (0-1) based on submission agreement */
    confidence: number;
    /** Number of submissions that contributed to this aggregate */
    submission_count: number;
}

/**
 * Error response from IntroDB API
 */
export interface IntroDbError {
    error: string;
}
