export interface SimklPinResponse {
  result: string;
  device_code: string;
  user_code: string;
  verification_url: string;
  expires_in: number;
  interval: number;
}

export interface SimklPinStatusResponse {
  result: 'OK' | 'KO';
  access_token?: string;
  message?: string;
}

export interface SimklUserSettings {
  user: {
    name: string;
    avatar?: string;
  };
  account: {
    id: number;
    timezone?: string;
    type?: string;
  };
}

export interface SimklActivities {
  all: string;
  movies?: { all: string };
  tv_shows?: { all: string };
  anime?: { all: string };
}

export interface SimklIds {
  simkl?: number;
  imdb?: string;
  tmdb?: number;
  tvdb?: number;
  mal?: number;
  kitsu?: number;
}

export interface SimklMediaItem {
  type: 'movie' | 'tv' | 'anime';
  title: string;
  year?: number;
  poster?: string;
  status?: string;
  ids: SimklIds;
  total_episodes?: number;
}

export type SimklStatus = 'watching' | 'plantowatch' | 'hold' | 'dropped' | 'completed';

export interface SimklWatchedItem {
  last_watched_at?: string;
  added_at?: string;
  status?: SimklStatus;
  watched_episodes_count?: number;
  movie?: { ids: SimklIds; title: string };
  show?: { ids: SimklIds; title: string };
  seasons?: {
    number: number;
    episodes: { number: number; watched_at?: string }[];
  }[];
  episodes?: { number: number; watched_at?: string }[];
}

export interface SimklAllItemsResponse {
  movies?: SimklWatchedItem[] | null;
  shows?: SimklWatchedItem[] | null;
  anime?: SimklWatchedItem[] | null;
}
