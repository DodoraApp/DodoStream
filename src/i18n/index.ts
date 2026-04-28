import { initReactI18next } from 'react-i18next';

import * as Localization from 'expo-localization';
import i18n from 'i18next';

/**
 * Dynamically load all translation files from the translations directory.
 * Using require.context (provided by Metro/Expo) to find all .json files.
 */
// @ts-ignore - require.context is a Metro extension
const context = require.context('./', true, /\.json$/);

export const resources: Record<string, any> = {};
const namespaces = new Set<string>();

context.keys().forEach((key: string) => {
  // Key format: "./en/common.json"
  const parts = key.split('/');
  if (parts.length < 3) return;

  const lang = parts[1];
  const ns = parts[2].replace('.json', '');

  if (!resources[lang]) {
    resources[lang] = {};
  }

  resources[lang][ns] = context(key);
  namespaces.add(ns);
});

export const AVAILABLE_LANGUAGES = Object.keys(resources);

// Get device locale
const deviceLocale = Localization.getLocales()?.[0]?.languageCode ?? 'en';

// eslint-disable-next-line import/no-named-as-default-member
i18n.use(initReactI18next).init({
  resources,
  lng: deviceLocale,
  fallbackLng: 'en',
  ns: Array.from(namespaces),
  defaultNS: 'common',
  interpolation: {
    escapeValue: false, // react already safes from xss
  },
  compatibilityJSON: 'v4', // Essential for React Native
});

export default i18n;
