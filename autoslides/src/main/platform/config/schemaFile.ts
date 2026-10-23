// Puts the config schema next to the config file and points the file at it,
// so an editor (VS Code, JetBrains) checks and completes a hand edit.
//
// The schema is written on every launch when its content differs, so it
// follows app updates. The `$schema` key is relative, so it keeps working if
// the folder moves. It is invisible to the app: `getConfig()` copies a fixed
// list of keys, and the lenient schema allows extra keys.
import fs from 'node:fs';
import path from 'node:path';
import schema from './appConfig.schema.json';

export const CONFIG_SCHEMA_FILE_NAME = 'autoslides-config.schema.json';
export const CONFIG_SCHEMA_REF = `./${CONFIG_SCHEMA_FILE_NAME}`;

interface SchemaRefStore {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
}

export function installConfigSchema(store: SchemaRefStore, configDir: string): void {
  const file = path.join(configDir, CONFIG_SCHEMA_FILE_NAME);
  const content = JSON.stringify(schema, null, 2) + '\n';
  let current: string | null = null;
  try {
    current = fs.readFileSync(file, 'utf8');
  } catch {
    // Not there yet.
  }
  if (current !== content) fs.writeFileSync(file, content);
  if (store.get('$schema') !== CONFIG_SCHEMA_REF) store.set('$schema', CONFIG_SCHEMA_REF);
}
