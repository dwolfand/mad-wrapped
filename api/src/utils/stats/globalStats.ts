// Global stats computation - stats across all MADabolic members

import {
  GlobalStatsResult,
  YEAR_START,
  YEAR_END,
} from "./statsTypes";

export async function computeGlobalStats(
  client: any
): Promise<GlobalStatsResult> {
  // Combined query for all global stats
  const globalResult = await client.query(
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

  return {
    totalMembers,
    totalClasses,
    averageClassesPerMember: totalMembers > 0 ? totalClasses / totalMembers : 0,
    mostPopularTimeSlot: row.most_popular_time_slot || "07:30 AM",
    mostPopularDay: row.most_popular_day?.trim() || "Monday",
    mostPopularCoach: row.most_popular_coach || "Unknown",
    averageEarlyBirdScore: parseInt(row.avg_early_bird_score || "0"),
  };
}
