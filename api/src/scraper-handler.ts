/**
 * Separate Lambda function for Puppeteer-based scraping
 * This runs independently with its own memory/timeout configuration
 */

import { Handler } from "aws-lambda";
import * as Sentry from "@sentry/node";
import { ProfilingIntegration } from "@sentry/profiling-node";
import { getChrome } from "./utils/chrome";
import { fetchUserByEmail } from "./utils/mindbody";
import {
  upsertClient,
  upsertCrossRegionalAssociations,
  upsertVisit,
  updateLastVisitsFetchedAt,
  saveAuthToken,
} from "./utils/dbOperations";
import { sendStatsLinkEmail } from "./utils/email";

// Initialize Sentry only if DSN is provided
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.STAGE || "dev",
    integrations: [new ProfilingIntegration()],
    tracesSampleRate: 1.0,
    profilesSampleRate: 1.0,
  });
}

interface ScraperEvent {
  email: string;
}

interface ScraperResponse {
  success: boolean;
  client?: {
    id: string;
    name: string;
    email: string;
    dupontLocationId: string;
    location: string;
  };
  visitsCount?: number;
  associationsCount?: number;
  error?: string;
}

/**
 * Lambda handler for scraping user data from Mindbody
 */
export const handler: Handler<ScraperEvent, ScraperResponse> = async (
  event
) => {
  console.log("🔍 Scraper Lambda invoked with event:", JSON.stringify(event));

  const { email } = event;

  if (!email) {
    console.error("❌ Email is required");
    return {
      success: false,
      error: "Email is required",
    };
  }

  let chromeInstance;

  try {
    console.log(`🚀 Starting scrape for email: ${email}`);

    // Launch Chrome
    chromeInstance = await getChrome();
    const page = await chromeInstance.browser.newPage();

    // Fetch user data from Mindbody
    console.log(`🔍 Fetching user data for: ${email}`);
    const userData = await fetchUserByEmail(page, email);

    if (!userData.client) {
      console.log(`❌ User not found in Mindbody: ${email}`);
      await chromeInstance.cleanup();

      return {
        success: false,
        error: "User not found in Mindbody",
      };
    }

    console.log(`✅ Found user in Mindbody: ${userData.client.name}`);

    // Save client to database
    await upsertClient(userData.client);

    // Save cross-regional associations
    if (userData.associations.length > 0) {
      await upsertCrossRegionalAssociations(
        userData.client.id,
        userData.client.location,
        userData.associations
      );
    }

    // Save visits
    console.log(`💾 Saving ${userData.visits.length} visits...`);
    for (const visit of userData.visits) {
      await upsertVisit(userData.client.id, userData.client.location, visit);
    }

    // Update last fetched timestamp
    await updateLastVisitsFetchedAt(
      userData.client.id,
      userData.client.location
    );

    // Save auth token if available
    if (userData.authToken) {
      await saveAuthToken(userData.authToken);
    }

    console.log(`✅ Successfully saved user data for: ${email}`);

    // Close browser
    await chromeInstance.cleanup();

    // Parse name from "LAST, FIRST" format
    let firstName = "";
    if (userData.client.name.includes(",")) {
      const [, firstPart] = userData.client.name
        .split(",")
        .map((s: string) => s.trim());
      firstName = firstPart
        .toLowerCase()
        .replace(/\b\w/g, (c: string) => c.toUpperCase());
    } else {
      const parts = userData.client.name.split(" ");
      firstName =
        parts[0]
          ?.toLowerCase()
          .replace(/\b\w/g, (c: string) => c.toUpperCase()) || "";
    }

    // Send email with stats link or unsupported location message
    try {
      const clientId = userData.client.dupontLocationId || userData.client.id;
      const locationSupported = await isClientLocationSupported(clientId);

      if (locationSupported) {
        // Send regular stats email for supported locations
        await sendStatsLinkEmail({
          email: userData.client.email,
          firstName,
          clientId,
          studioId: userData.client.location,
        });
        console.log(`📧 Stats link email sent to: ${email}`);
      } else {
        // Send unsupported location email
        await sendUnsupportedLocationEmail({
          email: userData.client.email,
          firstName,
          locationName: userData.client.location,
        });
        console.log(`📧 Unsupported location email sent to: ${email}`);
      }
    } catch (emailError) {
      console.error("Error sending email:", emailError);
      // Don't fail the whole scrape if email fails
    }

    return {
      success: true,
      client: userData.client,
      visitsCount: userData.visits.length,
      associationsCount: userData.associations.length,
    };
  } catch (error) {
    console.error("❌ Error in scraper:", error);

    // Clean up browser if it was opened
    if (chromeInstance) {
      try {
        await chromeInstance.cleanup();
      } catch (cleanupError) {
        console.error("Error cleaning up browser:", cleanupError);
      }
    }

    // Log to Sentry
    if (process.env.SENTRY_DSN) {
      Sentry.withScope((scope) => {
        scope.setExtra("email", email);
        Sentry.captureException(error);
      });
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};
