// Startup repair of the stored config against the schema generated from
// `AppConfig` (appConfig.schema.json, see scripts/gen-config-schema.mjs).
//
// electron-store's own `schema` option is not used: on a mismatch it either
// throws (the app does not start) or, with `clearInvalidConfig`, empties the
// whole file, sign-ins and saved logins included. Here one bad value never
// costs more than itself:
//
// - a value of the wrong type goes back to its default, or is removed when
//   there is no default at that place;
// - a bad element of an array is removed from the array, so one broken entry
//   does not drop the others (accounts, pins, saved searches);
// - missing fields and unknown keys are fine (the schema is lenient), so a
//   config written by an older or newer version is left alone.
//
// Only keys of `AppConfig` are checked. Standalone keys (`authToken`,
// `ssoDeviceCookies`, `yanhe2Sessions`, saved logins, …) are not in the schema
// and are never read or touched here.
import Ajv, { type ErrorObject, type ValidateFunction } from 'ajv';
import schema from './appConfig.schema.json';

/** The part of electron-store this needs. */
export interface RepairableStore {
  has(key: string): boolean;
  get(key: string): unknown;
  set(key: string, value: unknown): void;
  delete(key: string): void;
}

export interface ConfigRepair {
  /** JSON-pointer-like path of the repaired value, e.g. `slideExtraction/autoCrop/blackThreshold`. */
  path: string;
  action: 'default' | 'removed';
}

// Keys of AppConfig that are not checked:
// - derived by ConfigService, never read from the store;
// - read through a normalizer that understands legacy stored shapes a plain
//   type check would reject (none at the moment; the live-stream relabel was
//   one until it was retired in 23.125).
const UNCHECKED_KEYS = new Set<string>(['notionConnected', 'yanhe2SessionExpiry']);

// Each pass fixes the first error; a config this broken is past repair anyway.
const MAX_REPAIRS = 200;

let validator: ValidateFunction | null = null;

function getValidator(): ValidateFunction {
  // `strict: false`: the schema comes from a generator, and an unknown keyword
  // in it must not stop the app from starting.
  validator ??= new Ajv({ strict: false, allErrors: true }).compile(schema);
  return validator;
}

export const CHECKED_CONFIG_KEYS: readonly string[] = Object.keys(schema.properties).filter(
  (key) => !UNCHECKED_KEYS.has(key),
);

function pathSegments(error: ErrorObject): string[] {
  if (!error.instancePath) return [];
  return error.instancePath.split('/').slice(1).map((s) => s.replace(/~1/g, '/').replace(/~0/g, '~'));
}

/** The error closest to the root: an `anyOf` mismatch comes before its branches' errors. */
function shallowestError(errors: ErrorObject[]): ErrorObject {
  return errors.reduce((best, e) => (pathSegments(e).length < pathSegments(best).length ? e : best));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function valueAt(root: unknown, segments: string[]): unknown {
  let node = root;
  for (const s of segments) {
    if (Array.isArray(node)) node = node[Number(s)];
    else if (isRecord(node)) node = node[s];
    else return undefined;
  }
  return node;
}

function clone<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

/**
 * Fixes one error in `config` (a plain object of stored AppConfig keys) in
 * place. Returns what was done, or null when the error points nowhere usable.
 */
function repairOne(config: Record<string, unknown>, defaults: Record<string, unknown>, error: ErrorObject): ConfigRepair | null {
  const segments = pathSegments(error);
  if (segments.length === 0) return null;

  // Inside an array: drop the element that holds the error.
  for (let i = 1; i < segments.length; i++) {
    const container = valueAt(config, segments.slice(0, i));
    if (Array.isArray(container)) {
      container.splice(Number(segments[i]), 1);
      return { path: segments.slice(0, i + 1).join('/'), action: 'removed' };
    }
  }

  const parent = segments.length === 1 ? config : valueAt(config, segments.slice(0, -1));
  if (!isRecord(parent)) return null;
  const leaf = segments[segments.length - 1];
  const fallback = valueAt(defaults, segments);
  if (fallback === undefined) {
    delete parent[leaf];
    return { path: segments.join('/'), action: 'removed' };
  }
  parent[leaf] = clone(fallback);
  return { path: segments.join('/'), action: 'default' };
}

/**
 * Checks every stored AppConfig key and writes back the ones it repaired.
 * Returns the repairs, for the log. Never throws on a bad config; the caller
 * still guards against a bug in here.
 */
export function repairStoredConfig(store: RepairableStore, defaults: object): ConfigRepair[] {
  const config: Record<string, unknown> = {};
  for (const key of CHECKED_CONFIG_KEYS) {
    if (store.has(key)) config[key] = clone(store.get(key));
  }

  const validate = getValidator();
  const repairs: ConfigRepair[] = [];
  const touched = new Set<string>();
  while (repairs.length < MAX_REPAIRS && !validate(config) && validate.errors?.length) {
    const repair = repairOne(config, defaults as Record<string, unknown>, shallowestError(validate.errors));
    if (!repair) break;
    repairs.push(repair);
    touched.add(repair.path.split('/')[0]);
  }

  for (const key of touched) {
    if (key in config) store.set(key, config[key]);
    else store.delete(key);
  }
  return repairs;
}
