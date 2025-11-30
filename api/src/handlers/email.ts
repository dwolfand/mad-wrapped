import { Request, Response } from "express";
import * as Sentry from "@sentry/node";
import { pool } from "../utils/postgres";
import { logActivity } from "../utils/logger";
import { sendStatsLinkEmail, sendAdminNotification } from "../utils/email";
import { getStudioShortName } from "../utils/studios";
import { Lambda } from "@aws-sdk/client-lambda";

const stage = process.env.STAGE || "dev";

// Initialize Lambda client
const lambdaClient = new Lambda({
  region: process.env.AWS_REGION || "us-east-1",
});

export async function lookupEmail(req: Request, res: Response) {
  const { email } = req.body;
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  const userAgent = req.headers["user-agent"];

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    // Look up client by email - must have dupont_location_id and 2025 visits
    const result = await pool.query(
      `
      SELECT DISTINCT c.id, c.location, c.dupont_location_id, c.name, c.email
      FROM clients c
      INNER JOIN visits v ON v.client_original_id = c.id AND v.client_location = c.location
      WHERE LOWER(c.email) = LOWER($1)
        AND c.dupont_location_id IS NOT NULL
        AND v.class_date >= '2025-01-01'
        AND v.class_date < '2026-01-01'
        AND NOT v.cancelled
        AND NOT v.missed
      LIMIT 1
      `,
      [email]
    );

    if (result.rows.length === 0) {
      console.log(
        `Email not found in database: ${email}. Invoking scraper Lambda asynchronously...`
      );

      try {
        // Invoke the scraper Lambda function asynchronously (fire and forget)
        const scraperFunctionName = `mad-wrapped-api-${stage}-scraper`;
        console.log(
          `Invoking Lambda function asynchronously: ${scraperFunctionName}`
        );

        await lambdaClient.invoke({
          FunctionName: scraperFunctionName,
          InvocationType: "Event", // Async invocation
          Payload: JSON.stringify({ email }),
        });

        console.log(`✅ Scraper Lambda invoked asynchronously for: ${email}`);

        await logActivity({
          type: "email_lookup",
          ip,
          userAgent,
          status: 202, // Accepted
          email,
        });

        return res.status(202).json({
          message:
            "We're searching for your data! If we find a matching member, we'll send you an email with your stats link shortly.",
          status: "processing",
        });
      } catch (scraperError) {
        console.error("Error invoking scraper Lambda:", scraperError);

        // Log the error
        await logActivity({
          type: "email_lookup",
          ip,
          userAgent,
          status: 500,
          error: `Failed to invoke scraper: ${email}`,
          email,
        });

        return res.status(500).json({
          error: "Unable to process request",
          message: "Please try again later or contact support.",
        });
      }
    }

    const client = result.rows[0];

    // Parse name from "LAST, FIRST" format
    let firstName = "";
    if (client.name.includes(",")) {
      const [, firstPart] = client.name.split(",").map((s: string) => s.trim());
      firstName = firstPart
        .toLowerCase()
        .replace(/\b\w/g, (c: string) => c.toUpperCase());
    } else {
      const parts = client.name.split(" ");
      firstName =
        parts[0]
          ?.toLowerCase()
          .replace(/\b\w/g, (c: string) => c.toUpperCase()) || "";
    }

    // Send email with stats link using dupont_location_id
    await sendStatsLinkEmail({
      email: client.email,
      firstName,
      clientId: client.dupont_location_id || client.id,
      studioId: client.location,
    });

    await logActivity({
      type: "email_lookup",
      clientId: client.dupont_location_id || client.id,
      studioId: client.location,
      ip,
      userAgent,
      status: 200,
      email,
    });

    res.json({
      message: "Check your email for a link to your year in review!",
      firstName,
    });
  } catch (error) {
    console.error("Error processing email lookup:", error);

    if (process.env.SENTRY_DSN) {
      Sentry.withScope((scope) => {
        scope.setExtra("ip", ip);
        scope.setExtra("userAgent", userAgent);
        scope.setExtra("email", email);
        scope.setExtra("stage", stage);
        Sentry.captureException(error);
      });
    }

    await logActivity({
      type: "error",
      ip,
      userAgent,
      status: 500,
      error: error instanceof Error ? error.message : "Unknown error",
      email,
    });

    res.status(500).json({ error: "Internal server error" });
  }
}

export async function requestNotification(req: Request, res: Response) {
  const { email, firstName, lastName, studio, isCustomStudio } = req.body;
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  const userAgent = req.headers["user-agent"];

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  if (!firstName || !lastName || !studio) {
    return res
      .status(400)
      .json({ error: "First name, last name, and studio are required" });
  }

  try {
    const lowerEmail = email.toLowerCase();

    // Check if already requested
    const existingRequest = await pool.query(
      `
      SELECT id FROM notification_requests
      WHERE email = $1
      LIMIT 1
      `,
      [lowerEmail]
    );

    if (existingRequest.rows.length > 0) {
      return res.json({
        message:
          "You're already on the notification list. We'll email you when it's ready!",
        firstName,
      });
    }

    // Save new request
    await pool.query(
      `
      INSERT INTO notification_requests (
        email, first_name, last_name, studio, studio_short_name,
        is_custom_studio, ip, user_agent, stage, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `,
      [
        lowerEmail,
        firstName,
        lastName,
        studio,
        getStudioShortName(studio),
        isCustomStudio || false,
        Array.isArray(ip) ? ip[0] : ip,
        userAgent,
        stage,
        "pending",
      ]
    );

    // Send admin notification (don't await to keep response time fast)
    sendAdminNotification({
      email,
      firstName,
      lastName,
      studio,
      isCustomStudio,
    }).catch((error) => {
      console.error("Error sending admin notification:", error);
      // Log the error but don't affect the response
      logActivity({
        type: "error",
        error: error instanceof Error ? error.message : "Unknown error",
        email,
        firstName,
        lastName,
      });
    });

    await logActivity({
      type: "notification_request",
      ip,
      userAgent,
      status: 200,
      email,
      firstName,
      lastName,
      studio,
      isCustomStudio,
    });

    res.json({
      message:
        "You've been added to the notification list. We'll email you when it's ready!",
      firstName,
    });
  } catch (error) {
    console.error("Error processing notification request:", error);

    if (process.env.SENTRY_DSN) {
      Sentry.withScope((scope) => {
        scope.setExtra("ip", ip);
        scope.setExtra("userAgent", userAgent);
        scope.setExtra("email", email);
        scope.setExtra("firstName", firstName);
        scope.setExtra("lastName", lastName);
        scope.setExtra("stage", stage);
        Sentry.captureException(error);
      });
    }

    await logActivity({
      type: "error",
      ip,
      userAgent,
      status: 500,
      error: error instanceof Error ? error.message : "Unknown error",
      email,
      firstName,
      lastName,
      studio,
      isCustomStudio,
    });

    res.status(500).json({ error: "Internal server error" });
  }
}
