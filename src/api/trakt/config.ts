import Constants from 'expo-constants';

export const TRAKT_CLIENT_ID = process.env.EXPO_PUBLIC_TRAKT_CLIENT_ID ?? 'UNDEFINED';
export const TRAKT_CLIENT_SECRET = process.env.EXPO_PUBLIC_TRAKT_CLIENT_SECRET ?? 'UNDEFINED';
export const TRAKT_APP_NAME: string = Constants.expoConfig?.name ?? 'DodoStream';

export const TRAKT_ACTIVATE_URL = 'https://trakt.tv/activate';
export const TRAKT_ACTIVATE_DOMAIN = 'trakt.tv/activate';
