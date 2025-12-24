// Peer comparison stats computation

import {
  QueryResult,
  PeerStatsResult,
  YEAR_START,
  YEAR_END,
  parseName,
} from "./statsTypes";
import { timedClientQuery } from "../queryTimer";

// Cache for member stats - used for percentile calculations
interface MemberStats {
  clientId: string;
  totalClasses: number;
  classesPerMonth: number;
  earlyBirdScore: number;
  lateBookings: number;
  cancellations: number;
  perfectWeeks: number;
}

interface PeerAverages {
  avgClassesPerMonth: number;
  avgEarlyBirdScore: number;
  avgLateBookings: number;
  avgCancellations: number;
}

let memberStatsCache: MemberStats[] | null = null;
let peerAveragesCache: PeerAverages | null = null;
let peerStatsCacheTime: number = 0;
const PEER_STATS_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// Materialized view staleness threshold (for peer stats)
const MV_STALENESS_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Load and cache all member stats for percentile calculations
 */
async function loadMemberStats(
  client: any
): Promise<{ stats: MemberStats[]; averages: PeerAverages }> {
  const now = Date.now();
  if (
    memberStatsCache &&
    peerAveragesCache &&
    now - peerStatsCacheTime < PEER_STATS_CACHE_TTL_MS
  ) {
    console.log("⚡ Using cached peer stats");
    return { stats: memberStatsCache, averages: peerAveragesCache };
  }

  // Try to use materialized view first
  const mvResult = await tryGetPeerStatsFromMaterializedView(client);
  if (mvResult) {
    return mvResult;
  }

  // Fall back to live query
  return loadMemberStatsLive(client);
}

/**
 * Try to get peer stats from materialized view
 * Returns null if view doesn't exist, is empty, or is too stale
 */
async function tryGetPeerStatsFromMaterializedView(
  client: any
): Promise<{ stats: MemberStats[]; averages: PeerAverages } | null> {
  try {
    const result = await timedClientQuery(
      client,
      "peer_stats_mv",
      `
        SELECT 
          client_dupont_location_id,
          total_classes,
          classes_per_month,
          early_bird_score,
          late_bookings,
          cancellations,
          perfect_weeks,
          computed_at
        FROM mv_peer_stats
      `,
      []
    );

    if (result.rows.length === 0) {
      console.log(
        "⚠️ Peer stats materialized view is empty, falling back to live query"
      );
      return null;
    }

    // Check staleness using first row
    const firstRow = result.rows[0];
    const computedAt = new Date(firstRow.computed_at).getTime();
    const age = Date.now() - computedAt;

    if (age > MV_STALENESS_THRESHOLD_MS) {
      console.log(
        `⚠️ Peer stats materialized view is stale (${Math.round(
          age / 1000 / 60 / 60
        )}h old), falling back to live query`
      );
      return null;
    }

    console.log(
      `✅ Using peer stats from materialized view (${Math.round(
        age / 1000 / 60
      )}m old, ${result.rows.length} members)`
    );

    const stats: MemberStats[] = result.rows.map((row: any) => ({
      clientId: row.client_dupont_location_id,
      totalClasses: parseInt(row.total_classes || "0"),
      classesPerMonth: parseFloat(row.classes_per_month || "0"),
      earlyBirdScore: parseFloat(row.early_bird_score || "0"),
      lateBookings: parseInt(row.late_bookings || "0"),
      cancellations: parseInt(row.cancellations || "0"),
      perfectWeeks: parseInt(row.perfect_weeks || "0"),
    }));

    // Calculate averages
    const count = stats.length || 1;
    const averages: PeerAverages = {
      avgClassesPerMonth:
        stats.reduce((sum, s) => sum + s.classesPerMonth, 0) / count,
      avgEarlyBirdScore:
        stats.reduce((sum, s) => sum + s.earlyBirdScore, 0) / count,
      avgLateBookings:
        stats.reduce((sum, s) => sum + s.lateBookings, 0) / count,
      avgCancellations:
        stats.reduce((sum, s) => sum + s.cancellations, 0) / count,
    };

    // Update cache
    memberStatsCache = stats;
    peerAveragesCache = averages;
    peerStatsCacheTime = Date.now();

    return { stats, averages };
  } catch (error: any) {
    // If materialized view doesn't exist yet, fall back gracefully
    if (error.code === "42P01") {
      // undefined_table
      console.log(
        "ℹ️ Peer stats materialized view not found, using live query"
      );
      return null;
    }
    console.error("Error querying peer stats materialized view:", error);
    return null;
  }
}

/**
 * Load member stats with live query (original implementation)
 */
async function loadMemberStatsLive(
  client: any
): Promise<{ stats: MemberStats[]; averages: PeerAverages }> {
  console.log("🔄 Loading peer stats with live query");

  // Get all member stats in one query
  const result = await timedClientQuery(
    client,
    "all_member_stats_live",
    `
      WITH 
      member_stats AS (
        SELECT 
          client_dupont_location_id,
          COUNT(*) FILTER (WHERE NOT cancelled AND NOT missed) as total_classes,
          COALESCE(NULLIF(COUNT(*) FILTER (WHERE NOT cancelled AND NOT missed), 0) / 12.0, 0) as classes_per_month,
          CASE 
            WHEN COUNT(*) FILTER (WHERE NOT cancelled AND NOT missed) = 0 THEN 0 
            ELSE COUNT(*) FILTER (WHERE NOT cancelled AND NOT missed AND class_time IS NOT NULL AND EXTRACT(HOUR FROM class_time) < 8) * 100.0 / 
                 NULLIF(COUNT(*) FILTER (WHERE NOT cancelled AND NOT missed), 0)
          END as early_bird_score,
          COUNT(*) FILTER (WHERE NOT cancelled AND NOT missed AND creation_date_time IS NOT NULL AND class_date IS NOT NULL AND class_time IS NOT NULL AND (class_date + class_time - creation_date_time) < interval '2 hours') as late_bookings,
          COUNT(*) FILTER (WHERE cancelled OR missed) as cancellations
        FROM visits
        WHERE class_date >= $1 AND class_date <= $2
        GROUP BY client_dupont_location_id
      ),
      member_perfect_weeks AS (
        SELECT 
          client_dupont_location_id,
          COUNT(*) as perfect_weeks_count
        FROM (
          SELECT 
            client_dupont_location_id,
            DATE_TRUNC('week', class_date) as week_start,
            COUNT(*) FILTER (WHERE NOT cancelled AND NOT missed) as classes_in_week
          FROM visits
          WHERE class_date >= $1 AND class_date <= $2
          GROUP BY client_dupont_location_id, DATE_TRUNC('week', class_date)
        ) weekly_classes
        WHERE classes_in_week >= 4
        GROUP BY client_dupont_location_id
      )
      SELECT 
        ms.client_dupont_location_id,
        ms.total_classes,
        ms.classes_per_month,
        ms.early_bird_score,
        ms.late_bookings,
        ms.cancellations,
        COALESCE(mpw.perfect_weeks_count, 0) as perfect_weeks
      FROM member_stats ms
      LEFT JOIN member_perfect_weeks mpw ON ms.client_dupont_location_id = mpw.client_dupont_location_id
    `,
    [YEAR_START, YEAR_END]
  );

  const stats: MemberStats[] = result.rows.map((row: any) => ({
    clientId: row.client_dupont_location_id,
    totalClasses: parseInt(row.total_classes || "0"),
    classesPerMonth: parseFloat(row.classes_per_month || "0"),
    earlyBirdScore: parseFloat(row.early_bird_score || "0"),
    lateBookings: parseInt(row.late_bookings || "0"),
    cancellations: parseInt(row.cancellations || "0"),
    perfectWeeks: parseInt(row.perfect_weeks || "0"),
  }));

  // Calculate averages
  const count = stats.length || 1;
  const averages: PeerAverages = {
    avgClassesPerMonth:
      stats.reduce((sum, s) => sum + s.classesPerMonth, 0) / count,
    avgEarlyBirdScore:
      stats.reduce((sum, s) => sum + s.earlyBirdScore, 0) / count,
    avgLateBookings: stats.reduce((sum, s) => sum + s.lateBookings, 0) / count,
    avgCancellations:
      stats.reduce((sum, s) => sum + s.cancellations, 0) / count,
  };

  // Update cache
  memberStatsCache = stats;
  peerAveragesCache = averages;
  peerStatsCacheTime = Date.now();
  console.log(
    `📦 Cached peer stats from live query for ${stats.length} members`
  );

  return { stats, averages };
}

/**
 * Calculate percentile for a value within a sorted array
 */
function calculatePercentile(value: number, sortedValues: number[]): number {
  if (sortedValues.length === 0) return 0;
  const belowCount = sortedValues.filter((v) => v <= value).length;
  return Math.round((belowCount / sortedValues.length) * 100);
}

/**
 * Get workout buddies with live query
 */
async function getWorkoutBuddiesLive(
  client: any,
  dupontLocationId: string
): Promise<
  Array<{ firstName: string; lastName: string; sharedClasses: number }>
> {
  console.log(
    `🔄 Computing workout buddies with live query for ${dupontLocationId}`
  );

  const classmatesResult = await timedClientQuery(
    client,
    "top_classmates_live",
    `
      WITH member_classes AS (
        SELECT DISTINCT class_date, class_time, location_name
        FROM visits
        WHERE client_dupont_location_id = $1
          AND NOT cancelled AND NOT missed
          AND class_date >= $2 AND class_date <= $3
      ),
      classmate_counts AS (
        SELECT 
          c.dupont_location_id,
          c.name,
          COUNT(*) as shared_classes
        FROM visits v
        JOIN member_classes mc ON 
          v.class_date = mc.class_date AND 
          v.class_time = mc.class_time AND 
          v.location_name = mc.location_name
        JOIN clients c ON v.client_dupont_location_id = c.dupont_location_id
        WHERE 
          v.client_dupont_location_id != $1
          AND NOT v.cancelled 
          AND NOT v.missed
        GROUP BY c.dupont_location_id, c.name
        ORDER BY shared_classes DESC
        LIMIT 3
      )
      SELECT * FROM classmate_counts
    `,
    [dupontLocationId, YEAR_START, YEAR_END]
  );

  return (classmatesResult as QueryResult).rows.map((r: any) => {
    const { firstName, lastName } = parseName(r.name);
    return {
      firstName,
      lastName,
      sharedClasses: parseInt(r.shared_classes),
    };
  });
}

/**
 * Calculate stats for a single client on-the-fly
 */
async function calculateClientStatsLive(
  client: any,
  dupontLocationId: string
): Promise<MemberStats> {
  console.log(`🔄 Calculating stats on-the-fly for client ${dupontLocationId}`);

  const result = await timedClientQuery(
    client,
    "single_client_stats_live",
    `
      WITH 
      member_stats AS (
        SELECT 
          client_dupont_location_id,
          COUNT(*) FILTER (WHERE NOT cancelled AND NOT missed) as total_classes,
          COALESCE(NULLIF(COUNT(*) FILTER (WHERE NOT cancelled AND NOT missed), 0) / 12.0, 0) as classes_per_month,
          CASE 
            WHEN COUNT(*) FILTER (WHERE NOT cancelled AND NOT missed) = 0 THEN 0 
            ELSE COUNT(*) FILTER (WHERE NOT cancelled AND NOT missed AND class_time IS NOT NULL AND EXTRACT(HOUR FROM class_time) < 8) * 100.0 / 
                 NULLIF(COUNT(*) FILTER (WHERE NOT cancelled AND NOT missed), 0)
          END as early_bird_score,
          COUNT(*) FILTER (WHERE NOT cancelled AND NOT missed AND creation_date_time IS NOT NULL AND class_date IS NOT NULL AND class_time IS NOT NULL AND (class_date + class_time - creation_date_time) < interval '2 hours') as late_bookings,
          COUNT(*) FILTER (WHERE cancelled OR missed) as cancellations
        FROM visits
        WHERE client_dupont_location_id = $1
          AND class_date >= $2 AND class_date <= $3
        GROUP BY client_dupont_location_id
      ),
      member_perfect_weeks AS (
        SELECT 
          COUNT(*) as perfect_weeks_count
        FROM (
          SELECT 
            DATE_TRUNC('week', class_date) as week_start,
            COUNT(*) FILTER (WHERE NOT cancelled AND NOT missed) as classes_in_week
          FROM visits
          WHERE client_dupont_location_id = $1
            AND class_date >= $2 AND class_date <= $3
          GROUP BY DATE_TRUNC('week', class_date)
        ) weekly_classes
        WHERE classes_in_week >= 4
      )
      SELECT 
        ms.client_dupont_location_id,
        ms.total_classes,
        ms.classes_per_month,
        ms.early_bird_score,
        ms.late_bookings,
        ms.cancellations,
        COALESCE(mpw.perfect_weeks_count, 0) as perfect_weeks
      FROM member_stats ms
      LEFT JOIN member_perfect_weeks mpw ON true
    `,
    [dupontLocationId, YEAR_START, YEAR_END]
  );

  if (result.rows.length === 0) {
    // Client has no visits in the year
    return {
      clientId: dupontLocationId,
      totalClasses: 0,
      classesPerMonth: 0,
      earlyBirdScore: 0,
      lateBookings: 0,
      cancellations: 0,
      perfectWeeks: 0,
    };
  }

  const row = result.rows[0];
  return {
    clientId: dupontLocationId,
    totalClasses: parseInt(row.total_classes || "0"),
    classesPerMonth: parseFloat(row.classes_per_month || "0"),
    earlyBirdScore: parseFloat(row.early_bird_score || "0"),
    lateBookings: parseInt(row.late_bookings || "0"),
    cancellations: parseInt(row.cancellations || "0"),
    perfectWeeks: parseInt(row.perfect_weeks || "0"),
  };
}

export async function computePeerStats(
  client: any,
  dupontLocationId: string
): Promise<PeerStatsResult> {
  // Load cached member stats
  const { stats, averages } = await loadMemberStats(client);

  // Find this client's stats
  let clientStats = stats.find((s) => s.clientId === dupontLocationId);

  // If client not found in cached stats, calculate on-the-fly
  if (!clientStats) {
    console.log(
      `⚠️ Client ${dupontLocationId} not found in cached peer stats (${stats.length} total members)`
    );
    console.log(`   Calculating stats on-the-fly for comparison`);
    clientStats = await calculateClientStatsLive(client, dupontLocationId);
  }

  // Pre-sort arrays for percentile calculations (only needed once per cache refresh)
  const sortedTotalClasses = stats
    .map((s) => s.totalClasses)
    .sort((a, b) => a - b);
  const sortedEarlyBird = stats
    .map((s) => s.earlyBirdScore)
    .sort((a, b) => a - b);
  const sortedClassesPerMonth = stats
    .map((s) => s.classesPerMonth)
    .sort((a, b) => a - b);
  const sortedLateBookings = stats
    .map((s) => s.lateBookings)
    .sort((a, b) => a - b);
  const sortedCancellations = stats
    .map((s) => s.cancellations)
    .sort((a, b) => a - b);
  const sortedPerfectWeeks = stats
    .map((s) => s.perfectWeeks)
    .sort((a, b) => a - b);

  // Calculate percentiles for this client
  const percentiles = {
    totalClasses: calculatePercentile(
      clientStats.totalClasses,
      sortedTotalClasses
    ),
    earlyBirdScore: calculatePercentile(
      clientStats.earlyBirdScore,
      sortedEarlyBird
    ),
    classesPerMonth: calculatePercentile(
      clientStats.classesPerMonth,
      sortedClassesPerMonth
    ),
    lateBookings: calculatePercentile(
      clientStats.lateBookings,
      sortedLateBookings
    ),
    cancellations: calculatePercentile(
      clientStats.cancellations,
      sortedCancellations
    ),
    perfectWeeks: calculatePercentile(
      clientStats.perfectWeeks,
      sortedPerfectWeeks
    ),
  };

  // Top classmates - using live query (no materialized view due to disk space)
  const topClassmates = await getWorkoutBuddiesLive(client, dupontLocationId);

  return {
    averageClassesPerMonth: averages.avgClassesPerMonth,
    averageEarlyBirdScore: averages.avgEarlyBirdScore,
    averageLateBookings: averages.avgLateBookings,
    averageCancellations: averages.avgCancellations,
    topClassmates,
    percentiles,
  };
}
