import { Pool } from "pg";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

interface StatsResult {
  clientId: string;
  studioId: string;
  firstName: string;
  lastName: string;
  email: string;
  firstSeen: string;
  lastUpdated: string;
  totalClasses: number;
  allTimeClasses: number;
  classesByYear: Array<{ year: number; count: number }>;
  totalCancellations: number;
  totalLateBookings: number;
  topCoach: string;
  favoriteTimeOfDay: string;
  topThreeTimeSlots: string[];
  mostFrequentDay: string;
  longestStreak: number;
  earlyBirdScore: number;
  classesPerMonth: Array<{ month: string; count: string }>;
  favoriteLocation: { name: string; percentage: number };
  locationBreakdown: Array<{ name: string; count: number; percentage: number }>;
  perfectMadWeeks: number;
  durabilityClasses: number;
  anaerobicClasses: number;
  momentumClasses: number;
  deloadClasses: number;
  peerComparison: {
    averageClassesPerMonth: number;
    averageEarlyBirdScore: number;
    averageLateBookings: number;
    averageCancellations: number;
    topClassmates: Array<{
      firstName: string;
      lastName: string;
      sharedClasses: number;
    }>;
    percentiles: {
      totalClasses: number;
      earlyBirdScore: number;
      classesPerMonth: number;
      lateBookings: number;
      cancellations: number;
      perfectWeeks: number;
    };
  };
  globalStats: {
    totalMembers: number;
    totalClasses: number;
    averageClassesPerMember: number;
    mostPopularTimeSlot: string;
    mostPopularDay: string;
    mostPopularCoach: string;
    averageEarlyBirdScore: number;
  };
}

export async function computeStatsForClient(
  pool: Pool,
  clientId: string,
  studioId: string
): Promise<StatsResult | null> {
  const client = await pool.connect();

  try {
    // First, get client info using dupont_location_id (which is the clientId parameter)
    // The studioId is kept for backward compatibility but we look up by dupont_location_id
    const clientInfoResult = await client.query(
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

    // Parse name from "LAST, FIRST" format and convert to title case
    let firstName = "";
    let lastName = "";
    if (clientInfo.name.includes(",")) {
      const [lastPart, firstPart] = clientInfo.name
        .split(",")
        .map((s: string) => s.trim());
      // Convert to title case: "WOLFAND" -> "Wolfand", "DAVID" -> "David"
      firstName = firstPart
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());
      lastName = lastPart
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());
    } else {
      // Fallback for names not in "LAST, FIRST" format
      const parts = clientInfo.name.split(" ");
      firstName =
        parts[0]?.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) || "";
      lastName =
        parts
          .slice(1)
          .join(" ")
          .toLowerCase()
          .replace(/\b\w/g, (c) => c.toUpperCase()) || "";
    }

    // Use the dupont_location_id as the unique identifier for all queries
    const dupontLocationId = clientInfo.dupont_location_id;
    const actualLocation = clientInfo.location;

    // Get first visit date (all time, not just 2025)
    const firstSeenResult = await client.query(
      `
      SELECT MIN(class_date) as first_seen
      FROM visits
      WHERE client_dupont_location_id = $1
        AND NOT cancelled AND NOT missed
    `,
      [dupontLocationId]
    );

    const firstSeen =
      firstSeenResult.rows[0]?.first_seen || clientInfo.created_at;

    // Total classes and cancellations (2025 only)
    const totalsResult = await client.query(
      `
      SELECT 
        COUNT(*) FILTER (WHERE NOT cancelled AND NOT missed) as total_classes,
        COUNT(*) FILTER (WHERE cancelled OR missed) as total_cancellations
      FROM visits
      WHERE client_dupont_location_id = $1
        AND EXTRACT(YEAR FROM class_date) = 2025
    `,
      [dupontLocationId]
    );

    const totalClasses = parseInt(totalsResult.rows[0].total_classes || "0");
    const totalCancellations = parseInt(
      totalsResult.rows[0].total_cancellations || "0"
    );

    // All-time classes and classes by year
    const allTimeResult = await client.query(
      `
      SELECT 
        COUNT(*) FILTER (WHERE NOT cancelled AND NOT missed) as all_time_classes
      FROM visits
      WHERE client_dupont_location_id = $1
    `,
      [dupontLocationId]
    );

    const allTimeClasses = parseInt(
      allTimeResult.rows[0].all_time_classes || "0"
    );

    // Classes by year (for historical trend)
    const classesByYearResult = await client.query(
      `
      SELECT 
        EXTRACT(YEAR FROM class_date)::integer as year,
        COUNT(*) as count
      FROM visits
      WHERE client_dupont_location_id = $1
        AND NOT cancelled AND NOT missed
      GROUP BY EXTRACT(YEAR FROM class_date)
      ORDER BY year ASC
    `,
      [dupontLocationId]
    );

    const classesByYear = classesByYearResult.rows.map((row) => ({
      year: parseInt(row.year),
      count: parseInt(row.count),
    }));

    // Top coach calculation (2025 only)
    const topCoachResult = await client.query(
      `
      SELECT 
        CONCAT(trainer_first_name, ' ', trainer_last_name) as coach_name,
        COUNT(*) as class_count
      FROM visits
      WHERE client_dupont_location_id = $1
        AND NOT cancelled AND NOT missed
        AND trainer_first_name IS NOT NULL
        AND EXTRACT(YEAR FROM class_date) = 2025
      GROUP BY trainer_first_name, trainer_last_name
      ORDER BY class_count DESC
      LIMIT 1
    `,
      [dupontLocationId]
    );

    const topCoach = topCoachResult.rows[0]?.coach_name || "Unknown";

    // Time of day analysis (2025 only)
    const timeSlotResult = await client.query(
      `
      SELECT 
        TO_CHAR(class_time, 'HH12:MI AM') as time_slot,
        COUNT(*) as slot_count
      FROM visits
      WHERE client_dupont_location_id = $1
        AND NOT cancelled AND NOT missed
        AND class_time IS NOT NULL
        AND EXTRACT(YEAR FROM class_date) = 2025
      GROUP BY class_time
      ORDER BY slot_count DESC
      LIMIT 3
    `,
      [dupontLocationId]
    );

    const favoriteTimeOfDay = timeSlotResult.rows[0]?.time_slot || "06:00 AM";
    const topThreeTimeSlots = timeSlotResult.rows.map((row) => row.time_slot);

    // Most frequent day (2025 only)
    const dayResult = await client.query(
      `
      SELECT 
        TO_CHAR(class_date, 'Day') as day_name,
        COUNT(*) as day_count
      FROM visits
      WHERE client_dupont_location_id = $1
        AND NOT cancelled AND NOT missed
        AND EXTRACT(YEAR FROM class_date) = 2025
      GROUP BY TO_CHAR(class_date, 'Day'), EXTRACT(DOW FROM class_date)
      ORDER BY day_count DESC
      LIMIT 1
    `,
      [dupontLocationId]
    );

    const mostFrequentDay = dayResult.rows[0]?.day_name?.trim() || "Monday";

    // Streak calculation (2025 only)
    const streakResult = await client.query(
      `
      WITH visit_dates AS (
        SELECT DISTINCT class_date::date as visit_date
        FROM visits
        WHERE client_dupont_location_id = $1
          AND NOT cancelled AND NOT missed
          AND EXTRACT(YEAR FROM class_date) = 2025
        ORDER BY class_date::date
      ),
      streaks AS (
        SELECT 
          visit_date,
          visit_date - (ROW_NUMBER() OVER (ORDER BY visit_date))::integer AS streak_group
        FROM visit_dates
      ),
      streak_lengths AS (
        SELECT 
          streak_group,
          COUNT(*) as streak_length
        FROM streaks
        GROUP BY streak_group
      )
      SELECT COALESCE(MAX(streak_length), 1) as longest_streak
      FROM streak_lengths
    `,
      [dupontLocationId]
    );

    const longestStreak = parseInt(streakResult.rows[0]?.longest_streak || "1");

    // Late bookings (booked within 2 hours of class) (2025 only)
    const lateBookingsResult = await client.query(
      `
      SELECT COUNT(*) as late_bookings
      FROM visits
      WHERE 
        client_dupont_location_id = $1
        AND NOT cancelled
        AND NOT missed
        AND creation_date_time IS NOT NULL
        AND class_date IS NOT NULL
        AND class_time IS NOT NULL
        AND (class_date + class_time - creation_date_time) < interval '2 hours'
        AND EXTRACT(YEAR FROM class_date) = 2025
    `,
      [dupontLocationId]
    );

    const totalLateBookings = parseInt(
      lateBookingsResult.rows[0].late_bookings || "0"
    );

    // Early bird score (percentage of classes before 8 AM) (2025 only)
    const earlyBirdResult = await client.query(
      `
      SELECT 
        CASE 
          WHEN COUNT(*) FILTER (WHERE NOT cancelled AND NOT missed) = 0 THEN 0
          ELSE ROUND(COUNT(*) FILTER (WHERE NOT cancelled AND NOT missed AND EXTRACT(HOUR FROM class_time) < 8) * 100.0 / 
               NULLIF(COUNT(*) FILTER (WHERE NOT cancelled AND NOT missed), 0))
        END as early_bird_score
      FROM visits
      WHERE client_dupont_location_id = $1
        AND class_time IS NOT NULL
        AND EXTRACT(YEAR FROM class_date) = 2025
    `,
      [dupontLocationId]
    );

    const earlyBirdScore = parseInt(
      earlyBirdResult.rows[0].early_bird_score || "0"
    );

    // Classes per month (2025 only)
    const monthlyResult = await client.query(
      `
      SELECT 
        TO_CHAR(class_date, 'Mon') as month,
        COUNT(*) as count
      FROM visits
      WHERE client_dupont_location_id = $1
        AND NOT cancelled AND NOT missed
        AND EXTRACT(YEAR FROM class_date) = 2025
      GROUP BY TO_CHAR(class_date, 'Mon'), EXTRACT(MONTH FROM class_date)
      ORDER BY EXTRACT(MONTH FROM class_date)
    `,
      [dupontLocationId]
    );

    const classesPerMonth = MONTHS.map((month) => {
      const found = monthlyResult.rows.find((row) => row.month === month);
      return {
        month,
        count: found?.count || "0",
      };
    });

    // Location stats (2025 only)
    const locationResult = await client.query(
      `
      WITH location_counts AS (
        SELECT 
          location_name,
          COUNT(*) as visit_count,
          ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER ()) as percentage
        FROM visits
        WHERE client_dupont_location_id = $1
          AND NOT cancelled AND NOT missed
          AND location_name IS NOT NULL
          AND EXTRACT(YEAR FROM class_date) = 2025
        GROUP BY location_name
        ORDER BY visit_count DESC
      )
      SELECT *
      FROM location_counts
    `,
      [dupontLocationId]
    );

    const favoriteLocation = {
      name: locationResult.rows[0]?.location_name || "Unknown",
      percentage: parseInt(locationResult.rows[0]?.percentage || "0"),
    };

    const locationBreakdown = locationResult.rows.map((row) => ({
      name: row.location_name,
      count: parseInt(row.visit_count),
      percentage: parseInt(row.percentage),
    }));

    // Calculate perfect MAD weeks (4+ classes per week) (2025 only)
    const perfectWeeksResult = await client.query(
      `
      WITH weekly_classes AS (
        SELECT 
          DATE_TRUNC('week', class_date) as week_start,
          COUNT(*) FILTER (WHERE NOT cancelled AND NOT missed) as classes_in_week
        FROM visits
        WHERE client_dupont_location_id = $1
          AND EXTRACT(YEAR FROM class_date) = 2025
        GROUP BY week_start
      )
      SELECT COUNT(*) as perfect_weeks
      FROM weekly_classes
      WHERE classes_in_week >= 4
    `,
      [dupontLocationId]
    );

    const perfectMadWeeks = parseInt(
      perfectWeeksResult.rows[0].perfect_weeks || "0"
    );

    // Get class type counts (using class_types lookup table) (2025 only)
    const classTypesResult = await client.query(
      `
      SELECT 
        COUNT(*) FILTER (WHERE ct.class_type = 'DURABILITY' AND NOT v.cancelled AND NOT v.missed) as durability_classes,
        COUNT(*) FILTER (WHERE ct.class_type = 'ANAEROBIC' AND NOT v.cancelled AND NOT v.missed) as anaerobic_classes,
        COUNT(*) FILTER (WHERE ct.class_type = 'MOMENTUM' AND NOT v.cancelled AND NOT v.missed) as momentum_classes,
        COUNT(*) FILTER (WHERE ct.class_type = 'DELOAD' AND NOT v.cancelled AND NOT v.missed) as deload_classes
      FROM visits v
      LEFT JOIN class_types ct ON v.class_date::DATE = ct.class_date
      WHERE v.client_dupont_location_id = $1
        AND EXTRACT(YEAR FROM v.class_date) = 2025
    `,
      [dupontLocationId]
    );

    const durabilityClasses = parseInt(
      classTypesResult.rows[0]?.durability_classes || "0"
    );
    const anaerobicClasses = parseInt(
      classTypesResult.rows[0]?.anaerobic_classes || "0"
    );
    const momentumClasses = parseInt(
      classTypesResult.rows[0]?.momentum_classes || "0"
    );
    const deloadClasses = parseInt(
      classTypesResult.rows[0]?.deload_classes || "0"
    );

    // Compute peer comparison stats (global across all locations)
    const peerComparison = await computePeerStats(client, dupontLocationId);

    // Compute global stats (across all MADabolic locations)
    const globalStats = await computeGlobalStats(client);

    return {
      clientId, // Return the dupont_location_id as clientId
      studioId, // Return the original studioId parameter
      firstName,
      lastName,
      email: clientInfo.email || "",
      firstSeen: firstSeen,
      lastUpdated: new Date().toISOString(),
      totalClasses,
      allTimeClasses,
      classesByYear,
      totalCancellations,
      totalLateBookings,
      topCoach,
      favoriteTimeOfDay,
      topThreeTimeSlots,
      mostFrequentDay,
      longestStreak,
      earlyBirdScore,
      classesPerMonth,
      favoriteLocation,
      locationBreakdown,
      perfectMadWeeks,
      durabilityClasses,
      anaerobicClasses,
      momentumClasses,
      deloadClasses,
      peerComparison,
      globalStats,
    };
  } finally {
    client.release();
  }
}

async function computePeerStats(client: any, dupontLocationId: string) {
  // Calculate averages across all MADabolic members globally (2025 only)
  const averagesResult = await client.query(
    `
    WITH member_stats AS (
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
      WHERE EXTRACT(YEAR FROM class_date) = 2025
      GROUP BY client_dupont_location_id
    )
    SELECT 
      COALESCE(AVG(classes_per_month), 0) as avg_classes_per_month,
      COALESCE(AVG(early_bird_score), 0) as avg_early_bird_score,
      COALESCE(AVG(late_bookings), 0) as avg_late_bookings,
      COALESCE(AVG(cancellations), 0) as avg_cancellations
    FROM member_stats
  `
  );

  // Find top classmates (people who attended the same classes) (2025 only)
  const classmatesResult = await client.query(
    `
    WITH member_classes AS (
      SELECT DISTINCT class_date, class_time, location_name
      FROM visits
      WHERE client_dupont_location_id = $1
        AND NOT cancelled AND NOT missed
        AND EXTRACT(YEAR FROM class_date) = 2025
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
        -- Exclude the person themselves (using unique dupont_location_id)
        v.client_dupont_location_id != $1
        AND NOT v.cancelled 
        AND NOT v.missed
        AND EXTRACT(YEAR FROM v.class_date) = 2025
      GROUP BY c.dupont_location_id, c.name
      ORDER BY shared_classes DESC
      LIMIT 3
    )
    SELECT *
    FROM classmate_counts
  `,
    [dupontLocationId]
  );

  const topClassmates = classmatesResult.rows.map((row) => {
    // Parse name from "LAST, FIRST" format and convert to title case
    let firstName = "";
    let lastName = "";
    if (row.name.includes(",")) {
      const [lastPart, firstPart] = row.name
        .split(",")
        .map((s: string) => s.trim());
      firstName = firstPart
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());
      lastName = lastPart
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());
    } else {
      const parts = row.name.split(" ");
      firstName =
        parts[0]
          ?.toLowerCase()
          .replace(/\b\w/g, (c) => c.toUpperCase())
          .trim() || "";
      lastName =
        parts
          .slice(1)
          .join(" ")
          .toLowerCase()
          .replace(/\b\w/g, (c) => c.toUpperCase())
          .trim() || "";
    }
    return {
      firstName,
      lastName,
      sharedClasses: parseInt(row.shared_classes),
    };
  });

  // Calculate percentiles globally (2025 only)
  const percentileQuery = `
    WITH member_stats AS (
      SELECT 
        v.client_dupont_location_id,
        COUNT(*) FILTER (WHERE NOT cancelled AND NOT missed) as total_classes,
        NULLIF(COUNT(*) FILTER (WHERE NOT cancelled AND NOT missed), 0) / 12.0 as classes_per_month,
        CASE 
          WHEN COUNT(*) FILTER (WHERE NOT cancelled AND NOT missed) = 0 THEN 0 
          ELSE COUNT(*) FILTER (WHERE NOT cancelled AND NOT missed AND class_time IS NOT NULL AND EXTRACT(HOUR FROM class_time) < 8) * 100.0 / 
               NULLIF(COUNT(*) FILTER (WHERE NOT cancelled AND NOT missed), 0)
        END as early_bird_score,
        COUNT(*) FILTER (WHERE NOT cancelled AND NOT missed AND creation_date_time IS NOT NULL AND class_date IS NOT NULL AND class_time IS NOT NULL AND (class_date + class_time - creation_date_time) < interval '2 hours') as late_bookings,
        COUNT(*) FILTER (WHERE cancelled OR missed) as cancellations
      FROM visits v
      WHERE EXTRACT(YEAR FROM v.class_date) = 2025
      GROUP BY v.client_dupont_location_id
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
        WHERE EXTRACT(YEAR FROM class_date) = 2025
        GROUP BY client_dupont_location_id, DATE_TRUNC('week', class_date)
      ) weekly_classes
      WHERE classes_in_week >= 4
      GROUP BY client_dupont_location_id
    ),
    full_stats AS (
      SELECT 
        ms.*,
        COALESCE(mpw.perfect_weeks_count, 0) as perfect_weeks
      FROM member_stats ms
      LEFT JOIN member_perfect_weeks mpw ON ms.client_dupont_location_id = mpw.client_dupont_location_id
    )
    SELECT 
      ROUND(100.0 * (SELECT COUNT(*) FROM full_stats f2 WHERE f2.total_classes <= fs.total_classes) / NULLIF((SELECT COUNT(*) FROM full_stats), 0)) as total_classes_percentile,
      ROUND(100.0 * (SELECT COUNT(*) FROM full_stats f2 WHERE f2.early_bird_score <= fs.early_bird_score) / NULLIF((SELECT COUNT(*) FROM full_stats), 0)) as early_bird_percentile,
      ROUND(100.0 * (SELECT COUNT(*) FROM full_stats f2 WHERE f2.classes_per_month <= fs.classes_per_month) / NULLIF((SELECT COUNT(*) FROM full_stats), 0)) as classes_per_month_percentile,
      ROUND(100.0 * (SELECT COUNT(*) FROM full_stats f2 WHERE f2.late_bookings <= fs.late_bookings) / NULLIF((SELECT COUNT(*) FROM full_stats), 0)) as late_bookings_percentile,
      ROUND(100.0 * (SELECT COUNT(*) FROM full_stats f2 WHERE f2.cancellations <= fs.cancellations) / NULLIF((SELECT COUNT(*) FROM full_stats), 0)) as cancellations_percentile,
      ROUND(100.0 * (SELECT COUNT(*) FROM full_stats f2 WHERE f2.perfect_weeks <= fs.perfect_weeks) / NULLIF((SELECT COUNT(*) FROM full_stats), 0)) as perfect_weeks_percentile
    FROM full_stats fs
    WHERE client_dupont_location_id = $1;
  `;

  const percentilesResult = await client.query(percentileQuery, [
    dupontLocationId,
  ]);

  const percentiles = percentilesResult.rows[0]
    ? {
        totalClasses: parseInt(
          percentilesResult.rows[0].total_classes_percentile || "0"
        ),
        earlyBirdScore: parseInt(
          percentilesResult.rows[0].early_bird_percentile || "0"
        ),
        classesPerMonth: parseInt(
          percentilesResult.rows[0].classes_per_month_percentile || "0"
        ),
        lateBookings: parseInt(
          percentilesResult.rows[0].late_bookings_percentile || "0"
        ),
        cancellations: parseInt(
          percentilesResult.rows[0].cancellations_percentile || "0"
        ),
        perfectWeeks: parseInt(
          percentilesResult.rows[0].perfect_weeks_percentile || "0"
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

  return {
    averageClassesPerMonth: parseFloat(
      averagesResult.rows[0].avg_classes_per_month || "0"
    ),
    averageEarlyBirdScore: parseFloat(
      averagesResult.rows[0].avg_early_bird_score || "0"
    ),
    averageLateBookings: parseFloat(
      averagesResult.rows[0].avg_late_bookings || "0"
    ),
    averageCancellations: parseFloat(
      averagesResult.rows[0].avg_cancellations || "0"
    ),
    topClassmates,
    percentiles,
  };
}

async function computeGlobalStats(client: any) {
  // Get basic stats across all MADabolic locations (2025 only)
  const basicStatsResult = await client.query(
    `
    SELECT 
      COUNT(DISTINCT client_dupont_location_id) as total_members,
      COUNT(*) FILTER (WHERE NOT cancelled AND NOT missed) as total_classes
    FROM visits
    WHERE EXTRACT(YEAR FROM class_date) = 2025
  `
  );

  const totalMembers = parseInt(basicStatsResult.rows[0].total_members || "0");
  const totalClasses = parseInt(basicStatsResult.rows[0].total_classes || "0");
  const averageClassesPerMember =
    totalMembers > 0 ? totalClasses / totalMembers : 0;

  // Get most popular time slot globally (2025 only)
  const timeSlotResult = await client.query(
    `
    SELECT 
      TO_CHAR(class_time, 'HH12:MI AM') as time_slot,
      COUNT(*) as slot_count
    FROM visits
    WHERE NOT cancelled AND NOT missed
      AND class_time IS NOT NULL
      AND EXTRACT(YEAR FROM class_date) = 2025
    GROUP BY class_time
    ORDER BY slot_count DESC
    LIMIT 1
  `
  );

  // Get most popular day globally (2025 only)
  const dayResult = await client.query(
    `
    SELECT 
      TO_CHAR(class_date, 'Day') as day_name,
      COUNT(*) as day_count
    FROM visits
    WHERE NOT cancelled AND NOT missed
      AND EXTRACT(YEAR FROM class_date) = 2025
    GROUP BY TO_CHAR(class_date, 'Day'), EXTRACT(DOW FROM class_date)
    ORDER BY day_count DESC
    LIMIT 1
  `
  );

  // Get most popular coach globally (2025 only)
  const coachResult = await client.query(
    `
    SELECT 
      CONCAT(trainer_first_name, ' ', trainer_last_name) as coach_name,
      COUNT(*) as class_count
    FROM visits
    WHERE NOT cancelled AND NOT missed
      AND trainer_first_name IS NOT NULL
      AND EXTRACT(YEAR FROM class_date) = 2025
    GROUP BY trainer_first_name, trainer_last_name
    ORDER BY class_count DESC
    LIMIT 1
  `
  );

  // Calculate average early bird score globally (2025 only)
  const earlyBirdResult = await client.query(
    `
    WITH member_scores AS (
      SELECT 
        client_dupont_location_id,
        COUNT(*) FILTER (WHERE class_time IS NOT NULL AND EXTRACT(HOUR FROM class_time) < 8) * 100.0 / 
        NULLIF(COUNT(*), 0) as early_bird_score
      FROM visits
      WHERE NOT cancelled AND NOT missed
        AND EXTRACT(YEAR FROM class_date) = 2025
      GROUP BY client_dupont_location_id
    )
    SELECT COALESCE(ROUND(AVG(early_bird_score)), 0) as avg_early_bird_score
    FROM member_scores
  `
  );

  return {
    totalMembers,
    totalClasses,
    averageClassesPerMember,
    mostPopularTimeSlot: timeSlotResult.rows[0]?.time_slot || "07:30 AM",
    mostPopularDay: dayResult.rows[0]?.day_name?.trim() || "Monday",
    mostPopularCoach: coachResult.rows[0]?.coach_name || "Unknown",
    averageEarlyBirdScore: parseInt(
      earlyBirdResult.rows[0].avg_early_bird_score || "0"
    ),
  };
}
