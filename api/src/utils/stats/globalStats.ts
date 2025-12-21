// Global stats computation - stats across all MADabolic members

import {
  GlobalStatsResult,
  YEAR_START,
  YEAR_END,
} from "./statsTypes";
import { timedClientQuery } from "../queryTimer";

// Cache for global stats - these are the same for all users
let globalStatsCache: GlobalStatsResult | null = null;
let globalStatsCacheTime: number = 0;
const GLOBAL_STATS_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// Materialized view staleness threshold - if older than this, fall back to live query
const MV_STALENESS_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function computeGlobalStats(
  client: any
): Promise<GlobalStatsResult> {
  // Check cache first - global stats are the same for everyone
  const now = Date.now();
  if (globalStatsCache && (now - globalStatsCacheTime) < GLOBAL_STATS_CACHE_TTL_MS) {
    console.log("⚡ Using cached global stats");
    return globalStatsCache;
  }

  // Try to use materialized view first
  const mvResult = await tryGetGlobalStatsFromMaterializedView(client);
  if (mvResult) {
    globalStatsCache = mvResult;
    globalStatsCacheTime = Date.now();
    return mvResult;
  }

  // Fall back to live query
  return computeGlobalStatsLive(client);
}

/**
 * Try to get global stats from materialized view
 * Returns null if view doesn't exist, is empty, or is too stale
 */
async function tryGetGlobalStatsFromMaterializedView(
  client: any
): Promise<GlobalStatsResult | null> {
  try {
    const result = await timedClientQuery(
      client,
      "global_stats_mv",
      `
        SELECT 
          total_members,
          total_classes,
          most_popular_time_slot,
          most_popular_day,
          most_popular_coach,
          avg_early_bird_score,
          computed_at
        FROM mv_global_stats
        LIMIT 1
      `,
      []
    );

    if (result.rows.length === 0) {
      console.log("⚠️ Global stats materialized view is empty, falling back to live query");
      return null;
    }

    const row = result.rows[0];
    const computedAt = new Date(row.computed_at).getTime();
    const age = Date.now() - computedAt;

    if (age > MV_STALENESS_THRESHOLD_MS) {
      console.log(`⚠️ Global stats materialized view is stale (${Math.round(age / 1000 / 60 / 60)}h old), falling back to live query`);
      return null;
    }

    console.log(`✅ Using global stats from materialized view (${Math.round(age / 1000 / 60)}m old)`);

    const totalMembers = parseInt(row.total_members || "0");
    const totalClasses = parseInt(row.total_classes || "0");

    return {
      totalMembers,
      totalClasses,
      averageClassesPerMember: totalMembers > 0 ? totalClasses / totalMembers : 0,
      mostPopularTimeSlot: row.most_popular_time_slot || "07:30 AM",
      mostPopularDay: row.most_popular_day?.trim() || "Monday",
      mostPopularCoach: row.most_popular_coach || "Unknown",
      averageEarlyBirdScore: parseInt(row.avg_early_bird_score || "0"),
    };
  } catch (error: any) {
    // If materialized view doesn't exist yet, fall back gracefully
    if (error.code === '42P01') { // undefined_table
      console.log("ℹ️ Global stats materialized view not found, using live query");
      return null;
    }
    console.error("Error querying global stats materialized view:", error);
    return null;
  }
}

/**
 * Compute global stats with live query (original implementation)
 */
async function computeGlobalStatsLive(
  client: any
): Promise<GlobalStatsResult> {

  console.log("🔄 Computing global stats with live query");
  
  // Combined query for all global stats
  const globalResult = await timedClientQuery(
    client,
    "global_stats_live",
    `
      WITH 
      -- Base filtered visits
      year_visits AS (
        SELECT *
        FROM visits
        WHERE class_date >= $1 AND class_date <= $2
      ),
      -- Basic stats
      basic_stats AS (
        SELECT 
          COUNT(DISTINCT client_dupont_location_id) as total_members,
          COUNT(*) FILTER (WHERE NOT cancelled AND NOT missed) as total_classes
        FROM year_visits
      ),
      -- Most popular time slot
      time_slot_stats AS (
        SELECT 
          TO_CHAR(class_time, 'HH12:MI AM') as time_slot,
          COUNT(*) as slot_count
        FROM year_visits
        WHERE NOT cancelled AND NOT missed
          AND class_time IS NOT NULL
        GROUP BY class_time
        ORDER BY slot_count DESC
        LIMIT 1
      ),
      -- Most popular day
      day_stats AS (
        SELECT 
          TO_CHAR(class_date, 'Day') as day_name,
          COUNT(*) as day_count
        FROM year_visits
        WHERE NOT cancelled AND NOT missed
        GROUP BY TO_CHAR(class_date, 'Day'), EXTRACT(DOW FROM class_date)
        ORDER BY day_count DESC
        LIMIT 1
      ),
      -- Most popular coach
      coach_stats AS (
        SELECT 
          CONCAT(trainer_first_name, ' ', trainer_last_name) as coach_name,
          COUNT(*) as class_count
        FROM year_visits
        WHERE NOT cancelled AND NOT missed
          AND trainer_first_name IS NOT NULL
        GROUP BY trainer_first_name, trainer_last_name
        ORDER BY class_count DESC
        LIMIT 1
      ),
      -- Average early bird score
      member_early_bird AS (
        SELECT 
          client_dupont_location_id,
          COUNT(*) FILTER (WHERE class_time IS NOT NULL AND EXTRACT(HOUR FROM class_time) < 8) * 100.0 / 
          NULLIF(COUNT(*), 0) as early_bird_score
        FROM year_visits
        WHERE NOT cancelled AND NOT missed
        GROUP BY client_dupont_location_id
      ),
      avg_early_bird AS (
        SELECT COALESCE(ROUND(AVG(early_bird_score)), 0) as avg_early_bird_score
        FROM member_early_bird
      )
      SELECT 
        (SELECT total_members FROM basic_stats) as total_members,
        (SELECT total_classes FROM basic_stats) as total_classes,
        (SELECT time_slot FROM time_slot_stats) as most_popular_time_slot,
        (SELECT day_name FROM day_stats) as most_popular_day,
        (SELECT coach_name FROM coach_stats) as most_popular_coach,
        (SELECT avg_early_bird_score FROM avg_early_bird) as avg_early_bird_score
    `,
    [YEAR_START, YEAR_END]
  );

  const row = globalResult.rows[0] || {};

  const totalMembers = parseInt(row.total_members || "0");
  const totalClasses = parseInt(row.total_classes || "0");

  const result: GlobalStatsResult = {
    totalMembers,
    totalClasses,
    averageClassesPerMember: totalMembers > 0 ? totalClasses / totalMembers : 0,
    mostPopularTimeSlot: row.most_popular_time_slot || "07:30 AM",
    mostPopularDay: row.most_popular_day?.trim() || "Monday",
    mostPopularCoach: row.most_popular_coach || "Unknown",
    averageEarlyBirdScore: parseInt(row.avg_early_bird_score || "0"),
  };

  // Update cache
  globalStatsCache = result;
  globalStatsCacheTime = Date.now();
  console.log("📦 Cached global stats from live query");

  return result;
}
