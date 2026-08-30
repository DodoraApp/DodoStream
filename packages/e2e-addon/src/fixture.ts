/**
 * Deterministic Stremio fixture generator.
 *
 * Everything here is a pure function of `seed`: no wall-clock time, no
 * `Math.random`, no network access. Asset URLs are emitted as *relative*
 * paths under `assets/` so the HTTP server can resolve them against its
 * public base URL (which differs between `127.0.0.1` and the Android
 * emulator host alias `10.0.2.2`).
 */
import type {
  AddonCatalog,
  ContentType,
  MetaDetail,
  MetaPreview,
  MetaVideo,
  Stream,
  Subtitle,
} from 'stremio-addon-sdk';

// ---------------------------------------------------------------------------
// Seeded PRNG (mulberry32 over an FNV-1a string hash)
// ---------------------------------------------------------------------------

const fnv1a = (input: string): number => {
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

type Rng = () => number;

const mulberry32 = (seed: number): Rng => {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const pick = <T>(rng: Rng, items: readonly T[]): T =>
  items[Math.floor(rng() * items.length) % items.length];

// ---------------------------------------------------------------------------
// Curated vocabularies — human-readable, no gibberish
// ---------------------------------------------------------------------------

const ADJECTIVES = [
  'Crimson',
  'Silent',
  'Golden',
  'Northern',
  'Hidden',
  'Wandering',
  'Electric',
  'Midnight',
  'Restless',
  'Fallen',
  'Radiant',
  'Hollow',
  'Scarlet',
  'Iron',
  'Lonely',
  'Verdant',
] as const;

const NOUNS = [
  'Harbor',
  'Meridian',
  'Archive',
  'Horizon',
  'Cascade',
  'Signal',
  'Ember',
  'Summit',
  'Lantern',
  'Current',
  'Monument',
  'Crossing',
  'Threshold',
  'Voyage',
  'Wilderness',
  'Reverie',
] as const;

const PEOPLE = [
  'Mara Voss',
  'Jonas Reed',
  'Priya Anand',
  'Theo Marchetti',
  'Lena Okafor',
  'Elias Brandt',
  'Rosa Delgado',
  'Samir Kale',
  'June Halvorsen',
  'Dario Fontaine',
] as const;

const LOCATIONS = [
  'Veridian City',
  'Kestrel Point',
  'Old Marrow',
  'The Silver Delta',
  'Ashfall Station',
  'Blackwater Reach',
  'The Glass Quarter',
  'Northwind Bay',
] as const;

const GENRES = [
  'Drama',
  'Thriller',
  'Sci-Fi',
  'Documentary',
  'Comedy',
  'Horror',
  'Adventure',
  'Mystery',
] as const;

const DESCRIPTORS = [
  'unflinching',
  'luminous',
  'quietly devastating',
  'impossible to ignore',
  'achingly beautiful',
  'razor-sharp',
  'delicately observed',
  'breathtaking',
] as const;

const SUBJECTS = [
  'a lighthouse keeper',
  'a cartographer of dreams',
  'the last broadcast station',
  'a runaway archivist',
  'an exiled conductor',
  'the keeper of a forgotten harbor',
  'a signal from the deep',
  'the edge of a mapped world',
] as const;

const RESOLUTIONS = [
  'who must choose between duty and memory',
  'racing a season that never ends',
  'unraveling a cipher left in the tide',
  'who hears a voice no one else can',
  'carrying a secret across the divide',
  'rewriting the map of what was lost',
  'searching for a name the sea erased',
  'holding the line against the coming dark',
] as const;

const genDescription = (rng: Rng): string =>
  `A ${pick(rng, DESCRIPTORS)} portrait of ${pick(rng, SUBJECTS)} ${pick(rng, RESOLUTIONS)}.`;

// ---------------------------------------------------------------------------
// Extended types (the app consumes fields beyond the SDK base types)
// ---------------------------------------------------------------------------

export interface FixtureMetaDetail extends MetaDetail {
  status?: string;
  trailerStreams?: { title: string; ytId: string; lang?: string; thumbnail?: string }[];
  landscapePoster?: string;
  app_extras?: {
    cast?: { name: string; character?: string }[];
    directors?: { name: string }[];
    writers?: { name: string }[];
    certification?: string;
    seasonPosters?: string[];
  };
}

type FixtureBehaviorHints = Stream['behaviorHints'] & {
  filename?: string;
  videoHash?: string;
  videoSize?: number;
};

export interface FixtureStream extends Omit<Stream, 'behaviorHints'> {
  description?: string;
  behaviorHints?: FixtureBehaviorHints;
}

// ---------------------------------------------------------------------------
// Fixture shape
// ---------------------------------------------------------------------------

export interface FixtureData {
  seed: string;
  /** Ordered previews for every catalog, keyed by catalog id. */
  catalogs: Record<string, MetaPreview[]>;
  /** Full detail record for every known id (canonical + generated). */
  meta: Record<string, FixtureMetaDetail>;
  /** Stable stream list per meta/video id. */
  streams: Record<string, FixtureStream[]>;
  /** Stable subtitle list per meta/video id. */
  subtitles: Record<string, Subtitle[]>;
  /** Nested add-on catalog entries (addon_catalog resource). */
  addonCatalog: AddonCatalog[];
  /** Canonical id for the deterministic hero (first movie catalog item). */
  heroId: string;
  /** Search term guaranteed to produce deterministic results. */
  searchTerm: string;
  /** Genres exposed by the catalogs' `genre` extra. */
  genres: readonly string[];
}

// ---------------------------------------------------------------------------
// Asset helpers (relative paths; the server resolves the base URL)
// ---------------------------------------------------------------------------

const poster = (slug: string) => `assets/poster-${slug}.png`;
const background = (slug: string) => `assets/background-${slug}.png`;
const logo = (slug: string) => `assets/logo-${slug}.png`;
const TRAILER_THUMBNAIL = 'assets/trailer-official.png';

// Generated catalog items share a small deterministic palette so the checked-in
// raster set stays bounded while every referenced URL still resolves.
const GEN_POSTER_COUNT = 16;
const GEN_BG_COUNT = 8;
const GEN_EPISODE_COUNT = 6;
const genPoster = (index: number) => `assets/gen/poster-${index % GEN_POSTER_COUNT}.png`;
const genBackground = (index: number) => `assets/gen/background-${index % GEN_BG_COUNT}.png`;
const genLogo = (index: number) => `assets/gen/logo-${index % GEN_BG_COUNT}.png`;
const genEpisode = (index: number) => `assets/gen/episode-${index % GEN_EPISODE_COUNT}.png`;

// ---------------------------------------------------------------------------
// Canonical items (fixed, seed-independent anchors for the UI flows)
// ---------------------------------------------------------------------------

const ISO = (year: number, month: number, day: number) =>
  new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).toISOString();

/** Tiny deterministic picker so episode overviews are stable without an Rng. */
const pickByIdentifier = (items: readonly string[], a: number, b: number): string =>
  items[(a * 7 + b * 13) % items.length];

interface Canonical {
  movieFull: FixtureMetaDetail;
  movieMinimal: FixtureMetaDetail;
  movieLongText: FixtureMetaDetail;
  movieMissingOptional: FixtureMetaDetail;
  movieEmptyStream: FixtureMetaDetail;
  series: FixtureMetaDetail;
  channel: FixtureMetaDetail;
  tv: FixtureMetaDetail;
  seriesVideos: MetaVideo[];
}

const buildCanonical = (): Canonical => {
  const fullMovieId = 'e2e:movie:the-meridian-archive';
  const fullMovieSlug = 'the-meridian-archive';
  const movieFull: FixtureMetaDetail = {
    id: fullMovieId,
    type: 'movie',
    name: 'The Meridian Archive',
    poster: poster(fullMovieSlug),
    posterShape: 'regular',
    background: background(fullMovieSlug),
    logo: logo(fullMovieSlug),
    description:
      'A cartographer unearths a sealed archive that maps every moment the sea has ever taken, and finds her own name written in its margins.',
    genres: ['Drama', 'Mystery'],
    releaseInfo: '2024',
    director: ['Elias Brandt'],
    cast: ['Mara Voss', 'Jonas Reed', 'Priya Anand'],
    imdbRating: '8.4',
    released: ISO(2024, 9, 14),
    links: [
      { name: 'Mara Voss', category: 'actor', url: 'https://example.com/cast/mara-voss' },
      {
        name: 'Elias Brandt',
        category: 'director',
        url: 'https://example.com/director/elias-brandt',
      },
      { name: 'Drama', category: 'genre', url: 'https://example.com/genre/drama' },
    ],
    runtime: '118 min',
    language: 'English',
    country: 'Canada',
    awards: 'Winner, Northern Lights Film Festival — Best Director',
    website: 'https://example.com/the-meridian-archive',
    behaviourHints: { defaultVideo: fullMovieId },
    trailerStreams: [
      { title: 'Official Trailer', ytId: 'dQw4w9WgXcQ', lang: 'en', thumbnail: TRAILER_THUMBNAIL },
    ],
    landscapePoster: background(fullMovieSlug),
    app_extras: {
      cast: [
        { name: 'Mara Voss', character: 'Elena Marsh' },
        { name: 'Jonas Reed', character: 'The Archivist' },
      ],
      directors: [{ name: 'Elias Brandt' }],
      writers: [{ name: 'Rosa Delgado' }],
      certification: 'PG-13',
      seasonPosters: [],
    },
  };

  const movieMinimal: FixtureMetaDetail = {
    id: 'e2e:movie:static-sky',
    type: 'movie',
    name: 'Static Sky',
    // Deliberately no poster: exercises the app's missing-art fallback.
  };

  const longSlug = 'the-endless-voyage';
  const movieLongText: FixtureMetaDetail = {
    id: 'e2e:movie:the-endless-voyage',
    type: 'movie',
    name: 'The Endless Voyage',
    poster: poster(longSlug),
    background: background(longSlug),
    description:
      'Across a sea that refuses to end, a nameless navigator charts a route through the ruins of a hundred drowned cities, pursued by the memory of a lighthouse that never existed. Every horizon promises a shore; every shore dissolves into the same gray water. The voyage is the point. The arrival is the punishment. A meditation on distance, grief, and the maps we draw to keep ourselves from looking down.',
    genres: ['Adventure', 'Drama'],
    released: ISO(2023, 6, 2),
    runtime: '164 min',
  };

  const movieMissingOptional: FixtureMetaDetail = {
    id: 'e2e:movie:bare-signal',
    type: 'movie',
    name: 'Bare Signal',
    // No description, genres, background, poster shape, rating, or release date.
  };

  const emptySlug = 'silent-tide';
  const movieEmptyStream: FixtureMetaDetail = {
    id: 'e2e:movie:silent-tide',
    type: 'movie',
    name: 'Silent Tide',
    poster: poster(emptySlug),
    description: 'A coastal town waits for a wave that arrives only in silence.',
    genres: ['Drama'],
    released: ISO(2022, 3, 18),
  };

  const seriesId = 'e2e:series:harbor-lights';
  const seriesSlug = 'harbor-lights';
  const episode = (
    season: number,
    ep: number,
    title: string,
    released: string,
    extra?: Partial<MetaVideo>
  ): MetaVideo => ({
    id: `${seriesId}:${season}:${ep}`,
    title,
    released,
    season,
    episode: ep,
    thumbnail: `assets/episode-${seriesSlug}-${season}-${ep}.png`,
    overview: `The lights of ${pickByIdentifier(['Kestrel Point', 'the harbor', 'the watch house'], season, ep)} flicker once more.`,
    ...extra,
  });

  const seriesVideos: MetaVideo[] = [
    episode(1, 1, 'Pilot', ISO(2023, 1, 6), {
      available: true,
      trailer: 'dQw4w9WgXcQ',
      overview:
        'A harbor master returns to the town she left behind and finds the signal house dark for the first time in a century.',
      streams: buildStreams('e2e:series:harbor-lights:1:1', true),
    }),
    episode(
      1,
      2,
      'The Lighthouse Keeper’s Long and Winding Journey Through the Storm That Never Quite Arrives',
      ISO(2023, 1, 13),
      { available: true, trailer: 'dQw4w9WgXcQ' }
    ),
    episode(1, 3, 'Turn', ISO(2023, 1, 20), { available: true }),
    episode(2, 1, 'New Shores', ISO(2023, 9, 8), { available: true }),
    episode(2, 2, 'Crossing', ISO(2023, 9, 15), { available: true }),
    // Unreleased episode: future date exercises the "unreleased" badge.
    episode(2, 3, 'The Return', ISO(2031, 1, 10), { available: false }),
    episode(0, 1, 'Behind the Lights', ISO(2023, 6, 2), { available: true }),
    episode(0, 2, 'Season One Wrap', ISO(2023, 6, 9), { available: true }),
  ];

  const series: FixtureMetaDetail = {
    id: seriesId,
    type: 'series',
    name: 'Harbor Lights',
    poster: poster(seriesSlug),
    posterShape: 'regular',
    background: background(seriesSlug),
    logo: logo(seriesSlug),
    description:
      'When the harbor signal house goes dark, a reluctant keeper inherits the light — and the secret it has been warning against for a hundred years.',
    genres: ['Drama', 'Mystery'],
    releaseInfo: '2023–',
    director: ['Rosa Delgado'],
    cast: ['Lena Okafor', 'Theo Marchetti', 'June Halvorsen'],
    imdbRating: '8.1',
    released: ISO(2023, 1, 6),
    status: 'Continuing',
    runtime: '48 min',
    language: 'English',
    country: 'Ireland',
    awards: 'Nominated, International Television Guild — Best Drama',
    trailerStreams: [
      { title: 'Official Trailer', ytId: 'dQw4w9WgXcQ', lang: 'en', thumbnail: TRAILER_THUMBNAIL },
    ],
    app_extras: {
      cast: [
        { name: 'Lena Okafor', character: 'Maeve Kinsley' },
        { name: 'Theo Marchetti', character: 'Jonah Vale' },
        { name: 'June Halvorsen', character: 'Nora Pike' },
      ],
    },
    videos: seriesVideos,
  };

  const channel: FixtureMetaDetail = {
    id: 'e2e:channel:dodora-live',
    type: 'channel',
    name: 'Dodora Live',
    poster: poster('dodora-live'),
    posterShape: 'square',
    background: background('dodora-live'),
    logo: logo('dodora-live'),
    description: 'Around-the-clock curated programming from the DodoStream fixture network.',
    genres: ['Documentary'],
    videos: [
      {
        id: 'e2e:channel:dodora-live:1',
        title: 'Dodora Live',
        released: ISO(2024, 1, 1),
        thumbnail: 'assets/episode-dodora-live-1.png',
      },
    ],
  };

  const tv: FixtureMetaDetail = {
    id: 'e2e:tv:dodora-tv',
    type: 'tv',
    name: 'Dodora TV',
    poster: poster('dodora-tv'),
    posterShape: 'square',
    background: background('dodora-tv'),
    logo: logo('dodora-tv'),
    description: 'A deterministic live TV feed for E2E coverage.',
    genres: ['Documentary'],
    videos: [
      {
        id: 'e2e:tv:dodora-tv:1',
        title: 'Dodora TV',
        released: ISO(2024, 1, 1),
      },
    ],
  };

  return {
    movieFull,
    movieMinimal,
    movieLongText,
    movieMissingOptional,
    movieEmptyStream,
    series,
    channel,
    tv,
    seriesVideos,
  };
};

// ---------------------------------------------------------------------------
// Stream / subtitle builders (relative URLs; the server resolves the base)
// ---------------------------------------------------------------------------

const HLS_URL = 'assets/streams/meridian/index.m3u8';
const MP4_URL = 'assets/sample.mp4';

const buildStreams = (id: string, includePlayable = true): FixtureStream[] => {
  const group = 'com.dodostream.e2e-fixture';
  const streams: FixtureStream[] = [];
  if (includePlayable) {
    streams.push({
      name: 'DodoStream Fixture',
      title: '1080p MP4 (Direct)',
      description: 'Local direct MP4 — playable target for the UI journey.',
      url: MP4_URL,
      behaviorHints: {
        notWebReady: false,
        group,
        countryWhitelist: ['usa', 'can', 'gbr'],
        headers: { 'User-Agent': 'DodoStream-E2E/1.0' },
        filename: 'sample.mp4',
        videoHash: `e2ehash:${id}`,
        videoSize: 148700,
      },
    });
    streams.push({
      name: 'DodoStream Fixture',
      title: '720p HLS',
      description: 'HLS stream (notWebReady) — not playable by the app.',
      url: HLS_URL,
      behaviorHints: {
        notWebReady: true,
        group,
        countryWhitelist: ['usa'],
        filename: 'index.m3u8',
      },
    });
  }
  streams.push({
    name: 'DodoStream Fixture',
    title: 'YouTube',
    description: 'YouTube stream — opens outside the app.',
    ytId: 'dQw4w9WgXcQ',
    behaviorHints: { group, countryWhitelist: ['usa'] },
  });
  streams.push({
    name: 'DodoStream Fixture',
    title: 'External URL',
    description: 'External page — opens outside the app.',
    externalUrl: 'https://example.com/watch/the-meridian-archive',
    behaviorHints: { group },
  });
  return streams;
};

const buildSubtitles = (): Subtitle[] =>
  [
    { id: 'e2e-sub-en', lang: 'eng', file: 'meridian.en.srt' },
    { id: 'e2e-sub-es', lang: 'spa', file: 'meridian.es.srt' },
    { id: 'e2e-sub-de', lang: 'deu', file: 'meridian.de.srt' },
  ].map(({ id, lang, file }) => ({ id, lang, url: `assets/${file}` }));

// ---------------------------------------------------------------------------
// Catalog expansion (deterministic, seed-derived)
// ---------------------------------------------------------------------------

const MOVIE_CATALOG_ID = 'e2e-movies';
const SERIES_CATALOG_ID = 'e2e-series';
const EDGE_CATALOG_ID = 'e2e-edge';

const MOVIE_POOL_SIZE = 112; // 100 first page + 12 terminal page
const SERIES_POOL_SIZE = 112;
const EDGE_POOL_SIZE = 8;

interface GeneratedPreview {
  preview: MetaPreview;
  detail: FixtureMetaDetail;
}

const genSlug = (rng: Rng): string =>
  `${pick(rng, ADJECTIVES)}-${pick(rng, NOUNS)}`.toLowerCase().replace(/\s+/g, '-');

const genGeneratedMovie = (rng: Rng, index: number): GeneratedPreview => {
  const slug = `${genSlug(rng)}-${index}`;
  const id = `e2e:movie:${slug}`;
  const name = `${pick(rng, ADJECTIVES)} ${pick(rng, NOUNS)}`;
  const genres = [pick(rng, GENRES), pick(rng, GENRES)];
  const description = genDescription(rng);
  const released = ISO(
    1980 + Math.floor(rng() * 45),
    1 + Math.floor(rng() * 12),
    1 + Math.floor(rng() * 28)
  );
  const preview: MetaPreview = {
    id,
    type: 'movie',
    name,
    poster: genPoster(index),
    posterShape: 'regular',
    background: genBackground(index),
    logo: genLogo(index),
    description,
  };
  const detail: FixtureMetaDetail = {
    ...preview,
    genres,
    releaseInfo: String(released.slice(0, 4)),
    director: [pick(rng, PEOPLE)],
    cast: [pick(rng, PEOPLE), pick(rng, PEOPLE)],
    imdbRating: (4 + rng() * 5).toFixed(1),
    released,
    runtime: `${80 + Math.floor(rng() * 90)} min`,
    language: 'English',
    country: pick(rng, LOCATIONS).split(' ').slice(-1)[0],
  };
  return { preview, detail };
};

const genGeneratedSeries = (rng: Rng, index: number): GeneratedPreview => {
  const slug = `${genSlug(rng)}-${index}`;
  const id = `e2e:series:${slug}`;
  const name = `${pick(rng, ADJECTIVES)} ${pick(rng, NOUNS)}`;
  const description = genDescription(rng);
  const videos: MetaVideo[] = [1, 2, 3].map((ep) => ({
    id: `${id}:1:${ep}`,
    title: `Episode ${ep}`,
    released: ISO(2023, 1, ep * 7),
    season: 1,
    episode: ep,
    thumbnail: genEpisode(index + ep),
    available: true,
  }));
  const preview: MetaPreview = {
    id,
    type: 'series',
    name,
    poster: genPoster(index),
    posterShape: 'regular',
    background: genBackground(index),
    logo: genLogo(index),
    description,
  };
  const detail: FixtureMetaDetail = {
    ...preview,
    genres: ['Drama', pick(rng, GENRES)],
    releaseInfo: '2023',
    director: [pick(rng, PEOPLE)],
    imdbRating: (5 + rng() * 4).toFixed(1),
    released: ISO(2023, 1, 1),
    runtime: '45 min',
    videos,
  };
  return { preview, detail };
};

// ---------------------------------------------------------------------------
// Generator entry point
// ---------------------------------------------------------------------------

export const createFixture = (seed = 'dodostream-ui-2026'): FixtureData => {
  const rng = mulberry32(fnv1a(seed));
  const canonical = buildCanonical();

  const catalogs: Record<string, MetaPreview[]> = {};
  const meta: Record<string, FixtureMetaDetail> = {};
  const streams: Record<string, FixtureStream[]> = {};
  const subtitles: Record<string, Subtitle[]> = {};

  const register = (detail: FixtureMetaDetail) => {
    meta[detail.id] = detail;
  };

  // Canonical records
  register(canonical.movieFull);
  register(canonical.movieMinimal);
  register(canonical.movieLongText);
  register(canonical.movieMissingOptional);
  register(canonical.movieEmptyStream);
  register(canonical.series);
  register(canonical.channel);
  register(canonical.tv);

  // Canonical streams / subtitles
  streams[canonical.movieFull.id] = buildStreams(canonical.movieFull.id, true);
  streams[canonical.movieEmptyStream.id] = [];
  for (const video of canonical.seriesVideos) {
    if (video.streams) {
      streams[video.id] = video.streams as FixtureStream[];
    } else if (video.available === false) {
      streams[video.id] = [];
    } else {
      streams[video.id] = buildStreams(video.id, true);
    }
  }
  streams[canonical.channel.id] = buildStreams(canonical.channel.id, true);
  streams[canonical.tv.id] = buildStreams(canonical.tv.id, true);

  const stableSubtitles = buildSubtitles();
  subtitles[canonical.movieFull.id] = stableSubtitles;
  subtitles[canonical.series.id] = stableSubtitles;

  // Movie catalog: canonical full/minimal first (hero = first item), then expansion.
  const moviePreviews: MetaPreview[] = [canonical.movieFull, canonical.movieMinimal];
  const generatedDetails: Record<string, FixtureMetaDetail> = {};
  const extraMovies = MOVIE_POOL_SIZE - moviePreviews.length;
  for (let i = 0; i < extraMovies; i += 1) {
    const generated = genGeneratedMovie(rng, i);
    moviePreviews.push(generated.preview);
    generatedDetails[generated.preview.id] = generated.detail;
  }

  // Series catalog: canonical series first, then expansion.
  const seriesPreviews: MetaPreview[] = [canonical.series];
  for (let i = 1; i < SERIES_POOL_SIZE; i += 1) {
    const generated = genGeneratedSeries(rng, i);
    seriesPreviews.push(generated.preview);
    generatedDetails[generated.preview.id] = generated.detail;
  }

  // Edge-case catalog: boundary movie states (channel/tv stay meta-only).
  const edgePreviews: MetaPreview[] = [
    canonical.movieMissingOptional,
    canonical.movieEmptyStream,
    canonical.movieLongText,
  ];
  for (let i = edgePreviews.length; i < EDGE_POOL_SIZE; i += 1) {
    const generated = genGeneratedMovie(rng, 1000 + i);
    edgePreviews.push(generated.preview);
    generatedDetails[generated.preview.id] = generated.detail;
  }

  catalogs[MOVIE_CATALOG_ID] = moviePreviews;
  catalogs[SERIES_CATALOG_ID] = seriesPreviews;
  catalogs[EDGE_CATALOG_ID] = edgePreviews;

  Object.assign(meta, generatedDetails);

  // addon_catalog: two nested addons with complete manifests.
  const nestedManifestBase = {
    types: ['movie', 'series'] as ContentType[],
    catalogs: [{ type: 'movie' as ContentType, id: 'nested-movies', name: 'Nested Movies' }],
    behaviorHints: { configurable: false, configurationRequired: false },
  };

  const addonCatalog: AddonCatalog[] = [
    {
      transportName: 'http',
      transportUrl: 'http://10.0.2.2:8765/manifest.json',
      manifest: {
        id: 'com.dodostream.nested-meta',
        name: 'DodoStream Metadata Addon',
        description: 'Metadata-focused nested addon for addon_catalog coverage.',
        version: '1.0.0',
        resources: [
          { name: 'catalog', types: ['movie'], idPrefixes: ['e2e:movie:'] },
          { name: 'meta', types: ['movie', 'series'], idPrefixes: ['e2e:'] },
        ],
        ...nestedManifestBase,
      },
    },
    {
      transportName: 'http',
      transportUrl: 'http://10.0.2.2:8765/manifest.json',
      manifest: {
        id: 'com.dodostream.nested-streams',
        name: 'DodoStream Streams Addon',
        description: 'Streams-focused nested addon for addon_catalog coverage.',
        version: '1.0.0',
        resources: [
          { name: 'catalog', types: ['movie'], idPrefixes: ['e2e:movie:'] },
          { name: 'stream', types: ['movie', 'series'], idPrefixes: ['e2e:'] },
        ],
        ...nestedManifestBase,
      },
    },
  ];

  return {
    seed,
    catalogs,
    meta,
    streams,
    subtitles,
    addonCatalog,
    heroId: canonical.movieFull.id,
    searchTerm: 'meridian',
    genres: GENRES,
  };
};

export const FIXTURE_ID_PREFIX = 'e2e:';
export const CATALOG_IDS = {
  movies: MOVIE_CATALOG_ID,
  series: SERIES_CATALOG_ID,
  edge: EDGE_CATALOG_ID,
} as const;
