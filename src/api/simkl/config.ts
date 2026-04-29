import Constants from 'expo-constants';

export const SIMKL_CLIENT_ID = process.env.EXPO_PUBLIC_SIMKL_CLIENT_ID ?? 'UNDEFINED';
export const SIMKL_APP_NAME: string = Constants.expoConfig?.name ?? 'DodoStream';

export const SIMKL_PIN_URL = 'https://simkl.com/pin';
export const SIMKL_PIN_DOMAIN = 'simkl.com/pin';
