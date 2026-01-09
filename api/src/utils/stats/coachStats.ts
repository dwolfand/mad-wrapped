// Coach-specific stats computation

import { PoolClient } from "pg";
import { timedClientQuery } from "../queryTimer";

export interface CoachMonthlyCount {
  month: string;
  count: number;
  uniqueStudents: number;
}

export interface CoachStudentStats {
  firstName: string;
  lastName: string;
  totalClasses: number;
  firstClass: string;
  lastClass: string;
}

export interface CoachLocationStats {
  name: string;
  classCount: number;
  percentage: number;
}

export interface CoachTimeSlotStats {
  timeSlot: string;
  classCount: number;
  percentage: number;
}

export interface CoachStats {
  coachFirstName: string;
  coachLastName: string;
  coachFullName: string;
  firstClassDate: string;
  totalClasses: number;
  totalStudentVisits: number;
  uniqueStudents: number;
  locations: CoachLocationStats[];
  totalTeachingHours: number;
  busiestMonth: {
    month: string;
    classCount: number;
    uniqueStudents: number;
  };
  averageClassSize: number;
  topStudents: CoachStudentStats[];
  favoriteTimeSlot: CoachTimeSlotStats;
  allTimeSlots: CoachTimeSlotStats[];
  monthlyBreakdown: CoachMonthlyCount[];
  mostPopularDay: string;
  totalDurabilityClasses: number;
  totalAnaerobicClasses: number;
  totalMomentumClasses: number;
  totalDeloadClasses: number;
  studentRetentionRate: number; // % of students who came back after first class
  longestTeachingStreak: number; // consecutive days teaching
  earlyMorningWarrior: boolean; // taught most classes before 7am
  lateNightHero: boolean; // taught most classes after 7pm
}

export async function computeCoachStats(
  dbClient: PoolClient,
  coachFirstName: string,
  coachLastName: string
): Promise<CoachStats | null> {
  const operationStart = performance.now();
  console.log(
    `📊 Computing coach stats for: ${coachFirstName} ${coachLastName}`
  );

  try {
    // Query 1: Basic coach info and total stats
    const basicStatsQuery = `
      WITH class_sessions AS (
        SELECT DISTINCT
          class_date,
          class_time,
          location_name,
          COUNT(DISTINCT client_dupont_location_id) as class_size,
          MAX(num_mins) as class_duration_mins
        FROM visits
        WHERE trainer_first_name = $1
          AND trainer_last_name = $2
          AND NOT cancelled
          AND NOT missed
          AND class_date >= '2025-01-01'
          AND class_date < '2026-01-01'
        GROUP BY class_date, class_time, location_name
      ),
      all_visits AS (
        SELECT *
        FROM visits
        WHERE trainer_first_name = $1
          AND trainer_last_name = $2
          AND NOT cancelled
          AND NOT missed
          AND class_date >= '2025-01-01'
          AND class_date < '2026-01-01'
      )
      SELECT 
        (SELECT COUNT(*) FROM class_sessions) as total_classes,
        COUNT(DISTINCT av.client_dupont_location_id) as unique_students,
        COUNT(*) as total_student_visits,
        (SELECT SUM(class_duration_mins) / 60.0 FROM class_sessions) as total_teaching_hours,
        MIN(av.class_date) as first_class_date,
        AVG(cs.class_size) as average_class_size
      FROM all_visits av
      LEFT JOIN class_sessions cs 
        ON av.class_date = cs.class_date 
        AND av.class_time = cs.class_time
        AND av.location_name = cs.location_name
    `;

    const basicStats = await timedClientQuery(
      dbClient,
      "Coach Basic Stats",
      basicStatsQuery,
      [coachFirstName, coachLastName]
    );

    if (
      !basicStats.rows.length ||
      parseInt(basicStats.rows[0].total_classes) === 0
    ) {
      console.log(`❌ No stats found for coach: ${coachFirstName} ${coachLastName}`);
      return null;
    }

    // Query 2: Location breakdown
    const locationsQuery = `
      SELECT 
        location_name,
        COUNT(DISTINCT (class_date::text || '-' || class_time::text)) as class_count
      FROM visits
      WHERE trainer_first_name = $1
        AND trainer_last_name = $2
        AND NOT cancelled
        AND NOT missed
        AND class_date >= '2025-01-01'
        AND class_date < '2026-01-01'
      GROUP BY location_name
      ORDER BY class_count DESC
    `;

    const locationsResult = await timedClientQuery(
      dbClient,
      "Coach Locations",
      locationsQuery,
      [coachFirstName, coachLastName]
    );

    const totalClassesTaught = locationsResult.rows.reduce(
      (sum, row) => sum + parseInt(row.class_count),
      0
    );

    const locations: CoachLocationStats[] = locationsResult.rows.map((row) => ({
      name: row.location_name,
      classCount: parseInt(row.class_count),
      percentage:
        totalClassesTaught > 0
          ? (parseInt(row.class_count) / totalClassesTaught) * 100
          : 0,
    }));

    // Query 3: Top students by attendance
    const topStudentsQuery = `
      SELECT 
        c.name,
        COUNT(*) as total_classes,
        MIN(v.class_date) as first_class,
        MAX(v.class_date) as last_class
      FROM visits v
      JOIN clients c ON v.client_dupont_location_id = c.dupont_location_id
      WHERE v.trainer_first_name = $1
        AND v.trainer_last_name = $2
        AND NOT v.cancelled
        AND NOT v.missed
        AND v.class_date >= '2025-01-01'
        AND v.class_date < '2026-01-01'
      GROUP BY c.dupont_location_id, c.name
      ORDER BY total_classes DESC
      LIMIT 10
    `;

    const topStudentsResult = await timedClientQuery(
      dbClient,
      "Coach Top Students",
      topStudentsQuery,
      [coachFirstName, coachLastName]
    );

    const topStudents: CoachStudentStats[] = topStudentsResult.rows.map((row) => {
      // Parse name (format: "LAST, FIRST" or "FIRST LAST")
      let firstName = "";
      let lastName = "";
      if (row.name.includes(",")) {
        const [last, first] = row.name.split(",").map((s: string) => s.trim());
        firstName = first;
        lastName = last;
      } else {
        const parts = row.name.split(" ");
        firstName = parts[0] || "";
        lastName = parts.slice(1).join(" ") || "";
      }

      return {
        firstName,
        lastName,
        totalClasses: parseInt(row.total_classes),
        firstClass: row.first_class,
        lastClass: row.last_class,
      };
    });

    // Query 4: Monthly breakdown
    const monthlyQuery = `
      SELECT 
        TO_CHAR(class_date, 'Month') as month,
        COUNT(DISTINCT (class_date::text || '-' || class_time::text || '-' || location_name)) as class_count,
        COUNT(DISTINCT client_dupont_location_id) as unique_students
      FROM visits
      WHERE trainer_first_name = $1
        AND trainer_last_name = $2
        AND NOT cancelled
        AND NOT missed
        AND class_date >= '2025-01-01'
        AND class_date < '2026-01-01'
      GROUP BY TO_CHAR(class_date, 'Month'), EXTRACT(MONTH FROM class_date)
      ORDER BY EXTRACT(MONTH FROM class_date)
    `;

    const monthlyResult = await timedClientQuery(
      dbClient,
      "Coach Monthly Stats",
      monthlyQuery,
      [coachFirstName, coachLastName]
    );

    const monthlyBreakdown: CoachMonthlyCount[] = monthlyResult.rows.map((row) => ({
      month: row.month.trim(),
      count: parseInt(row.class_count),
      uniqueStudents: parseInt(row.unique_students),
    }));

    const busiestMonth =
      monthlyBreakdown.length > 0
        ? monthlyBreakdown.reduce((max, month) =>
            month.count > max.count ? month : max
          )
        : { month: "N/A", count: 0, uniqueStudents: 0 };

    // Query 5: Time slots
    const timeSlotsQuery = `
      SELECT 
        CASE 
          WHEN EXTRACT(HOUR FROM class_time) < 6 THEN 'Early Bird (Before 6 AM)'
          WHEN EXTRACT(HOUR FROM class_time) < 9 THEN 'Morning (6-9 AM)'
          WHEN EXTRACT(HOUR FROM class_time) < 12 THEN 'Late Morning (9 AM-12 PM)'
          WHEN EXTRACT(HOUR FROM class_time) < 17 THEN 'Afternoon (12-5 PM)'
          WHEN EXTRACT(HOUR FROM class_time) < 19 THEN 'Evening (5-7 PM)'
          ELSE 'Night (After 7 PM)'
        END as time_slot,
        COUNT(DISTINCT (class_date::text || '-' || class_time::text || '-' || location_name)) as class_count
      FROM visits
      WHERE trainer_first_name = $1
        AND trainer_last_name = $2
        AND NOT cancelled
        AND NOT missed
        AND class_date >= '2025-01-01'
        AND class_date < '2026-01-01'
      GROUP BY time_slot
      ORDER BY class_count DESC
    `;

    const timeSlotsResult = await timedClientQuery(
      dbClient,
      "Coach Time Slots",
      timeSlotsQuery,
      [coachFirstName, coachLastName]
    );

    const allTimeSlots: CoachTimeSlotStats[] = timeSlotsResult.rows.map((row) => ({
      timeSlot: row.time_slot,
      classCount: parseInt(row.class_count),
      percentage:
        totalClassesTaught > 0
          ? (parseInt(row.class_count) / totalClassesTaught) * 100
          : 0,
    }));

    const favoriteTimeSlot =
      allTimeSlots.length > 0
        ? allTimeSlots[0]
        : { timeSlot: "N/A", classCount: 0, percentage: 0 };

    // Query 6: Most popular day of week
    const popularDayQuery = `
      SELECT 
        TO_CHAR(class_date, 'Day') as day_of_week,
        COUNT(DISTINCT (class_date::text || '-' || class_time::text || '-' || location_name)) as class_count
      FROM visits
      WHERE trainer_first_name = $1
        AND trainer_last_name = $2
        AND NOT cancelled
        AND NOT missed
        AND class_date >= '2025-01-01'
        AND class_date < '2026-01-01'
      GROUP BY day_of_week
      ORDER BY class_count DESC
      LIMIT 1
    `;

    const popularDayResult = await timedClientQuery(
      dbClient,
      "Coach Popular Day",
      popularDayQuery,
      [coachFirstName, coachLastName]
    );

    const mostPopularDay =
      popularDayResult.rows.length > 0
        ? popularDayResult.rows[0].day_of_week.trim()
        : "N/A";

    // Query 7: Class type breakdown
    const classTypesQuery = `
      SELECT 
        UPPER(type_group) as class_type,
        COUNT(DISTINCT (class_date::text || '-' || class_time::text || '-' || location_name)) as count
      FROM visits
      WHERE trainer_first_name = $1
        AND trainer_last_name = $2
        AND NOT cancelled
        AND NOT missed
        AND class_date >= '2025-01-01'
        AND class_date < '2026-01-01'
        AND type_group IS NOT NULL
      GROUP BY UPPER(type_group)
    `;

    const classTypesResult = await timedClientQuery(
      dbClient,
      "Coach Class Types",
      classTypesQuery,
      [coachFirstName, coachLastName]
    );

    const classTypeCounts: { [key: string]: number } = {};
    classTypesResult.rows.forEach((row) => {
      classTypeCounts[row.class_type] = parseInt(row.count);
    });

    // Query 8: Student retention (students who came back after first class)
    const retentionQuery = `
      WITH first_visits AS (
        SELECT 
          client_dupont_location_id,
          MIN(class_date) as first_class_date
        FROM visits
        WHERE trainer_first_name = $1
          AND trainer_last_name = $2
          AND NOT cancelled
          AND NOT missed
          AND class_date >= '2025-01-01'
          AND class_date < '2026-01-01'
        GROUP BY client_dupont_location_id
      ),
      return_visits AS (
        SELECT DISTINCT v.client_dupont_location_id
        FROM visits v
        JOIN first_visits fv ON v.client_dupont_location_id = fv.client_dupont_location_id
        WHERE v.trainer_first_name = $1
          AND v.trainer_last_name = $2
          AND NOT v.cancelled
          AND NOT v.missed
          AND v.class_date > fv.first_class_date
          AND v.class_date >= '2025-01-01'
          AND v.class_date < '2026-01-01'
      )
      SELECT 
        COUNT(DISTINCT fv.client_dupont_location_id) as total_first_time_students,
        COUNT(DISTINCT rv.client_dupont_location_id) as returning_students
      FROM first_visits fv
      LEFT JOIN return_visits rv ON fv.client_dupont_location_id = rv.client_dupont_location_id
    `;

    const retentionResult = await timedClientQuery(
      dbClient,
      "Coach Retention Rate",
      retentionQuery,
      [coachFirstName, coachLastName]
    );

    const studentRetentionRate =
      retentionResult.rows.length > 0 &&
      parseInt(retentionResult.rows[0].total_first_time_students) > 0
        ? (parseInt(retentionResult.rows[0].returning_students) /
            parseInt(retentionResult.rows[0].total_first_time_students)) *
          100
        : 0;

    // Query 9: Longest teaching streak (consecutive days with at least one class)
    const streakQuery = `
      WITH teaching_days AS (
        SELECT DISTINCT class_date::date as teaching_date
        FROM visits
        WHERE trainer_first_name = $1
          AND trainer_last_name = $2
          AND NOT cancelled
          AND NOT missed
          AND class_date >= '2025-01-01'
          AND class_date < '2026-01-01'
        ORDER BY teaching_date
      ),
      streaks AS (
        SELECT 
          teaching_date,
          teaching_date - (ROW_NUMBER() OVER (ORDER BY teaching_date))::integer * INTERVAL '1 day' as streak_group
        FROM teaching_days
      )
      SELECT MAX(streak_length) as longest_streak
      FROM (
        SELECT COUNT(*) as streak_length
        FROM streaks
        GROUP BY streak_group
      ) streak_counts
    `;

    const streakResult = await timedClientQuery(
      dbClient,
      "Coach Teaching Streak",
      streakQuery,
      [coachFirstName, coachLastName]
    );

    const longestTeachingStreak =
      streakResult.rows.length > 0 && streakResult.rows[0].longest_streak
        ? parseInt(streakResult.rows[0].longest_streak)
        : 0;

    // Determine special badges
    const earlyMorningClasses =
      allTimeSlots.find((slot) => slot.timeSlot.includes("Early Bird"))
        ?.classCount || 0;
    const nightClasses =
      allTimeSlots.find((slot) => slot.timeSlot.includes("Night"))?.classCount ||
      0;
    const totalClassesForBadges = allTimeSlots.reduce(
      (sum, slot) => sum + slot.classCount,
      0
    );

    const earlyMorningWarrior =
      totalClassesForBadges > 0 && earlyMorningClasses / totalClassesForBadges > 0.3;
    const lateNightHero =
      totalClassesForBadges > 0 && nightClasses / totalClassesForBadges > 0.3;

    const totalDuration = Math.round(performance.now() - operationStart);
    console.log(
      `⏱️ Total coach stats computation for ${coachFirstName} ${coachLastName}: ${totalDuration}ms`
    );

    return {
      coachFirstName,
      coachLastName,
      coachFullName: `${coachFirstName} ${coachLastName}`,
      firstClassDate: basicStats.rows[0].first_class_date,
      totalClasses: parseInt(basicStats.rows[0].total_classes),
      totalStudentVisits: parseInt(basicStats.rows[0].total_student_visits),
      uniqueStudents: parseInt(basicStats.rows[0].unique_students),
      locations,
      totalTeachingHours: parseFloat(
        parseFloat(basicStats.rows[0].total_teaching_hours || "0").toFixed(1)
      ),
      busiestMonth: {
        month: busiestMonth.month,
        classCount: busiestMonth.count,
        uniqueStudents: busiestMonth.uniqueStudents,
      },
      averageClassSize: parseFloat(
        parseFloat(basicStats.rows[0].average_class_size || "0").toFixed(1)
      ),
      topStudents,
      favoriteTimeSlot,
      allTimeSlots,
      monthlyBreakdown,
      mostPopularDay,
      totalDurabilityClasses: classTypeCounts["DURABILITY"] || 0,
      totalAnaerobicClasses: classTypeCounts["ANAEROBIC"] || 0,
      totalMomentumClasses: classTypeCounts["MOMENTUM"] || 0,
      totalDeloadClasses: classTypeCounts["DELOAD"] || 0,
      studentRetentionRate: parseFloat(studentRetentionRate.toFixed(1)),
      longestTeachingStreak,
      earlyMorningWarrior,
      lateNightHero,
    };
  } catch (error) {
    console.error("Error computing coach stats:", error);
    throw error;
  }
}

