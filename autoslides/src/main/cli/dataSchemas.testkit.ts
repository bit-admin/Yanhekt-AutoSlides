// For tests: check a command's real `data` against its published schema.
import Ajv from 'ajv';
import { expect } from 'vitest';
import type { JsonSchema } from './dataSchemas';

const ajv = new Ajv({ allErrors: true, strict: false });

export function expectMatchesSchema(schema: JsonSchema, data: unknown): void {
  const validate = ajv.compile(schema);
  const ok = validate(data);
  expect(ok, `${JSON.stringify(validate.errors)}\n${JSON.stringify(data)}`).toBe(true);
}

export function expectNotMatchesSchema(schema: JsonSchema, data: unknown): void {
  expect(ajv.compile(schema)(data)).toBe(false);
}
