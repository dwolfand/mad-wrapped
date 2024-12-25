import { Request, Response } from "express";
import * as Sentry from "@sentry/node";
import { getDb } from "../utils/mongo";
import { logActivity } from "../utils/logger";
import { sendStatsLinkEmail } from "../utils/email";

const stage = process.env.STAGE || "dev";

export async function lookupEmail(req: Request, res: Response) {
  const { email } = req.body;
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  const userAgent = req.headers["user-agent"];

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    const db = await getDb();
    const stats = await db.collection("workout_stats").findOne({ email });

    if (!stats) {
      await logActivity({
        clientId: "unknown",
        studioId: "unknown",
        ip,
        userAgent,
        status: 404,
        error: `Email not found: ${email}`,
      });
      return res.status(404).json({
        error: "Email not found",
        message: "Would you like to be notified when your stats are ready?",
      });
    }

    // Send email with stats link
    await sendStatsLinkEmail({
      email,
      firstName: stats.firstName,
      clientId: stats.clientId,
      studioId: stats.studioId,
    });

    await logActivity({
      clientId: stats.clientId,
      studioId: stats.studioId,
      ip,
      userAgent,
      status: 200,
      email,
    });

    res.json({
      message: "Stats link has been sent to your email",
      firstName: stats.firstName,
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
      clientId: "unknown",
      studioId: "unknown",
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
  const { email, firstName, lastName } = req.body;
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  const userAgent = req.headers["user-agent"];

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  if (!firstName || !lastName) {
    return res
      .status(400)
      .json({ error: "First name and last name are required" });
  }

  try {
    const db = await getDb();

    // Check if already requested
    const existingRequest = await db
      .collection("notification_requests")
      .findOne({ email });
    if (existingRequest) {
      return res.json({
        message:
          "You're already on the notification list. We'll email you when your stats are ready!",
      });
    }

    // Save new request
    await db.collection("notification_requests").insertOne({
      email,
      firstName,
      lastName,
      timestamp: new Date(),
      ip,
      userAgent,
      stage,
      status: "pending",
    });

    await logActivity({
      clientId: "unknown",
      studioId: "unknown",
      ip,
      userAgent,
      status: 200,
      email,
      type: "notification_request",
      firstName,
      lastName,
    });

    res.json({
      message:
        "You've been added to the notification list. We'll email you when your stats are ready!",
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
      clientId: "unknown",
      studioId: "unknown",
      ip,
      userAgent,
      status: 500,
      error: error instanceof Error ? error.message : "Unknown error",
      email,
      type: "notification_request",
      firstName,
      lastName,
    });

    res.status(500).json({ error: "Internal server error" });
  }
}
