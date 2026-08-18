/**
 * FACT API Client
 * Typed fetch wrappers for all /api/v1/ backend endpoints.
 * Base URL reads from env — falls back to localhost for dev.
 */

import { getAuth } from 'firebase/auth';

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QueryResponse {
  answer: string;
  cache_hit: boolean;
  latency_ms: number;
  query_id: string;
}

export interface QueryHistoryItem {
  query_id: string;
  query: string;
  answer: string;
  cache_hit: boolean;
  latency_ms: number;
  created_at: string;
}

export interface QueryHistoryResponse {
  items: QueryHistoryItem[];
}

export interface HealthResponse {
  status: 'ok' | 'degraded' | 'down';
  uptime_seconds: number;
  driver_ready: boolean;
}

export interface MetricsResponse {
  total_queries: number;
  cache_hit_rate: number;   // 0.0 – 1.0
  avg_latency_ms: number;
  uptime_seconds: number;
}

export interface CacheStatusResponse {
  status: 'healthy' | 'degraded' | 'offline';
  hit_count: number;
  total_queries: number;
  hit_rate: number;
}

export interface ExcelUploadResponse {
  success: boolean;
  message: string;
  file_path: string;
  file_name: string;
}

export interface ExcelSheetSummary {
  sheet_name: string;
  row_count_estimate: number;
  column_count_estimate: number;
  columns: string[];
}

export interface ExcelOverviewResponse {
  file_path: string;
  file_name: string;
  sheet_count: number;
  sheets: ExcelSheetSummary[];
  cached: boolean;
  execution_time_ms: number;
  status: 'success' | 'failed';
  error?: string;
}

export interface ExcelPreviewRow {
  [key: string]: string | number | boolean | null;
}

export interface ExcelPreviewResponse {
  file_path: string;
  file_name: string;
  sheet_name: string;
  columns: string[];
  rows: ExcelPreviewRow[];
  row_count: number;
  execution_time_ms: number;
  status: 'success' | 'failed';
  error?: string;
}

// ── Billing ────────────────────────────────────────────────────────────────
export interface EntitlementsResponse {
  plan: 'free' | 'pro';
  queries_this_month: number;
  queries_limit: number;        // 50 free / 1000 pro
  features: {
    postgres: boolean;
    cache_warming: boolean;
    user_isolated_cache: boolean;
    analytics: boolean;
  };
}
// ───────────────────────────────────────────────────────────────────────────

// ── Database connection types ──────────────────────────────────────────────
export interface DatabaseConnectRequest {
  db_type: 'postgresql';
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

export interface DatabaseTestResponse {
  success: boolean;
  message: string;
}

export interface DatabaseConnectResponse {
  success: boolean;
  message: string;
}

export interface DatabaseStatusResponse {
  connected: boolean;
  uses_demo: boolean;
  source?: 'demo' | 'postgres' | 'csv' | 'federated';
  db_type?: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  tables?: string[];        // populated when source === 'csv'
  message: string;
}
// ───────────────────────────────────────────────────────────────────────────

// ── CSV upload types ─────────────────────────────────────────────────────────
export interface CsvColumnInfo {
  name: string;
  type: string;             // INTEGER | REAL | DATE | TEXT
}

export interface CsvUploadResponse {
  success: boolean;
  message: string;
  table: string;
  columns: CsvColumnInfo[];
  row_count: number;
}
// ───────────────────────────────────────────────────────────────────────────

export interface APIError {
  error: true;
  message: string;
  status: number;
  upgrade_url?: string;
  plan?: 'free' | 'pro';
}

type Result<T> = T | APIError;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await getAuth().currentUser?.getIdToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<Result<T>> {
  try {
    const authHeaders = await getAuthHeaders();

    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
        ...(options?.headers as Record<string, string> | undefined),
      },
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const detail = body.detail ?? {};

      if (res.status === 402) {
        return {
          error: true,
          message:
            (typeof detail === 'object' ? detail.message : detail) ??
            'Upgrade required.',
          status: 402,
          upgrade_url:
            (typeof detail === 'object' ? detail.upgrade_url : undefined) ??
            '/pricing',
          plan:
            (typeof detail === 'object' && detail.plan === 'pro')
              ? 'pro'
              : 'free',
        };
      }

      return {
        error: true,
        message:
          (typeof detail === 'object' ? detail.message : detail) ??
          body.message ??
          body.error ??
          `Request failed (${res.status})`,
        status: res.status,
      };
    }

    return (await res.json()) as T;
  } catch {
    return {
      error: true,
      message: 'Cannot reach the FACT backend. Is it running?',
      status: 0,
    };
  }
}

async function uploadRequest<T>(
  path: string,
  formData: FormData
): Promise<Result<T>> {
  try {
    const authHeaders = await getAuthHeaders();

    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        ...authHeaders,
      },
      body: formData,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return {
        error: true,
        message: body.detail ?? body.message ?? body.error ?? `Request failed (${res.status})`,
        status: res.status,
      };
    }

    return (await res.json()) as T;
  } catch {
    return {
      error: true,
      message: 'Cannot reach the FACT backend. Is it running?',
      status: 0,
    };
  }
}

// Type guard — use this in components to check for errors
export function isAPIError(result: Result<unknown>): result is APIError {
  return (result as APIError).error === true;
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

/**
 * POST /api/v1/query
 * Send a plain English question, get answer + cache metadata back.
 */
export async function postQuery(query: string): Promise<Result<QueryResponse>> {
  return request<QueryResponse>('/api/v1/query', {
    method: 'POST',
    body: JSON.stringify({ query }),
  });
}

/**
 * GET /api/v1/query/history
 * Returns saved query history for the current logged-in user.
 */
export async function getQueryHistory(limit: number = 50): Promise<Result<QueryHistoryResponse>> {
  return request<QueryHistoryResponse>(`/api/v1/query/history?limit=${limit}`);
}

/**
 * GET /api/v1/health
 * System health — used for the green/red status indicator.
 */
export async function getHealth(): Promise<Result<HealthResponse>> {
  return request<HealthResponse>('/api/v1/health');
}

/**
 * GET /api/v1/metrics
 * Performance metrics — used by the admin dashboard.
 */
export async function getMetrics(): Promise<Result<MetricsResponse>> {
  return request<MetricsResponse>('/api/v1/metrics');
}

/**
 * GET /api/v1/cache/status
 * Cache health — used by the admin dashboard.
 */
export async function getCacheStatus(): Promise<Result<CacheStatusResponse>> {
  return request<CacheStatusResponse>('/api/v1/cache/status');
}

/**
 * GET /api/v1/user/entitlements
 * Current user's plan, monthly usage count, and feature flags.
 * Use this to render the usage bar in the sidebar and lock Pro features.
 */
export async function getEntitlements(): Promise<Result<EntitlementsResponse>> {
  return request<EntitlementsResponse>('/api/v1/user/entitlements');
}

/**
 * POST /api/v1/database/test
 * Test PostgreSQL connection before saving it.
 */
export async function testDatabaseConnection(
  payload: DatabaseConnectRequest
): Promise<Result<DatabaseTestResponse>> {
  return request<DatabaseTestResponse>('/api/v1/database/test', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * POST /api/v1/database/connect
 * Save and activate PostgreSQL connection for current Pro user.
 */
export async function connectDatabase(
  payload: DatabaseConnectRequest
): Promise<Result<DatabaseConnectResponse>> {
  return request<DatabaseConnectResponse>('/api/v1/database/connect', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * GET /api/v1/database/status
 * Returns current user's database connection state.
 */
export async function getDatabaseStatus(): Promise<Result<DatabaseStatusResponse>> {
  return request<DatabaseStatusResponse>('/api/v1/database/status');
}

/**
 * POST /api/v1/excel/upload
 * Upload an Excel .xlsx file to the backend for the current user.
 */
export async function uploadExcelFile(file: File): Promise<Result<ExcelUploadResponse>> {
  const formData = new FormData();
  formData.append('file', file);
  return uploadRequest<ExcelUploadResponse>('/api/v1/excel/upload', formData);
}

/**
 * POST /api/v1/excel/overview
 * Get workbook overview: sheets, inferred headers, estimated shape.
 */
export async function getExcelOverview(filePath: string): Promise<Result<ExcelOverviewResponse>> {
  return request<ExcelOverviewResponse>('/api/v1/excel/overview', {
    method: 'POST',
    body: JSON.stringify({ file_path: filePath }),
  });
}

/**
 * POST /api/v1/excel/preview
 * Preview rows from one selected sheet.
 */
export async function getExcelPreview(
  filePath: string,
  sheetName: string,
  maxRows: number = 20
): Promise<Result<ExcelPreviewResponse>> {
  return request<ExcelPreviewResponse>('/api/v1/excel/preview', {
    method: 'POST',
    body: JSON.stringify({
      file_path: filePath,
      sheet_name: sheetName,
      max_rows: maxRows,
    }),
  });
}

/**
 * POST /api/v1/csv/upload
 * Upload a .csv file. The backend ingests it into the current user's private
 * SQLite database (typed columns) and routes all NL queries to it.
 */
export async function uploadCsvFile(file: File): Promise<Result<CsvUploadResponse>> {
  const formData = new FormData();
  formData.append('file', file);
  return uploadRequest<CsvUploadResponse>('/api/v1/csv/upload', formData);
}

/**
 * POST /api/v1/csv/remove
 * Remove the current user's uploaded CSV data source; queries fall back to demo.
 */
export async function removeCsv(): Promise<Result<DatabaseConnectResponse>> {
  return request<DatabaseConnectResponse>('/api/v1/csv/remove', { method: 'POST' });
}

/**
 * POST /api/v1/csv/remove-table
 * Remove ONE uploaded CSV table (Pro multi-CSV). If it was the last table, the
 * whole CSV source is dropped. Use removeCsv() to remove all at once.
 */
export async function removeCsvTable(table: string): Promise<Result<DatabaseConnectResponse>> {
  return request<DatabaseConnectResponse>('/api/v1/csv/remove-table', {
    method: 'POST',
    body: JSON.stringify({ table }),
  });
}