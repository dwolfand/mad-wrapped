import { Request, Response } from "express";
import * as Sentry from "@sentry/node";
import { getDb } from "../utils/mongo";
import { logActivity } from "../utils/logger";
import { sendStatsLinkEmail, sendAdminNotification } from "../utils/email";
import { getStudioShortName } from "../utils/studios";

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
    const stats = await db.collection("workout_stats").findOne({
      email: email.toLowerCase(),
    });

    if (!stats) {
      await logActivity({
        type: "email_lookup",
        ip,
        userAgent,
        status: 404,
        error: `Email not found: ${email}`,
        email,
      });
      return res.status(404).json({
        error: "Email not found",
        message: "Would you like to be notified when it's ready?",
      });
    }

    // Send email with stats link
    await sendStatsLinkEmail({
      email: stats.email,
      firstName: stats.firstName,
      clientId: stats.clientId,
      studioId: stats.studioId,
    });

    await logActivity({
      type: "email_lookup",
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
    const db = await getDb();
    const lowerEmail = email.toLowerCase();

    // Check if already requested
    const existingRequest = await db
      .collection("notification_requests")
      .findOne({ email: lowerEmail });
    if (existingRequest) {
      return res.json({
        message:
          "You're already on the notification list. We'll email you when it's ready!",
        firstName,
      });
    }

    // Save new request
    await db.collection("notification_requests").insertOne({
      email: lowerEmail,
      firstName,
      lastName,
      studio,
      studioShortName: getStudioShortName(studio),
      isCustomStudio,
      timestamp: new Date(),
      ip,
      userAgent,
      stage,
      status: "pending",
    });

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
