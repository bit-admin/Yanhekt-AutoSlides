// Place the static, version-neutral apex landing at dist/index.html (served at
// "/" directly by the asset layer — no Worker). The versioned app lives in
// dist/v1 (emitted by Vite). Keeping the landing separate means the apex never
// needs changing when a /v2 viewer is added.
import { mkdirSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(join(root, 'dist'), { recursive: true });
copyFileSync(join(root, 'root', 'index.html'), join(root, 'dist', 'index.html'));
console.log('postbuild: wrote dist/index.html (apex landing)');
