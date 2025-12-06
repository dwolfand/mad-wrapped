// Peer comparison stats computation

import {
  QueryResult,
  PeerStatsResult,
  YEAR_START,
  YEAR_END,
  parseName,
} from "./statsTypes";

export async function computePeerStats(
  client: any,
  dupontLocationId: string
): Promise<PeerStatsResult> {
  // Combined query for peer averages and percentiles
  const peerResult = await client.query(
    `
      WITH 
      -- Member stats for all members
      member_stats AS (
        SELECT 
          client_dupont_location_id,
          COUNT(*) FILTER (WHERE NOT cancelled AND NOT missed) as total_classes,
          NULLIF(COUNT(*) FILTER (WHERE NOT cancelled AND NOT missed), 0) / 12.0 as classes_per_month,
          CASE 
            WHEN COUNT(*) FILTER (WHERE NOT cancelled AND NOT missed) = 0 THEN 0 
            ELSE COUNT(*) FILTER (WHERE NOT cancelled AND NOT missed AND class_time IS NOT NULL AND EXTRACT(HOUR FROM class_time) < 8) * 100.0 / 
                 NULLIF(COUNT(*) FILTER (WHERE NOT cancelled AND NOT missed), 0)
          END as early_bird_score,
          COUNT(*) FILTER (WHERE NOT cancelled AND NOT missed AND creation_date_time IS NOT NULL AND class_date IS NOT NULL AND class_time IS NOT NULL AND (class_date + class_time - creation_date_time) < interval '2 hours') as late_bookings,
          COUNT(*) FILTER (WHERE cancelled OR missed) as cancellations
        FROM visits
        WHERE class_date >= $2 AND class_date <= $3
        GROUP BY client_dupont_location_id
      ),
      -- Perfect weeks per member
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
          WHERE class_date >= $2 AND class_date <= $3
          GROUP BY client_dupont_location_id, DATE_TRUNC('week', class_date)
        ) weekly_classes
        WHERE classes_in_week >= 4
        GROUP BY client_dupont_location_id
      ),
      -- Combined stats with perfect weeks
      full_stats AS (
        SELECT 
          ms.*,
          COALESCE(mpw.perfect_weeks_count, 0) as perfect_weeks
        FROM member_stats ms
        LEFT JOIN member_perfect_weeks mpw ON ms.client_dupont_location_id = mpw.client_dupont_location_id
      ),
      -- Averages across all members
      averages AS (
        SELECT 
          COALESCE(AVG(classes_per_month), 0) as avg_classes_per_month,
          COALESCE(AVG(early_bird_score), 0) as avg_early_bird_score,
          COALESCE(AVG(late_bookings), 0) as avg_late_bookings,
          COALESCE(AVG(cancellations), 0) as avg_cancellations
        FROM member_stats
      ),
      -- Percentiles for the specific client
      client_percentiles AS (
        SELECT 
          ROUND(100.0 * (SELECT COUNT(*) FROM full_stats f2 WHERE f2.total_classes <= fs.total_classes) / NULLIF((SELECT COUNT(*) FROM full_stats), 0)) as total_classes_percentile,
          ROUND(100.0 * (SELECT COUNT(*) FROM full_stats f2 WHERE f2.early_bird_score <= fs.early_bird_score) / NULLIF((SELECT COUNT(*) FROM full_stats), 0)) as early_bird_percentile,
          ROUND(100.0 * (SELECT COUNT(*) FROM full_stats f2 WHERE f2.classes_per_month <= fs.classes_per_month) / NULLIF((SELECT COUNT(*) FROM full_stats), 0)) as classes_per_month_percentile,
          ROUND(100.0 * (SELECT COUNT(*) FROM full_stats f2 WHERE f2.late_bookings <= fs.late_bookings) / NULLIF((SELECT COUNT(*) FROM full_stats), 0)) as late_bookings_percentile,
          ROUND(100.0 * (SELECT COUNT(*) FROM full_stats f2 WHERE f2.cancellations <= fs.cancellations) / NULLIF((SELECT COUNT(*) FROM full_stats), 0)) as cancellations_percentile,
          ROUND(100.0 * (SELECT COUNT(*) FROM full_stats f2 WHERE f2.perfect_weeks <= fs.perfect_weeks) / NULLIF((SELECT COUNT(*) FROM full_stats), 0)) as perfect_weeks_percentile
        FROM full_stats fs
        WHERE client_dupont_location_id = $1
      )
      SELECT 
        (SELECT avg_classes_per_month FROM averages) as avg_classes_per_month,
        (SELECT avg_early_bird_score FROM averages) as avg_early_bird_score,
        (SELECT avg_late_bookings FROM averages) as avg_late_bookings,
        (SELECT avg_cancellations FROM averages) as avg_cancellations,
        (SELECT total_classes_percentile FROM client_percentiles) as total_classes_percentile,
        (SELECT early_bird_percentile FROM client_percentiles) as early_bird_percentile,
        (SELECT classes_per_month_percentile FROM client_percentiles) as classes_per_month_percentile,
        (SELECT late_bookings_percentile FROM client_percentiles) as late_bookings_percentile,
        (SELECT cancellations_percentile FROM client_percentiles) as cancellations_percentile,
        (SELECT perfect_weeks_percentile FROM client_percentiles) as perfect_weeks_percentile
    `,
    [dupontLocationId, YEAR_START, YEAR_END]
  );

  // Top classmates query (separate because it needs different structure)
  const classmatesResult = await client.query(
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
        JOIN clients c ON v.client_dupont_location_id = c.dupont_location_id
        JOIN member_classes mc ON 
          v.class_date = mc.class_date AND 
          v.class_time = mc.class_time AND 
          v.location_name = mc.location_name
        WHERE 
          v.client_dupont_location_id != $1
          AND NOT v.cancelled 
          AND NOT v.missed
          AND v.class_date >= $2 AND v.class_date <= $3
        GROUP BY c.dupont_location_id, c.name
        ORDER BY shared_classes DESC
        LIMIT 3
      )
      SELECT * FROM classmate_counts
    `,
    [dupontLocationId, YEAR_START, YEAR_END]
  );

  const row = peerResult.rows[0] || {};

  const topClassmates = (classmatesResult as QueryResult).rows.map((r) => {
    const { firstName, lastName } = parseName(r.name);
    return {
      firstName,
      lastName,
      sharedClasses: parseInt(r.shared_classes),
    };
  });

  return {
    averageClassesPerMonth: parseFloat(row.avg_classes_per_month || "0"),
    averageEarlyBirdScore: parseFloat(row.avg_early_bird_score || "0"),
    averageLateBookings: parseFloat(row.avg_late_bookings || "0"),
    averageCancellations: parseFloat(row.avg_cancellations || "0"),
    topClassmates,
    percentiles: {
      totalClasses: parseInt(row.total_classes_percentile || "0"),
      earlyBirdScore: parseInt(row.early_bird_percentile || "0"),
      classesPerMonth: parseInt(row.classes_per_month_percentile || "0"),
      lateBookings: parseInt(row.late_bookings_percentile || "0"),
      cancellations: parseInt(row.cancellations_percentile || "0"),
      perfectWeeks: parseInt(row.perfect_weeks_percentile || "0"),
    },
  };
}
