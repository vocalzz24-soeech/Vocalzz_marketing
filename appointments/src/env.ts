export interface Env {
  DB: D1Database;
  /** The new database in Asia, connected only while moving the data across. */
  DB_NEW?: D1Database;
  CLINIC_NAME: string;
  CLINIC_ADDRESS: string;
  CLINIC_WHATSAPP: string;
  CLINIC_EMAIL: string;
  CLINIC_WEBSITE: string;
  DEFAULT_DURATION_MIN: string;
  /** Default length of a consultation, in minutes (30 if not set). */
  CONSULT_DURATION_MIN?: string;
  OPEN_HOUR: string;
  CLOSE_HOUR: string;
  WHATSAPP_TEMPLATE_LANG: string;
  WHATSAPP_TOKEN?: string;
  /** Resend (resend.com) API key, a secret. Without it, report emails are logged as "not_configured". */
  RESEND_API_KEY?: string;
  /** Where the weekly report goes (comma-separated for several), e.g. the owner's email. Set in the Cloudflare dashboard. */
  REPORT_EMAIL_TO?: string;
  /** Sender, on a domain verified in Resend, e.g. "Vocalzz Reports <reports@vocalzz.com>". */
  REPORT_EMAIL_FROM?: string;
  WHATSAPP_PHONE_NUMBER_ID?: string;
  /** Search Console service account (secrets) and property, for the SEO report page. */
  GSC_CLIENT_EMAIL?: string;
  GSC_PRIVATE_KEY?: string;
  GSC_SITE?: string;
  /** Google Ads report: account to read (digits only), optional manager id, optional developer token (secret). */
  GADS_CUSTOMER_ID?: string;
  GADS_LOGIN_CUSTOMER_ID?: string;
  GADS_DEVELOPER_TOKEN?: string;
  GADS_API_VERSION?: string;
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
