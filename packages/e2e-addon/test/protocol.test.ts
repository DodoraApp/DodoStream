import assert from 'node:assert/strict';
import net from 'node:net';
import { after, before, describe, it } from 'node:test';
import type { Server } from 'node:http';

import type { Manifest } from 'stremio-addon-sdk';

import { startServer } from '../src/server';
import { CATALOG_IDS } from '../src/fixture';

const SEED = 'dodostream-ui-2026';

const getFreePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.on('error', reject);
    srv.listen(0, () => {
      const address = srv.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      srv.close(() => resolve(port));
    });
  });

let base = '';
let server: Server;

before(async () => {
  const port = await getFreePort();
  base = `http://127.0.0.1:${port}`;
  const started = await startServer({ port, publicBaseUrl: base, seed: SEED });
  server = started.server;
});

after(() => new Promise<void>((resolve) => server.close(() => resolve())));

const json = async <T>(
  path: string,
  init?: RequestInit
): Promise<{ status: number; body: T; headers: Headers }> => {
  const res = await fetch(`${base}${path}`, init);
  const text = await res.text();
  const body = text ? (JSON.parse(text) as T) : (null as unknown as T);
  return { status: res.status, body, headers: res.headers };
};

describe('manifest', () => {
  it('serves /manifest.json with CORS and all required fields', async () => {
    const { status, body, headers } = await json<Manifest>('/manifest.json', {
      headers: { Origin: 'http://localhost' },
    });

    assert.equal(status, 200);
    assert.equal(headers.get('access-control-allow-origin'), '*');
    assert.equal(headers.get('content-type')?.startsWith('application/json'), true);

    assert.equal(body.id, 'com.dodostream.e2e-fixture');
    assert.equal(body.version, '1.0.0');
    assert.ok(body.name.length > 0);
    assert.ok(body.description.length > 0);
    assert.deepEqual(body.types, ['movie', 'series', 'channel', 'tv']);
  });

  it('declares every resource and catalog with extras', async () => {
    const { body } = await json<Manifest>('/manifest.json');

    const resourceNames: string[] = body.resources.map((r) => (typeof r === 'string' ? r : r.name));
    for (const name of ['catalog', 'meta', 'stream', 'subtitles', 'addon_catalog']) {
      assert.ok(resourceNames.includes(name), `missing resource ${name}`);
    }

    assert.equal(body.catalogs.length, 3);
    assert.deepEqual(
      body.catalogs.map((c) => c.id).sort(),
      [CATALOG_IDS.movies, CATALOG_IDS.series, CATALOG_IDS.edge].sort()
    );

    for (const catalog of body.catalogs) {
      const extras = (catalog.extra ?? []).map((e) => e.name);
      assert.ok(extras.includes('search'));
      assert.ok(extras.includes('genre'));
      assert.ok(extras.includes('skip'));
    }
  });

  it('is configurable with a full config schema', async () => {
    const { body } = await json<Manifest>('/manifest.json');

    assert.equal(body.behaviorHints?.configurable, true);
    assert.equal(body.behaviorHints?.configurationRequired, false);

    const types = (body.config ?? []).map((c) => c.type).sort();
    assert.deepEqual(types, ['checkbox', 'number', 'password', 'select', 'text']);
    assert.ok(body.config?.some((c) => c.type === 'select' && Array.isArray(c.options)));
  });

  it('references manifest logo/background under assets/', async () => {
    const { body } = await json<Manifest>('/manifest.json');
    assert.ok(body.logo?.startsWith(`${base}/assets/`));
    assert.ok(body.background?.startsWith(`${base}/assets/`));
  });

  it('serves /configure for the configurable manifest', async () => {
    const res = await fetch(`${base}/configure`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type')?.startsWith('text/html'), true);
  });
});

describe('catalog', () => {
  it('returns exactly 100 metas on the first page and 12 on the terminal page', async () => {
    const first = await json<{ metas: unknown[] }>(`/catalog/movie/${CATALOG_IDS.movies}.json`);
    assert.equal(first.status, 200);
    assert.equal(first.body.metas.length, 100);

    const terminal = await json<{ metas: unknown[] }>(
      `/catalog/movie/${CATALOG_IDS.movies}/skip=100.json`
    );
    assert.equal(terminal.status, 200);
    assert.equal(terminal.body.metas.length, 12);
  });

  it('returns deterministic search results for the stable term', async () => {
    const res = await json<{ metas: { name: string }[] }>(
      `/catalog/movie/${CATALOG_IDS.movies}/search=meridian.json`
    );
    assert.equal(res.status, 200);
    assert.ok(res.body.metas.length >= 1);
    assert.ok(res.body.metas.every((m) => m.name.toLowerCase().includes('meridian')));
    assert.ok(res.body.metas.some((m) => m.name === 'The Meridian Archive'));
  });

  it('returns deterministic genre-filtered results', async () => {
    const res = await json<{ metas: unknown[] }>(
      `/catalog/movie/${CATALOG_IDS.movies}/genre=Drama.json`
    );
    assert.equal(res.status, 200);
    assert.ok(res.body.metas.length >= 1);
  });

  it('fails non-2xx for unknown catalog ids', async () => {
    const res = await fetch(`${base}/catalog/movie/does-not-exist.json`);
    assert.ok(res.status >= 400, `expected non-2xx, got ${res.status}`);
  });
});

describe('meta', () => {
  it('returns the fully populated movie', async () => {
    const { status, body } = await json<{ meta: Record<string, unknown> }>(
      '/meta/movie/e2e:movie:the-meridian-archive.json'
    );
    assert.equal(status, 200);
    const meta = body.meta;
    assert.equal(meta.id, 'e2e:movie:the-meridian-archive');
    assert.equal(meta.type, 'movie');
    assert.ok(meta.poster);
    assert.equal(meta.posterShape, 'regular');
    assert.ok(meta.background);
    assert.ok(meta.logo);
    assert.ok(meta.description);
    assert.ok(Array.isArray(meta.genres));
    assert.ok(Array.isArray(meta.director));
    assert.ok(Array.isArray(meta.cast));
    assert.ok(meta.imdbRating);
    assert.ok(meta.released);
    assert.ok(meta.runtime);
    assert.ok(meta.language);
    assert.ok(meta.country);
    assert.ok(meta.awards);
    assert.ok(meta.website);
    assert.equal((meta.behaviourHints as { defaultVideo?: string }).defaultVideo, meta.id);
    assert.ok(Array.isArray(meta.trailerStreams));
    const trailer = (meta.trailerStreams as Array<{ thumbnail?: string }>)[0];
    assert.equal(trailer?.thumbnail, `${base}/assets/trailer-official.png`);
    assert.ok(meta.landscapePoster);
    assert.ok(meta.app_extras);
  });

  it('returns the minimal movie with only required fields', async () => {
    const { status, body } = await json<{ meta: Record<string, unknown> }>(
      '/meta/movie/e2e:movie:static-sky.json'
    );
    assert.equal(status, 200);
    assert.equal(body.meta.id, 'e2e:movie:static-sky');
    assert.equal(body.meta.type, 'movie');
    assert.equal(body.meta.name, 'Static Sky');
    assert.equal(body.meta.poster, undefined);
  });

  it('returns the series with multi-season ordering and embedded streams', async () => {
    const { status, body } = await json<{
      meta: {
        videos: Array<{
          id: string;
          season: number;
          episode: number;
          streams?: unknown[];
          available?: boolean;
        }>;
      };
    }>('/meta/series/e2e:series:harbor-lights.json');
    assert.equal(status, 200);
    const seasons = [...new Set(body.meta.videos.map((v) => v.season))];
    assert.ok(seasons.includes(0), 'has a season-0 specials group');
    assert.ok(seasons.includes(1));
    assert.ok(seasons.includes(2));

    const pilot = body.meta.videos.find((v) => v.id === 'e2e:series:harbor-lights:1:1');
    assert.ok(pilot, 'pilot exists');
    assert.ok(pilot.streams && pilot.streams.length > 0, 'pilot has embedded streams');

    const unreleased = body.meta.videos.find((v) => v.id === 'e2e:series:harbor-lights:2:3');
    assert.ok(unreleased, 'unreleased episode exists');
    assert.equal(unreleased.available, false);
  });

  it('returns channel and tv meta', async () => {
    for (const [type, id] of [
      ['channel', 'e2e:channel:dodora-live'],
      ['tv', 'e2e:tv:dodora-tv'],
    ]) {
      const { status, body } = await json<{ meta: { type: string } }>(`/meta/${type}/${id}.json`);
      assert.equal(status, 200);
      assert.equal(body.meta.type, type);
    }
  });

  it('fails non-2xx for unknown meta ids', async () => {
    const res = await fetch(`${base}/meta/movie/e2e:movie:not-real.json`);
    assert.ok(res.status >= 400, `expected non-2xx, got ${res.status}`);
  });
});

describe('streams', () => {
  it('preserves the supported SDK source families in usable-to-least order', async () => {
    const { status, body } = await json<{ streams: Array<Record<string, unknown>> }>(
      '/stream/movie/e2e:movie:the-meridian-archive.json'
    );
    assert.equal(status, 200);
    const streams = body.streams;

    assert.equal(streams.length, 4, 'contains only supported source families');

    const first = streams[0];
    assert.equal(typeof first.url, 'string');
    assert.ok((first.url as string).endsWith('/sample.mp4'), 'first stream is the direct MP4');

    assert.ok(
      streams.some(
        (s) =>
          typeof s.url === 'string' &&
          (s.url as string).endsWith('index.m3u8') &&
          (s.behaviorHints as { notWebReady?: boolean })?.notWebReady === true
      )
    );
    assert.ok(streams.some((s) => typeof s.ytId === 'string'));
    assert.ok(streams.some((s) => typeof s.externalUrl === 'string'));
  });

  it('returns an empty list for the empty-stream item', async () => {
    const { status, body } = await json<{ streams: unknown[] }>(
      '/stream/movie/e2e:movie:silent-tide.json'
    );
    assert.equal(status, 200);
    assert.deepEqual(body.streams, []);
  });
});
describe('subtitles', () => {
  it('returns all three language records with valid URLs', async () => {
    const { status, body } = await json<{
      subtitles: Array<{ id: string; lang: string; url: string }>;
    }>('/subtitles/movie/e2e:movie:the-meridian-archive.json');
    assert.equal(status, 200);
    assert.equal(body.subtitles.length, 3);
    const langs = body.subtitles.map((s) => s.lang).sort();
    assert.deepEqual(langs, ['deu', 'eng', 'spa']);
    assert.ok(body.subtitles.every((s) => s.url.endsWith('.srt')));
    assert.equal(new Set(body.subtitles.map((s) => s.id)).size, 3);
  });
});

describe('addon_catalog', () => {
  it('returns two valid nested addon catalogs', async () => {
    const { status, body } = await json<{
      addons: Array<{ transportName: string; transportUrl: string; manifest: Manifest }>;
    }>('/addon_catalog/movie/e2e.json');
    assert.equal(status, 200);
    assert.equal(body.addons.length, 2);

    for (const addon of body.addons) {
      assert.equal(addon.transportName, 'http');
      assert.ok(addon.transportUrl.length > 0);
      assert.ok(addon.manifest.id);
      assert.ok(addon.manifest.name);
      assert.ok(addon.manifest.version);
      assert.ok(addon.manifest.resources.length > 0);
      assert.ok(addon.manifest.types.length > 0);
      assert.ok(addon.manifest.catalogs.length > 0);
    }
  });
});

describe('static assets', () => {
  it('serves raster, subtitle, HLS and MP4 assets with correct content types', async () => {
    const checks: Array<[string, string]> = [
      ['/assets/poster-the-meridian-archive.png', 'image/png'],
      ['/assets/trailer-official.png', 'image/png'],
      ['/assets/meridian.en.srt', 'application/x-subrip'],
      ['/assets/streams/meridian/index.m3u8', 'application/vnd.apple.mpegurl'],
      ['/assets/sample.mp4', 'video/mp4'],
    ];
    for (const [path, contentType] of checks) {
      const res = await fetch(`${base}${path}`);
      assert.equal(res.status, 200, `${path} should be served`);
      assert.equal(
        res.headers.get('content-type')?.split(';')[0],
        contentType,
        `${path} content type`
      );
    }
  });
});
