// Builds the JSON Schema of the stored app config from the `AppConfig` type
// (src/shared/types.ts) and writes it to
// src/main/platform/config/appConfig.schema.json.
//
//   npm run gen:config-schema
//
// The schema is lenient on purpose: it checks the type of each value and
// nothing else. Every `required` list and every `additionalProperties: false`
// is removed, because a config written by an older or newer version may lack
// a field or carry a retired one, and that is not an error. ConfigService
// repairs only values of the wrong type (see config/repair.ts).
//
// `configSchema.test.ts` regenerates the schema and fails when the committed
// file differs, so a change to AppConfig must be followed by this script.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGenerator } from 'ts-json-schema-generator';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const typesFile = path.join(root, 'src/shared/types.ts');
export const schemaFile = path.join(root, 'src/main/platform/config/appConfig.schema.json');

function lenient(node) {
  if (Array.isArray(node)) return node.map(lenient);
  if (!node || typeof node !== 'object') return node;
  const out = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === 'required') continue;
    if (key === 'additionalProperties' && value === false) continue;
    out[key] = lenient(value);
  }
  return out;
}

export function buildConfigSchema() {
  const schema = createGenerator({
    path: typesFile,
    type: 'AppConfig',
    // Only types.ts and what it imports; type errors are tsc's job.
    skipTypeCheck: true,
    // Field comments become `description`s, which editors show on hover.
    jsDoc: 'extended',
    topRef: false,
  }).createSchema('AppConfig');
  return {
    $comment: 'Generated from AppConfig by scripts/gen-config-schema.mjs. Do not edit.',
    ...lenient(schema),
  };
}

export function formatSchema(schema) {
  return JSON.stringify(schema, null, 2) + '\n';
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  fs.writeFileSync(schemaFile, formatSchema(buildConfigSchema()));
  process.stdout.write(`Wrote ${path.relative(root, schemaFile)}\n`);
}
