import type { Server } from 'node:http';

import stremioAddonSdk from 'stremio-addon-sdk';
import type { AddonCatalog, MetaDetail, Stream, Subtitle } from 'stremio-addon-sdk';

import { DEFAULT_SEED, ensureAssets } from './assets';
import { createFixture, FixtureData } from './fixture';
import { createManifest } from './manifest';

const { addonBuilder, serveHTTP } = stremioAddonSdk;

const CATALOG_PAGE_SIZE = 100;

export interface StartServerOptions {
  /** Port to bind. Defaults to `PORT` env or 8765. Use 0 for an ephemeral port. */
  port?: number;
  /** Public base URL used to build asset URLs in responses. Defaults to `PUBLIC_BASE_URL` env or `http://127.0.0.1:<port>`. */
  publicBaseUrl?: string;
  /** Deterministic fixture seed. Defaults to `E2E_FIXTURE_SEED` env or the default seed. */
  seed?: string;
}

/** Deterministic not-found rejection (maps to a 404 via the SDK router). */
const notFound = (message: string): never => {
  throw Object.assign(new Error(message), { noHandler: true });
};

/** Resolve relative `assets/...` URLs against the public base URL. */
const resolveFixtureUrls = <T>(value: T, baseUrl: string): T =>
  JSON.parse(JSON.stringify(value), (_key, v) => {
    if (typeof v === 'string' && v.startsWith('assets/')) {
      return `${baseUrl.replace(/\/$/, '')}/${v}`;
    }
    return v;
  }) as T;

const addonCatalogHandler = (fixture: FixtureData) => () =>
  Promise.resolve({
    addons: fixture.addonCatalog as AddonCatalog[],
  });

const catalogHandler =
  (fixture: FixtureData) =>
  async (args: {
    type: string;
    id: string;
    extra: { search?: string; genre?: string; skip?: number | string };
  }) => {
    const { id, extra = {} } = args;
    const source = fixture.catalogs[id];
    if (!source) return notFound(`Catalog not found: ${id}`);

    const search = typeof extra.search === 'string' ? extra.search.trim().toLowerCase() : '';
    const genre = typeof extra.genre === 'string' ? extra.genre : '';
    const skip = Number(extra.skip) || 0;

    let metas = source;
    if (search) {
      metas = metas.filter((m) => m.name.toLowerCase().includes(search));
    }
    if (genre) {
      metas = metas.filter((m) => fixture.meta[m.id]?.genres?.includes(genre));
    }

    return { metas: metas.slice(skip, skip + CATALOG_PAGE_SIZE) };
  };

const metaHandler = (fixture: FixtureData) => async (args: { id: string }) => {
  const meta: MetaDetail | undefined = fixture.meta[args.id];
  if (!meta) return notFound(`Meta not found: ${args.id}`);
  return { meta };
};

const streamHandler = (fixture: FixtureData) => async (args: { id: string }) => {
  const streams: Stream[] = fixture.streams[args.id] ?? [];
  return { streams };
};

const subtitlesHandler =
  (fixture: FixtureData) =>
  async (args: {
    id: string;
    extra?: { videoHash?: string; videoSize?: string; filename?: string };
  }) => {
    // `extra` is honored only for observability; ordering stays stable.
    if (args.extra) {
      console.log(
        `[e2e-addon] subtitle request id=${args.id} videoHash=${args.extra.videoHash ?? ''} videoSize=${args.extra.videoSize ?? ''} filename=${args.extra.filename ?? ''}`
      );
    }
    const subtitles: Subtitle[] = fixture.subtitles[args.id] ?? [];
    return { subtitles };
  };

const buildInterface = (fixture: FixtureData, publicBaseUrl: string) => {
  const manifest = createManifest(publicBaseUrl);
  const builder = new addonBuilder(manifest);
  builder.defineCatalogHandler(catalogHandler(fixture));
  builder.defineMetaHandler(metaHandler(fixture));
  builder.defineStreamHandler(streamHandler(fixture));
  builder.defineSubtitlesHandler(subtitlesHandler(fixture));
  // The upstream DefinitelyTyped declaration for defineResourceHandler is
  // missing the `(resource, handler)` overload, so cast the generic method.
  (
    builder as unknown as {
      defineResourceHandler: (
        resource: string,
        handler: () => Promise<{ addons: AddonCatalog[] }>
      ) => void;
    }
  ).defineResourceHandler('addon_catalog', addonCatalogHandler(fixture));
  return builder.getInterface();
};

/**
 * Start the fixture add-on server. Binds all interfaces, serves `assets/` as
 * static files, and prints both the SDK manifest URL and the emulator URL.
 */
export const startServer = async (
  options: StartServerOptions = {}
): Promise<{ url: string; server: Server }> => {
  const port = options.port ?? Number(process.env.PORT ?? 8765);
  const seed = options.seed ?? process.env.E2E_FIXTURE_SEED ?? DEFAULT_SEED;
  const publicBaseUrl =
    options.publicBaseUrl ?? process.env.PUBLIC_BASE_URL ?? `http://127.0.0.1:${port}`;

  await ensureAssets(seed);

  const fixture = createFixture(seed);
  const resolved = resolveFixtureUrls(fixture, publicBaseUrl);
  const addonInterface = buildInterface(resolved, publicBaseUrl);

  // serveHTTP resolves `{ url, server }` at runtime; the upstream types
  // declare it `void`, so cast to the observed shape.
  const { server } = (await serveHTTP(addonInterface, {
    port,
    // Leading slash is required: the SDK mounts `express.static` at this path.
    static: '/assets',
  })) as unknown as { server: Server };
  const address = server.address();
  const boundPort = typeof address === 'object' && address ? address.port : port;

  console.log(`[e2e-addon] Manifest URL: ${publicBaseUrl.replace(/\/$/, '')}/manifest.json`);
  console.log(`[e2e-addon] Emulator URL: http://10.0.2.2:${boundPort}/manifest.json`);

  return { url: `${publicBaseUrl.replace(/\/$/, '')}/manifest.json`, server };
};

// When run directly (`pnpm --filter @dodostream/e2e-addon start`), start the
// server. Imported as a library (tests, orchestration), this is a no-op.
import { pathToFileURL } from 'node:url';

const isEntryPoint = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (isEntryPoint) {
  startServer().catch((error) => {
    console.error('[e2e-addon] failed to start:', error);
    process.exit(1);
  });
}
