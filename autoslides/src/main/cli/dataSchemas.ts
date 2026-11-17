// The shape of each command's `data`, as JSON Schema (draft 2020-12 subset),
// for `schema` to publish beside the older one-line `data` text and for the
// tests to check real answers against. Objects allow fields not listed here:
// a field may be added in a later version without breaking an agent; one is
// never removed or retyped without bumping DATA_SCHEMA_VERSION. Pure.

export const DATA_SCHEMA_VERSION = 1;

export type JsonSchema = Record<string, unknown>;

const str: JsonSchema = { type: 'string' };
const num: JsonSchema = { type: 'number' };
const int: JsonSchema = { type: 'integer' };
const bool: JsonSchema = { type: 'boolean' };
const orNull = (schema: JsonSchema): JsonSchema => ({ anyOf: [schema, { type: 'null' }] });
const strOrNull = orNull(str);
const oneOfStrings = (...values: string[]): JsonSchema => ({ type: 'string', enum: values });
const list = (items: JsonSchema): JsonSchema => ({ type: 'array', items });

/** An object with these fields; every field required unless named in `optional`. */
function obj(fields: Record<string, JsonSchema>, optional: string[] = []): JsonSchema {
  return {
    type: 'object',
    properties: fields,
    required: Object.keys(fields).filter((key) => !optional.includes(key)),
  };
}

const courseRow = obj({
  id: str,
  title: str,
  title_en: strOrNull,
  professors: list(str),
  college: strOrNull,
  term: strOrNull,
  classrooms: list(str),
  participants: orNull(num),
});

const streams = obj({ screen: bool, camera: bool });

const sessionRow = obj({
  id: str,
  title: str,
  week: orNull(num),
  day: orNull(num),
  started_at: strOrNull,
  ended_at: strOrNull,
  duration: num,
  streams,
});

/** `autoslides`: the app's signed-in account. */
const appAccount = orNull(obj({ name: str, badge: str }));
/** `yhdl`: where the token came from. */
const terminalAuth = obj({ source: str, account: strOrNull });

export const SEARCH_SCHEMA = obj({
  keyword: str,
  term: strOrNull,
  source: oneOfStrings('yanhekt', 'local', 'online'),
  page: int,
  last_page: int,
  total: int,
  courses: list(courseRow),
});

const mineFields = { page: int, last_page: int, total: int, courses: list(courseRow), note: str };
export const MINE_SCHEMA_TERMINAL = obj({ ...mineFields, auth: terminalAuth }, ['note']);
export const MINE_SCHEMA_APP = obj({ ...mineFields, account: appAccount }, ['note']);

const courseFields = {
  course: obj({ id: str, title: str, title_en: strOrNull, professors: list(str), college: strOrNull, term: strOrNull }),
  sessions: orNull(list(sessionRow)),
  note: str,
};
export const COURSE_SCHEMA_TERMINAL = obj({ ...courseFields, auth: orNull(terminalAuth) }, ['note']);
export const COURSE_SCHEMA_APP = obj({ ...courseFields, account: appAccount }, ['note']);

export const SESSION_SCHEMA = obj({
  session: obj({
    id: str,
    title: str,
    week: orNull(num),
    day: orNull(num),
    started_at: strOrNull,
    ended_at: strOrNull,
    duration: num,
    streams,
    mic: bool,
  }),
  course: obj({ id: str, title: str, title_en: strOrNull, college: strOrNull, term: strOrNull }),
});

export const TERMS_SCHEMA = obj({
  terms: list(obj({ id: strOrNull, term: str, label: str, label_en: str, current: bool })),
});

export const WHOAMI_SCHEMA_TERMINAL = obj({ source: oneOfStrings('flag', 'account', 'env', 'app'), account: strOrNull, badge: strOrNull });
export const WHOAMI_SCHEMA_APP = obj({ signed_in: { const: true }, account: strOrNull, badge: strOrNull });

const downloadItem = (statuses: string[]): JsonSchema =>
  obj(
    {
      session_id: str,
      course_id: strOrNull,
      course_title: strOrNull,
      session_title: strOrNull,
      stream: orNull(oneOfStrings('screen', 'camera')),
      status: oneOfStrings(...statuses),
      path: strOrNull,
      error: obj({ code: str, message: str }),
    },
    ['error'],
  );

export const DOWNLOAD_SCHEMA_TERMINAL = obj({
  output_dir: str,
  dry_run: bool,
  items: list(downloadItem(['downloaded', 'skipped', 'planned', 'failed', 'interrupted'])),
});
export const DOWNLOAD_SCHEMA_APP = obj({
  output_dir: str,
  dry_run: bool,
  waited: bool,
  items: list(downloadItem(['downloaded', 'skipped', 'planned', 'queued', 'failed'])),
});

const downloadRow = obj(
  {
    item_id: str,
    session_id: str,
    course_id: strOrNull,
    course_title: str,
    session_title: str,
    kind: oneOfStrings('screen', 'camera', 'audio'),
    status: oneOfStrings('queued', 'downloading', 'processing', 'completed', 'failed', 'cancelled', 'removed'),
    progress: num,
    path: strOrNull,
    error: str,
    added_at: str,
    completed_at: strOrNull,
    extraction: orNull(obj({ state: str, progress: num, error: str }, ['error'])),
  },
  ['error'],
);

/** One of three shapes, by action: list/wait, cancel/retry, clear. */
export const DOWNLOADS_SCHEMA = {
  anyOf: [
    obj({ output_dir: strOrNull, items: list(downloadRow) }),
    obj({ action: oneOfStrings('cancel', 'retry'), items: list({ allOf: [downloadRow, obj({ changed: bool })] }) }),
    obj({ removed: int }),
  ],
};

const settingValue: JsonSchema = { anyOf: [str, num, bool, { type: 'null' }] };
/** `config`, `config <key>` or `config <key> <value>`. */
export const CONFIG_SCHEMA = {
  anyOf: [
    obj({ settings: { type: 'object', additionalProperties: settingValue } }),
    obj({ key: str, value: settingValue, previous: settingValue, changed: bool, setting: str }),
    obj({ key: str, value: settingValue, setting: str }),
  ],
};

/** `schema` describes itself: an object, not checked field by field. */
export const SCHEMA_SCHEMA = obj({ program: str, version: str, commands: list({ type: 'object' }) });
