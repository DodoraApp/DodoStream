import Constants from 'expo-constants';

export const SIMKL_CLIENT_ID = process.env.EXPO_PUBLIC_SIMKL_CLIENT_ID ?? 'UNDEFINED';
export const SIMKL_APP_NAME: string = Constants.expoConfig?.name ?? 'DodoStream';
