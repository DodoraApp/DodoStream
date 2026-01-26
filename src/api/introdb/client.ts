import type { IntroData } from '@/types/introdb';

const INTRODB_API_BASE_URL = 'https://api.introdb.app';

/**
 * IntroDB API error class
 */
export class IntroDbApiError extends Error {
    constructor(
        message: string,
        public readonly status?: number,
        public readonly endpoint?: string
    ) {
        super(message);
        this.name = 'IntroDbApiError';
    }

    static fromResponse(response: Response, endpoint: string): IntroDbApiError {
        return new IntroDbApiError(
            `IntroDB API error: ${response.statusText}`,
            response.status,
            endpoint
        );
    }
}

/**
 * Fetches intro timestamps for a TV show episode from IntroDB
 * @param imdbId - IMDb ID of the show (e.g., 'tt0944947')
 * @param season - Season number (starting from 1)
 * @param episode - Episode number (starting from 1)
 * @returns Intro data with start/end timestamps, or null if not found
 * @throws IntroDbApiError if the request fails (except 404)
 */
export async function fetchIntro(
    imdbId: string,
    season: number,
    episode: number
): Promise<IntroData | null> {
    const url = `${INTRODB_API_BASE_URL}/intro?imdb_id=${encodeURIComponent(imdbId)}&season=${season}&episode=${episode}`;

    const response = await fetch(url, {
        headers: {
            Accept: 'application/json',
        },
    });

    // 404 means no intro data found - not an error
    if (response.status === 404) {
        return null;
    }

    if (!response.ok) {
        throw IntroDbApiError.fromResponse(response, url);
    }

    const data: IntroData = await response.json();
    return data;
}
