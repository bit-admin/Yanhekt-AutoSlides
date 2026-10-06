// Reads placement.region from wrangler.jsonc (else wrangler.example.jsonc)
// and writes public/placement.json. Run before `wrangler dev` / `wrangler deploy`.
// Changing the pin is editing that one region string and re-running dev or deploy.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPlacementRegion, resolvePlacement } from '../src/placementRegions.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const live = join(root, 'wrangler.jsonc');
const example = join(root, 'wrangler.example.jsonc');
const configPath = existsSync(live) ? live : example;
const region = readPlacementRegion(readFileSync(configPath, 'utf8'));
const placement = resolvePlacement(region);
const out = join(root, 'public', 'placement.json');
writeFileSync(out, `${JSON.stringify(placement, null, 2)}\n`);
const where = !placement.pinned
  ? 'not pinned (Worker runs in the edge city)'
  : placement.colo
    ? `${placement.city} (${placement.colo})`
    : 'no city in the Asia list';
console.log(`stamp-placement: ${placement.region ?? 'none'} → ${where} (${configPath})`);
