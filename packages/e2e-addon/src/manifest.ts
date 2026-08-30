import type {
  ContentType,
  Manifest,
  ManifestCatalog,
  ManifestConfig,
  ManifestExtra,
  FullManifestResource,
} from 'stremio-addon-sdk';

import { CATALOG_IDS, FIXTURE_ID_PREFIX } from './fixture';

export const ADDON_ID = 'com.dodostream.e2e-fixture';
export const ADDON_VERSION = '1.0.0';

const MEDIA_TYPES: ContentType[] = ['movie', 'series', 'channel', 'tv'];

const asset = (publicBaseUrl: string, path: string): string =>
  `${publicBaseUrl.replace(/\/$/, '')}/assets/${path}`;

const genres = [
  'Drama',
  'Thriller',
  'Sci-Fi',
  'Documentary',
  'Comedy',
  'Horror',
  'Adventure',
  'Mystery',
];

const catalogExtra = (genres: string[]): ManifestExtra[] => [
  { name: 'search' },
  { name: 'genre', options: genres },
  { name: 'skip' },
];

const catalogs: ManifestCatalog[] = [
  {
    type: 'movie',
    id: CATALOG_IDS.movies,
    name: 'DodoStream Movies',
    extra: catalogExtra(genres),
  },
  {
    type: 'series',
    id: CATALOG_IDS.series,
    name: 'DodoStream Series',
    extra: catalogExtra(genres),
  },
  {
    type: 'movie',
    id: CATALOG_IDS.edge,
    name: 'DodoStream Edge Cases',
    extra: catalogExtra(genres),
  },
];

const resources: FullManifestResource[] = [
  { name: 'catalog', types: MEDIA_TYPES, idPrefixes: [FIXTURE_ID_PREFIX] },
  { name: 'meta', types: MEDIA_TYPES, idPrefixes: [FIXTURE_ID_PREFIX] },
  { name: 'stream', types: MEDIA_TYPES, idPrefixes: [FIXTURE_ID_PREFIX] },
  { name: 'subtitles', types: ['movie', 'series'], idPrefixes: [FIXTURE_ID_PREFIX] },
  { name: 'addon_catalog', types: ['movie', 'series'] },
];

const config: ManifestConfig[] = [
  {
    key: 'server_name',
    type: 'text',
    title: 'Server Name',
    default: 'DodoStream E2E',
  },
  {
    key: 'max_results',
    type: 'number',
    title: 'Max Results',
    default: '100',
  },
  {
    key: 'api_key',
    type: 'password',
    title: 'API Key',
    default: '',
  },
  {
    key: 'enable_surprises',
    type: 'checkbox',
    title: 'Enable Surprises',
    default: 'checked',
  },
  {
    key: 'region',
    type: 'select',
    title: 'Region',
    default: 'North America',
    options: ['North America', 'Europe', 'Asia'],
  },
];

/**
 * Build the fixture manifest. Asset URLs are resolved against the server's
 * public base URL so the emulator (10.0.2.2) and local (127.0.0.1) both work.
 */
export const createManifest = (publicBaseUrl: string): Manifest => ({
  id: ADDON_ID,
  name: 'DodoStream E2E Fixture',
  description:
    'Deterministic catalog, metadata, streams, subtitles and addon catalog for DodoStream UI automation and visual regression.',
  version: ADDON_VERSION,
  types: MEDIA_TYPES,
  resources,
  catalogs,
  idPrefixes: [FIXTURE_ID_PREFIX],
  behaviorHints: {
    configurable: true,
    configurationRequired: false,
  },
  config,
  logo: asset(publicBaseUrl, 'logo-addon.png'),
  background: asset(publicBaseUrl, 'background-addon.png'),
  contactEmail: 'e2e@dodostream.example',
});
