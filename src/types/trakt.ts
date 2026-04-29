import { imagesResponseSchema } from 'trakt-api/projects/api/src/contracts/_internal/response/imagesResponseSchema.ts';
import type { z } from 'trakt-api/projects/api/src/contracts/_internal/z.ts';
import type {
  HistoryAddRequest,
  HistoryRemoveResponse,
  HistoryResponse,
  ListedMovieResponse as TraktListedMovieResponse,
  ListedShowResponse as TraktListedShowResponse,
  ListRemoveResponse,
  MovieResponse,
  OAuthDeviceCodeResponse,
  OAuthTokenResponse,
  SettingsResponse,
  ShowResponse,
  WatchedMoviesResponse,
  WatchedShowsResponse,
} from 'trakt-api/projects/api/src/index.ts';

export type TraktDeviceCodeResponse = OAuthDeviceCodeResponse;
export type TraktTokenResponse = OAuthTokenResponse;
export type TraktUserSettings = SettingsResponse;
export type TraktSyncItem = HistoryAddRequest;
export type TraktSyncResponse = HistoryResponse;
export type TraktHistoryRemoveResponse = HistoryRemoveResponse;
export type TraktListRemoveResponse = ListRemoveResponse;

export type TraktImages = z.infer<typeof imagesResponseSchema>;

export type TraktWatchedMovie = WatchedMoviesResponse[number] & {
  movie: { images?: TraktImages };
};
export type TraktWatchedShow = WatchedShowsResponse[number] & {
  show: { images?: TraktImages };
};

export type ListedMovieResponse = TraktListedMovieResponse & {
  movie: { images?: TraktImages };
};
export type ListedShowResponse = TraktListedShowResponse & {
  show: { images?: TraktImages };
};

export type TraktWatchlistItem = ListedMovieResponse | ListedShowResponse;

export type TraktIds = Partial<MovieResponse['ids'] & ShowResponse['ids']>;

export type TraktSyncShow = NonNullable<TraktSyncItem['shows']>[number];
export type TraktSyncSeason = NonNullable<
  TraktSyncShow extends { seasons?: any } ? TraktSyncShow['seasons'] : never
>[number];
