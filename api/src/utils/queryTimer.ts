import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";

// Threshold for logging slow queries (in ms)
const SLOW_QUERY_THRESHOLD = parseInt(
  process.env.SLOW_QUERY_THRESHOLD_MS || "200"
);

/**
 * Log a slow query warning
 */
function logSlowQuery(
  queryName: string,
  durationMs: number,
  sql: string,
  rowCount: number | null
): void {
  if (durationMs >= SLOW_QUERY_THRESHOLD) {
    console.warn(`⚠️ SLOW QUERY [${queryName}]: ${durationMs}ms`, {
      sql: sql.substring(0, 200) + (sql.length > 200 ? "..." : ""),
      rowCount,
    });
  }
}

/**
 * Execute a timed query using a pool
 */
export async function timedQuery<T extends QueryResultRow = any>(
  pool: Pool,
  queryName: string,
  sql: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const start = performance.now();

  try {
    const result = await pool.query<T>(sql, params);
    const durationMs = Math.round(performance.now() - start);
    logSlowQuery(queryName, durationMs, sql, result.rowCount);
    return result;
  } catch (error) {
    const durationMs = Math.round(performance.now() - start);
    console.error(
      `❌ Query [${queryName}] failed after ${durationMs}ms:`,
      error
    );
    throw error;
  }
}

/**
 * Execute a timed query using a client (from pool.connect())
 */
export async function timedClientQuery<T extends QueryResultRow = any>(
  client: PoolClient,
  queryName: string,
  sql: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const start = performance.now();

  try {
    const result = await client.query<T>(sql, params);
    const durationMs = Math.round(performance.now() - start);
    logSlowQuery(queryName, durationMs, sql, result.rowCount);
    return result;
  } catch (error) {
    const durationMs = Math.round(performance.now() - start);
    console.error(
      `❌ Query [${queryName}] failed after ${durationMs}ms:`,
      error
    );
    throw error;
  }
}
