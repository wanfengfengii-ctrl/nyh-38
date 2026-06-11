export interface Result<T = void> {
  success: boolean;
  data?: T;
  error?: string;
  warnings?: string[];
}

export interface ValidationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
}

export function success<T>(data: T): Result<T> {
  return { success: true, data };
}

export function successWithWarnings<T>(data: T, warnings: string[]): Result<T> {
  return { success: true, data, warnings };
}

export function failure<T = void>(error: string): Result<T> {
  return { success: false, error };
}

export function failureWithWarnings<T = void>(error: string, warnings: string[]): Result<T> {
  return { success: false, error, warnings };
}

export function ok(): Result<void> {
  return { success: true };
}

export function validationSuccess(): ValidationResult {
  return { success: true, errors: [], warnings: [] };
}

export function validationFailure(errors: string[], warnings: string[] = [] ): ValidationResult {
  return { success: errors.length === 0, errors, warnings };
}
