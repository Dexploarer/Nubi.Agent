declare module 'zod' {
  export class ZodError extends Error {
    issues: ZodIssue[];
  }

  export interface ZodIssue {
    path: (string | number)[];
    message: string;
    code: string;
  }

  export class ZodType<T> {
    parse(data: unknown): T;
    safeParse(data: unknown): { success: boolean; data?: T; error?: ZodError };

    // Add missing methods
    min(min: number, message?: string): this;
    max(max: number, message?: string): this;
    int(message?: string): this;
    default(defaultValue: any): this;
    optional(): this;
  }

  export function object(shape: Record<string, any>): ZodType<any>;
  export function string(): ZodType<string>;
  export function number(): ZodType<number>;
  export function boolean(): ZodType<boolean>;
  export function array(schema: ZodType<any>): ZodType<any[]>;

  // Use a different name for the enum function to avoid reserved word issues
  export const enumType: (values: readonly [string, ...string[]]) => ZodType<string>;
}
