import { ensureAssets } from '../src/assets';

// `pnpm --filter @dodostream/e2e-addon build` regenerates deterministic PNG
// assets and validates the checked-in SRT / MP4 / HLS assets.
const seed = process.env.E2E_FIXTURE_SEED ?? 'dodostream-ui-2026';

await ensureAssets(seed);
console.log(`[e2e-addon] assets ready (seed=${seed})`);
