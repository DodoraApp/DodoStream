export type SimklIdObject = {
    simkl?: number;
    imdb?: string;
    tmdb?: number | string;
    tvdb?: number | string;
    mal?: number | string;
};

export interface SimklMovieRef {
    title?: string;
    year?: number;
    ids: SimklIdObject;
}

export interface SimklShowRef {
    title?: string;
    year?: number;
    ids: SimklIdObject;
}

export interface SimklEpisodeRef {
    season: number;
    number: number;
}

export interface SimklPinCodeResponse {
    result?: 'OK' | 'KO';
    /** User code the user types on simkl.com/pin */
    user_code?: string;
    /** URL user should open (often https://simkl.com/pin/) */
    verification_url?: string;
    /** Optional: seconds until expiry */
    expires_in?: number;
    /** Optional: recommended polling interval in seconds */
    interval?: number;
    message?: string;
}

export interface SimklPinPollResponse {
    result?: 'OK' | 'KO';
    message?: string;
    access_token?: string;
}

export interface SimklScrobbleResponse {
    id?: number;
    action?: 'start' | 'pause' | 'scrobble';
    progress?: number;
    watched_at?: string;
    expires_at?: string;
}

export interface SimklActivitiesResponse {
    all?: string;
    settings?: { all?: string };
    movies?: Record<string, string | null>;
    tv_shows?: Record<string, string | null>;
    anime?: Record<string, string | null>;
}

export interface SimklPlaybackItem {
    id: number;
    type: 'movie' | 'episode';
    progress: number;
    paused_at?: string;
    movie?: { ids?: SimklIdObject };
    show?: { ids?: SimklIdObject };
    anime?: { ids?: SimklIdObject };
    episode?: { season?: number; number?: number };
}

// ---------- /sync/all-items response types ----------

export interface SimklWatchedEpisode {
    number: number;
    watched_at?: string;
}

export interface SimklWatchedSeason {
    number: number;
    episodes?: SimklWatchedEpisode[];
}

/** A show or anime item from the /sync/all-items response */
export interface SimklAllItemsShow {
    show?: {
        title?: string;
        year?: number;
        ids?: SimklIdObject;
    };
    /** Present for anime items */
    anime?: {
        title?: string;
        year?: number;
        ids?: SimklIdObject;
        anime_type?: string;
    };
    status?: 'watching' | 'plantowatch' | 'completed' | 'hold' | 'dropped';
    last_watched_at?: string;
    seasons?: SimklWatchedSeason[];
    /** If extended=full, flat episode list */
    watched?: SimklWatchedEpisode[];
    total_episodes_count?: number;
    watched_episodes_count?: number;
}

/** A movie item from the /sync/all-items response */
export interface SimklAllItemsMovie {
    movie?: {
        title?: string;
        year?: number;
        ids?: SimklIdObject;
    };
    status?: 'watching' | 'plantowatch' | 'completed' | 'hold' | 'dropped';
    last_watched_at?: string;
}

/** Combined response from /sync/all-items */
export interface SimklAllItemsResponse {
    shows?: SimklAllItemsShow[];
    anime?: SimklAllItemsShow[];
    movies?: SimklAllItemsMovie[];
}
