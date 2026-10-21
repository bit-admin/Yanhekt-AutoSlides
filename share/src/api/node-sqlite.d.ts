// Test-only (testDb.ts). share/ has no @types/node, so declare just the part
// of Node's built-in SQLite the tests use.
declare module 'node:sqlite' {
  export class DatabaseSync {
    constructor(path: string, options?: { readOnly?: boolean });
    exec(sql: string): void;
    prepare(sql: string): {
      all(...params: Array<string | number | null>): unknown[];
      run(...params: Array<string | number | null>): unknown;
    };
  }
}
