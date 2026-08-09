// Tipos mínimos del módulo integrado de Bun: bun:sqlite.
// Bun ya incluye la implementación nativa; esto solo le da tipos a tsc.

declare module "bun:sqlite" {
  export type SQLQueryBindings =
    | string
    | number
    | bigint
    | boolean
    | null
    | Uint8Array;

  export interface RunResult {
    changes: number | bigint;
    lastInsertRowid: number | bigint;
  }

  export class Statement<T = unknown> {
    get(...params: SQLQueryBindings[]): T | undefined;
    all(...params: SQLQueryBindings[]): T[];
    run(...params: SQLQueryBindings[]): RunResult;
    finalize(): void;
    readonly sql: string;
  }

  export interface DatabaseOptions {
    create?: boolean;
    readwrite?: boolean;
    readonly?: boolean;
    strict?: boolean;
    timeout?: number;
  }

  export class Database {
    constructor(filename: string, options?: DatabaseOptions);
    query<T = unknown>(sql: string): Statement<T>;
    run(sql: string, ...params: SQLQueryBindings[]): RunResult;
    close(): void;
    readonly filename: string;
  }
}
