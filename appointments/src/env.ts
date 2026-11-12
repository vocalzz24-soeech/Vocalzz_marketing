export interface Env {
  DB: D1Database;
  CLINIC_NAME: string;
  CLINIC_ADDRESS: string;
  CLINIC_WHATSAPP: string;
  DEFAULT_DURATION_MIN: string;
  OPEN_HOUR: string;
  CLOSE_HOUR: string;
  WHATSAPP_TEMPLATE_LANG: string;
  WHATSAPP_TOKEN?: string;
  WHATSAPP_PHONE_NUMBER_ID?: string;
}

// Minimal D1 types so the project needs no extra type packages.
export interface D1Result<T = Record<string, unknown>> {
  results: T[];
  meta: { last_row_id?: number; changes?: number };
}
export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<D1Result>;
}
export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<D1Result[]>;
}
