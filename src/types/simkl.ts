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

export interface SimklActivityCategory {
  all: string;
  rated_at?: string | object;
  playback?: string | object;
  plantowatch?: string | object;
  watching?: string | object;
  completed?: string | object;
  hold?: string | object;
  dropped?: string | object;
  removed_from_list?: string | object;
}

export interface SimklActivities {
  movies?: SimklActivityCategory;
  tv_shows?: SimklActivityCategory;
  anime?: SimklActivityCategory;
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
  added_to_watchlist_at?: string;
  status?: SimklStatus;
  last_watched?: string;
  next_to_watch?: string;
  watched_episodes_count?: number;
  movie?: { ids: SimklIds; title: string; poster?: string; year?: number };
  show?: { ids: SimklIds; title: string; poster?: string; year?: number };
  anime?: { ids: SimklIds; title: string; poster?: string; year?: number };
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
