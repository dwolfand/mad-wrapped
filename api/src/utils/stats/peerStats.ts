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

  // Get all member stats in one query
  const result = await timedClientQuery(
    client,
    "all_member_stats",
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
  console.log(`📦 Cached peer stats for ${stats.length} members`);

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

export async function computePeerStats(
  client: any,
  dupontLocationId: string
): Promise<PeerStatsResult> {
  // Load cached member stats
  const { stats, averages } = await loadMemberStats(client);

  // Find this client's stats
  const clientStats = stats.find((s) => s.clientId === dupontLocationId);

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
  const percentiles = clientStats
    ? {
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
      }
    : {
        totalClasses: 0,
        earlyBirdScore: 0,
        classesPerMonth: 0,
        lateBookings: 0,
        cancellations: 0,
        perfectWeeks: 0,
      };

  // Top classmates query (separate because it needs different structure)
  // Note: We don't need date filters on the join side since we're joining on class_date
  // which is already filtered in member_classes
  const classmatesResult = await timedClientQuery(
    client,
    "top_classmates",
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

  const topClassmates = (classmatesResult as QueryResult).rows.map((r: any) => {
    const { firstName, lastName } = parseName(r.name);
    return {
      firstName,
      lastName,
      sharedClasses: parseInt(r.shared_classes),
    };
  });

  return {
    averageClassesPerMonth: averages.avgClassesPerMonth,
    averageEarlyBirdScore: averages.avgEarlyBirdScore,
    averageLateBookings: averages.avgLateBookings,
    averageCancellations: averages.avgCancellations,
    topClassmates,
    percentiles,
  };
}
