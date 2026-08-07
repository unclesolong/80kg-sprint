export type ValidationResult<T> =
  | { valid: true; value: T }
  | { valid: false; issues: string[] }

class ValidationFailure extends Error {
  constructor(readonly issue: string) {
    super(issue)
  }
}

export const validate = <T>(parser: () => T): ValidationResult<T> => {
  try {
    return { valid: true, value: parser() }
  } catch (error) {
    return {
      valid: false,
      issues: [error instanceof ValidationFailure ? error.issue : 'response: invalid value']
    }
  }
}

export const record = (value: unknown, path: string): Record<string, unknown> => {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) throw new ValidationFailure(`${path}: expected object`)
  return value as Record<string, unknown>
}

export const exactKeys = (value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = [], path = 'response') => {
  const allowed = new Set([...required, ...optional])
  for (const key of required) if (!(key in value)) throw new ValidationFailure(`${path}.${key}: required`)
  for (const key of Object.keys(value)) if (!allowed.has(key)) throw new ValidationFailure(`${path}.${key}: unexpected key`)
}

export const text = (value: unknown, path: string, max: number, allowEmpty = false): string => {
  if (typeof value !== 'string' || value.length > max || (!allowEmpty && value.trim().length === 0)) {
    throw new ValidationFailure(`${path}: invalid string`)
  }
  return value
}

export const number = (
  value: unknown,
  path: string,
  options: { min?: number; max?: number; integer?: boolean; positive?: boolean } = {}
): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new ValidationFailure(`${path}: invalid number`)
  if (options.integer && !Number.isInteger(value)) throw new ValidationFailure(`${path}: expected integer`)
  if (options.positive && value <= 0) throw new ValidationFailure(`${path}: expected positive number`)
  if (options.min != null && value < options.min) throw new ValidationFailure(`${path}: below minimum`)
  if (options.max != null && value > options.max) throw new ValidationFailure(`${path}: above maximum`)
  return value
}

export const boolean = (value: unknown, path: string): boolean => {
  if (typeof value !== 'boolean') throw new ValidationFailure(`${path}: invalid boolean`)
  return value
}

export const literal = <T extends string | number>(value: unknown, expected: T, path: string): T => {
  if (value !== expected) throw new ValidationFailure(`${path}: invalid literal`)
  return expected
}

export const enumeration = <T extends string>(value: unknown, values: readonly T[], path: string): T => {
  if (typeof value !== 'string' || !values.includes(value as T)) throw new ValidationFailure(`${path}: invalid enum`)
  return value as T
}

export const numericEnumeration = <T extends number>(value: unknown, values: readonly T[], path: string): T => {
  if (typeof value !== 'number' || !Number.isFinite(value) || !values.includes(value as T)) throw new ValidationFailure(`${path}: invalid enum`)
  return value as T
}

export const array = <T>(value: unknown, path: string, max: number, parser: (item: unknown, path: string) => T): T[] => {
  if (!Array.isArray(value) || value.length > max) throw new ValidationFailure(`${path}: invalid array`)
  return value.map((item, index) => parser(item, `${path}[${index}]`))
}

export const nullable = <T>(value: unknown, parser: (value: unknown) => T): T | null => value === null ? null : parser(value)
