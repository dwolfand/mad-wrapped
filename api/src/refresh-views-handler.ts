/**
 * Scheduled Lambda function to refresh materialized views
 * Runs nightly to keep stats views up-to-date
 */

import { Handler, ScheduledEvent } from "aws-lambda";
import * as Sentry from "@sentry/node";
import { ProfilingIntegration } from "@sentry/profiling-node";
import { Pool } from "pg";

// Initialize Sentry only if DSN is provided
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.STAGE || "dev",
    integrations: [new ProfilingIntegration()],
    tracesSampleRate: 1.0,
    profilesSampleRate: 1.0,
  });
}

interface RefreshResult {
  success: boolean;
  results?: Array<{
    view_name: string;
    rows_count: number;
    refresh_duration_ms: number;
  }>;
  totalDuration?: number;
  error?: string;
}

/**
 * Lambda handler for refreshing materialized views on a schedule
 */
export const handler: Handler<ScheduledEvent, RefreshResult> = async (
  event
) => {
  console.log(
    "🔄 Refresh Views Lambda invoked at:",
    new Date().toISOString()
  );
  console.log("Event:", JSON.stringify(event, null, 2));

  const startTime = Date.now();
  let pool: Pool | null = null;

  try {
    // Create database connection
    pool = new Pool({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || "5432"),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
    });

    console.log("🔌 Connected to PostgreSQL database");
    console.log(`📊 Database: ${process.env.DB_NAME}`);
    console.log(`🖥️  Host: ${process.env.DB_HOST}`);

    // Call the database function to refresh all materialized views
    console.log("🔄 Calling refresh_stats_materialized_views()...");
    
    const result = await pool.query(
      "SELECT * FROM refresh_stats_materialized_views()"
    );

    const totalDuration = Date.now() - startTime;

    console.log("✅ Materialized views refreshed successfully!");
    console.log("Results:", JSON.stringify(result.rows, null, 2));
    console.log(`⏱️  Total Lambda execution time: ${totalDuration}ms`);

    // Log individual view refresh times
    result.rows.forEach((row) => {
      console.log(
        `  - ${row.view_name}: ${row.rows_count} rows, ${row.refresh_duration_ms}ms`
      );
    });

    return {
      success: true,
      results: result.rows,
      totalDuration,
    };
  } catch (error: any) {
    console.error("❌ Error refreshing materialized views:", error);

    if (process.env.SENTRY_DSN) {
      Sentry.captureException(error);
      await Sentry.flush(2000);
    }

    return {
      success: false,
      error: error.message || "Unknown error occurred",
    };
  } finally {
    // Clean up database connection
    if (pool) {
      await pool.end();
      console.log("🔌 Database connection closed");
    }
  }
};

