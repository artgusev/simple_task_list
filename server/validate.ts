import { PROJECT_COLORS, type ProjectColor } from '../shared/types.js';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export type Body = Record<string, unknown>;

export function object(value: unknown, what = 'body'): Body {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new HttpError(400, `Expected ${what} to be a JSON object`);
  }
  return value as Body;
}

export function list(value: unknown, what: string): unknown[] {
  if (!Array.isArray(value)) throw new HttpError(400, `Expected ${what} to be an array`);
  return value;
}

const ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

interface TextOptions {
  required?: boolean;
  allowEmpty?: boolean;
  max?: number;
}

/** The string at `key`; undefined when the key is absent (an error when required). */
export function text(
  body: Body,
  key: string,
  { required = false, allowEmpty = true, max = 20_000 }: TextOptions = {},
): string | undefined {
  const value = body[key];
  if (value === undefined) {
    if (required) throw new HttpError(400, `${key} is required`);
    return undefined;
  }
  if (typeof value !== 'string') throw new HttpError(400, `${key} must be a string`);
  if (!allowEmpty && value.trim() === '') throw new HttpError(400, `${key} must not be empty`);
  if (value.length > max) throw new HttpError(400, `${key} is too long (max ${max} characters)`);
  return value;
}

export function requiredText(body: Body, key: string, options: Omit<TextOptions, 'required'> = {}): string {
  return text(body, key, { ...options, required: true }) as string;
}

/** Client-generated ids are accepted so the UI can update optimistically; they must look like ids. */
export function id(body: Body, key = 'id'): string | undefined {
  const value = text(body, key, { max: 64 });
  if (value !== undefined && !ID_PATTERN.test(value)) throw new HttpError(400, `${key} is not a valid id`);
  return value;
}

export function isoDate(body: Body, key: string, required = false): string | undefined {
  const value = text(body, key, { required, max: 10 });
  if (value === undefined) return undefined;
  if (!isCalendarDate(value)) throw new HttpError(400, `${key} must be a date in YYYY-MM-DD form`);
  return value;
}

/** A date, an explicit null (clears the field), or undefined when the key is absent. */
export function isoDateOrNull(body: Body, key: string): string | null | undefined {
  if (body[key] === null) return null;
  return isoDate(body, key);
}

export function timestamp(body: Body, key: string): string | undefined {
  const value = text(body, key, { max: 40 });
  if (value === undefined) return undefined;
  if (Number.isNaN(Date.parse(value))) throw new HttpError(400, `${key} must be an ISO 8601 timestamp`);
  return value;
}

export function timestampOrNull(body: Body, key: string): string | null | undefined {
  if (body[key] === null) return null;
  return timestamp(body, key);
}

export function color(body: Body, key = 'color', required = false): ProjectColor | undefined {
  const value = text(body, key, { required, max: 20 });
  if (value === undefined) return undefined;
  if (!(PROJECT_COLORS as readonly string[]).includes(value)) {
    throw new HttpError(400, `${key} must be one of: ${PROJECT_COLORS.join(', ')}`);
  }
  return value as ProjectColor;
}

export function integer(body: Body, key: string): number | undefined {
  const value = body[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isInteger(value)) throw new HttpError(400, `${key} must be an integer`);
  return value;
}

function isCalendarDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}
