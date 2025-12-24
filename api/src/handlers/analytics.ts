import { Request, Response } from "express";
import { logActivity } from "../utils/logger";

export async function trackAnalytics(req: Request, res: Response) {
  try {
    const {
      type,
      clientId,
      email,
      firstName,
      lastName,
      studioId,
      studio,
      metadata,
    } = req.body;

    // Validate required fields
    if (!type) {
      return res.status(400).json({
        error: "Missing required field: type",
      });
    }

    // Validate analytics type
    const validTypes = [
      "slideshow_opened",
      "slideshow_completed",
      "slide_view",
    ];

    if (!validTypes.includes(type)) {
      return res.status(400).json({
        error: `Invalid analytics type. Must be one of: ${validTypes.join(
          ", "
        )}`,
      });
    }

    // Get IP and user agent from request
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    const userAgent = req.headers["user-agent"];

    // Log the analytics event
    await logActivity({
      type: type as any,
      clientId,
      email,
      firstName,
      lastName,
      studioId,
      studio,
      ip: ip as string,
      userAgent,
      status: 200,
      metadata,
    });

    res.json({
      success: true,
      message: "Analytics event tracked",
    });
  } catch (error) {
    console.error("Error tracking analytics:", error);

    // Log the error
    await logActivity({
      type: "error",
      error: error instanceof Error ? error.message : "Unknown error",
      status: 500,
    });

    res.status(500).json({
      error: "Failed to track analytics event",
    });
  }
}
