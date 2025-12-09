// Per-client stats computation - combines multiple queries into CTEs for efficiency

import {
  ClientStatsResult,
  YEAR_START,
  YEAR_END,
  MONTHS,
  parseName,
} from "./statsTypes";
import { timedClientQuery } from "../queryTimer";

export async function computeClientStats(
  client: any,
  clientId: string
): Promise<ClientStatsResult | null> {
  // First get client info (needed to get dupont_location_id)
  const clientInfoResult = await timedClientQuery(
    client,
    "client_info_lookup",
    `
      SELECT id, location, dupont_location_id, name, email, created_at
      FROM clients
      WHERE dupont_location_id = $1
      LIMIT 1
    `,
    [clientId]
  );

  if (clientInfoResult.rows.length === 0) {
    return null;
  }

  const clientInfo = clientInfoResult.rows[0];
  const { firstName, lastName } = parseName(clientInfo.name);
  const dupontLocationId = clientInfo.dupont_location_id;

  // Combined CTE query for all per-client stats
  const combinedResult = await timedClientQuery(
    client,
    "client_combined_stats",
    `
      WITH 
      -- Base visits for this client in the year
      client_visits AS (
        SELECT *
        FROM visits
        WHERE client_dupont_location_id = $1
          AND class_date >= $2 AND class_date <= $3
      ),
      -- All-time visits for this client
      all_time_visits AS (
        SELECT *
        FROM visits
        WHERE client_dupont_location_id = $1
      ),
      -- First seen (all time)
      first_seen AS (
        SELECT MIN(class_date) as first_seen
        FROM all_time_visits
        WHERE NOT cancelled AND NOT missed
      ),
      -- Totals for the year
      totals AS (
        SELECT 
          COUNT(*) FILTER (WHERE NOT cancelled AND NOT missed) as total_classes,
          COUNT(*) FILTER (WHERE cancelled OR missed) as total_cancellations
        FROM client_visits
      ),
      -- All-time classes
      all_time_totals AS (
        SELECT COUNT(*) FILTER (WHERE NOT cancelled AND NOT missed) as all_time_classes
        FROM all_time_visits
      ),
      -- Classes by year
      classes_by_year AS (
        SELECT 
          EXTRACT(YEAR FROM class_date)::integer as year,
          COUNT(*) as count
        FROM all_time_visits
        WHERE NOT cancelled AND NOT missed
        GROUP BY EXTRACT(YEAR FROM class_date)
        ORDER BY year ASC
      ),
      -- Top coach
      top_coach AS (
        SELECT 
          CONCAT(trainer_first_name, ' ', trainer_last_name) as coach_name,
          COUNT(*) as class_count
        FROM client_visits
        WHERE NOT cancelled AND NOT missed
          AND trainer_first_name IS NOT NULL
        GROUP BY trainer_first_name, trainer_last_name
        ORDER BY class_count DESC
        LIMIT 1
      ),
      -- Time slots
      time_slots AS (
        SELECT 
          TO_CHAR(class_time, 'HH12:MI AM') as time_slot,
          COUNT(*) as slot_count
        FROM client_visits
        WHERE NOT cancelled AND NOT missed
          AND class_time IS NOT NULL
        GROUP BY class_time
        ORDER BY slot_count DESC
        LIMIT 3
      ),
      -- Most frequent day
      most_frequent_day AS (
        SELECT 
          TO_CHAR(class_date, 'Day') as day_name,
          COUNT(*) as day_count
        FROM client_visits
        WHERE NOT cancelled AND NOT missed
        GROUP BY TO_CHAR(class_date, 'Day'), EXTRACT(DOW FROM class_date)
        ORDER BY day_count DESC
        LIMIT 1
      ),
      -- Longest streak
      visit_dates AS (
        SELECT DISTINCT class_date::date as visit_date
        FROM client_visits
        WHERE NOT cancelled AND NOT missed
      ),
      streaks AS (
        SELECT 
          visit_date,
          visit_date - (ROW_NUMBER() OVER (ORDER BY visit_date))::integer AS streak_group
        FROM visit_dates
      ),
      streak_lengths AS (
        SELECT streak_group, COUNT(*) as streak_length
        FROM streaks
        GROUP BY streak_group
      ),
      longest_streak AS (
        SELECT COALESCE(MAX(streak_length), 1) as longest_streak
        FROM streak_lengths
      ),
      -- Late bookings
      late_bookings AS (
        SELECT COUNT(*) as late_bookings
        FROM client_visits
        WHERE NOT cancelled AND NOT missed
          AND creation_date_time IS NOT NULL
          AND class_time IS NOT NULL
          AND (class_date + class_time - creation_date_time) < interval '2 hours'
      ),
      -- Early bird score
      early_bird AS (
        SELECT 
          CASE 
            WHEN COUNT(*) FILTER (WHERE NOT cancelled AND NOT missed) = 0 THEN 0
            ELSE ROUND(COUNT(*) FILTER (WHERE NOT cancelled AND NOT missed AND EXTRACT(HOUR FROM class_time) < 8) * 100.0 / 
                 NULLIF(COUNT(*) FILTER (WHERE NOT cancelled AND NOT missed), 0))
          END as early_bird_score
        FROM client_visits
        WHERE class_time IS NOT NULL
      ),
      -- Classes per month
      monthly_classes AS (
        SELECT 
          TO_CHAR(class_date, 'Mon') as month,
          EXTRACT(MONTH FROM class_date) as month_num,
          COUNT(*) as count
        FROM client_visits
        WHERE NOT cancelled AND NOT missed
        GROUP BY TO_CHAR(class_date, 'Mon'), EXTRACT(MONTH FROM class_date)
      ),
      -- Location stats
      location_stats AS (
        SELECT 
          location_name,
          COUNT(*) as visit_count,
          ROUND(COUNT(*) * 100.0 / NULLIF(SUM(COUNT(*)) OVER (), 0)) as percentage
        FROM client_visits
        WHERE NOT cancelled AND NOT missed
          AND location_name IS NOT NULL
        GROUP BY location_name
        ORDER BY visit_count DESC
      ),
      -- Perfect weeks
      weekly_classes AS (
        SELECT 
          DATE_TRUNC('week', class_date) as week_start,
          COUNT(*) FILTER (WHERE NOT cancelled AND NOT missed) as classes_in_week
        FROM client_visits
        GROUP BY week_start
      ),
      perfect_weeks AS (
        SELECT COUNT(*) as perfect_weeks
        FROM weekly_classes
        WHERE classes_in_week >= 4
      ),
      -- Class types
      class_type_counts AS (
        SELECT 
          COUNT(*) FILTER (WHERE ct.class_type = 'DURABILITY' AND NOT v.cancelled AND NOT v.missed) as durability_classes,
          COUNT(*) FILTER (WHERE ct.class_type = 'ANAEROBIC' AND NOT v.cancelled AND NOT v.missed) as anaerobic_classes,
          COUNT(*) FILTER (WHERE ct.class_type = 'MOMENTUM' AND NOT v.cancelled AND NOT v.missed) as momentum_classes,
          COUNT(*) FILTER (WHERE ct.class_type = 'DELOAD' AND NOT v.cancelled AND NOT v.missed) as deload_classes
        FROM client_visits v
        LEFT JOIN class_types ct ON v.class_date::DATE = ct.class_date
      )
      SELECT 
        (SELECT first_seen FROM first_seen) as first_seen,
        (SELECT total_classes FROM totals) as total_classes,
        (SELECT total_cancellations FROM totals) as total_cancellations,
        (SELECT all_time_classes FROM all_time_totals) as all_time_classes,
        (SELECT coach_name FROM top_coach) as top_coach,
        (SELECT day_name FROM most_frequent_day) as most_frequent_day,
        (SELECT longest_streak FROM longest_streak) as longest_streak,
        (SELECT late_bookings FROM late_bookings) as late_bookings,
        (SELECT early_bird_score FROM early_bird) as early_bird_score,
        (SELECT perfect_weeks FROM perfect_weeks) as perfect_weeks,
        (SELECT durability_classes FROM class_type_counts) as durability_classes,
        (SELECT anaerobic_classes FROM class_type_counts) as anaerobic_classes,
        (SELECT momentum_classes FROM class_type_counts) as momentum_classes,
        (SELECT deload_classes FROM class_type_counts) as deload_classes,
        (SELECT COALESCE(json_agg(json_build_object('year', year, 'count', count) ORDER BY year), '[]'::json) FROM classes_by_year) as classes_by_year,
        (SELECT COALESCE(json_agg(time_slot ORDER BY slot_count DESC), '[]'::json) FROM time_slots) as time_slots,
        (SELECT COALESCE(json_agg(json_build_object('month', month, 'month_num', month_num, 'count', count)), '[]'::json) FROM monthly_classes) as monthly_classes,
        (SELECT COALESCE(json_agg(json_build_object('name', location_name, 'count', visit_count, 'percentage', percentage) ORDER BY visit_count DESC), '[]'::json) FROM location_stats) as location_stats
    `,
    [dupontLocationId, YEAR_START, YEAR_END]
  );

  const row = combinedResult.rows[0];

  // Parse classes by year
  const classesByYear = (row.classes_by_year || []).map((r: any) => ({
    year: parseInt(r.year),
    count: parseInt(r.count),
  }));

  // Parse time slots
  const timeSlots = row.time_slots || [];
  const favoriteTimeOfDay = timeSlots[0] || "06:00 AM";
  const topThreeTimeSlots = timeSlots.slice(0, 3);

  // Parse monthly classes into full 12-month array
  const monthlyData = row.monthly_classes || [];
  const classesPerMonth = MONTHS.map((month) => {
    const found = monthlyData.find((m: any) => m.month === month);
    return {
      month,
      count: found?.count?.toString() || "0",
    };
  });

  // Parse location stats
  const locationData = row.location_stats || [];
  const favoriteLocation = locationData[0]
    ? { name: locationData[0].name, percentage: parseInt(locationData[0].percentage || "0") }
    : { name: "Unknown", percentage: 0 };
  const locationBreakdown = locationData.map((loc: any) => ({
    name: loc.name,
    count: parseInt(loc.count),
    percentage: parseInt(loc.percentage),
  }));

  return {
    firstName,
    lastName,
    email: clientInfo.email || "",
    firstSeen: row.first_seen || clientInfo.created_at,
    totalClasses: parseInt(row.total_classes || "0"),
    allTimeClasses: parseInt(row.all_time_classes || "0"),
    classesByYear,
    totalCancellations: parseInt(row.total_cancellations || "0"),
    totalLateBookings: parseInt(row.late_bookings || "0"),
    topCoach: row.top_coach || "Unknown",
    favoriteTimeOfDay,
    topThreeTimeSlots,
    mostFrequentDay: row.most_frequent_day?.trim() || "Monday",
    longestStreak: parseInt(row.longest_streak || "1"),
    earlyBirdScore: parseInt(row.early_bird_score || "0"),
    classesPerMonth,
    favoriteLocation,
    locationBreakdown,
    perfectMadWeeks: parseInt(row.perfect_weeks || "0"),
    durabilityClasses: parseInt(row.durability_classes || "0"),
    anaerobicClasses: parseInt(row.anaerobic_classes || "0"),
    momentumClasses: parseInt(row.momentum_classes || "0"),
    deloadClasses: parseInt(row.deload_classes || "0"),
  };
}
