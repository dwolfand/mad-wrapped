import { Request, Response } from "express";
import * as Sentry from "@sentry/node";
import { pool } from "../utils/postgres";
import { computeCoachStats } from "../utils/stats/coachStats";
import { logActivity } from "../utils/logger";

const stage = process.env.STAGE || "dev";

export async function getCoachStats(req: Request, res: Response) {
  const { firstName, lastName } = req.params;
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  const userAgent = req.headers["user-agent"];

  try {
    // URL decode the names
    const decodedFirstName = decodeURIComponent(firstName);
    const decodedLastName = decodeURIComponent(lastName);

    console.log(
      `Querying coach stats for: ${decodedFirstName} ${decodedLastName}`
    );

    if (process.env.SENTRY_DSN) {
      Sentry.addBreadcrumb({
        category: "coach-stats-query",
        message: "Coach stats queried",
        data: {
          firstName: decodedFirstName,
          lastName: decodedLastName,
          ip,
          userAgent,
          stage,
        },
        level: "info",
      });
    }

    // Get stats from PostgreSQL
    const dbClient = await pool.connect();
    try {
      const stats = await computeCoachStats(
        dbClient,
        decodedFirstName,
        decodedLastName
      );

      if (!stats) {
        // Log the failed attempt
        await logActivity({
          type: "coach_stats_not_found",
          firstName: decodedFirstName,
          lastName: decodedLastName,
          ip,
          userAgent,
          status: 404,
          error: "Coach stats not found",
        });
        return res
          .status(404)
          .json({ error: "Stats not found for this coach" });
      }

      // Log the successful request
      await logActivity({
        type: "coach_stats_lookup",
        firstName: decodedFirstName,
        lastName: decodedLastName,
        ip,
        userAgent,
        status: 200,
      });

      res.json({
        ...stats,
        lastUpdated: new Date().toISOString(),
      });
    } finally {
      dbClient.release();
    }
  } catch (error) {
    console.error("Error fetching coach stats:", error);

    if (process.env.SENTRY_DSN) {
      Sentry.withScope((scope) => {
        scope.setExtra("ip", ip);
        scope.setExtra("userAgent", userAgent);
        scope.setExtra("stage", stage);
        Sentry.captureException(error);
      });
    }

    // Log the error
    await logActivity({
      type: "error",
      firstName: decodeURIComponent(firstName),
      lastName: decodeURIComponent(lastName),
      ip,
      userAgent,
      status: 500,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getCoachList(req: Request, res: Response) {
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  const userAgent = req.headers["user-agent"];

  try {
    console.log("Fetching list of coaches");

    const query = `
      SELECT 
        trainer_first_name as first_name,
        trainer_last_name as last_name,
        COUNT(DISTINCT (class_date::text || '-' || class_time::text || '-' || location_name)) as class_count
      FROM visits
      WHERE trainer_first_name IS NOT NULL
        AND trainer_last_name IS NOT NULL
        AND trainer_first_name != 'STAFF'
        AND trainer_last_name != 'STAFF'
        AND NOT cancelled
        AND NOT missed
        AND class_date >= '2025-01-01'
        AND class_date < '2026-01-01'
      GROUP BY trainer_first_name, trainer_last_name
      HAVING COUNT(DISTINCT (class_date::text || '-' || class_time::text || '-' || location_name)) >= 10
      ORDER BY class_count DESC
    `;

    const result = await pool.query(query);

    const coaches = result.rows.map((row) => ({
      firstName: row.first_name,
      lastName: row.last_name,
      fullName: `${row.first_name} ${row.last_name}`,
      classCount: parseInt(row.class_count),
    }));

    // Log the request
    await logActivity({
      type: "coach_list_fetch",
      ip,
      userAgent,
      status: 200,
    });

    res.json({ coaches });
  } catch (error) {
    console.error("Error fetching coach list:", error);

    if (process.env.SENTRY_DSN) {
      Sentry.captureException(error);
    }

    await logActivity({
      type: "error",
      ip,
      userAgent,
      status: 500,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    res.status(500).json({ error: "Internal server error" });
  }
}


