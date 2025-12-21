import dotenv from "dotenv";
import { pool } from "../utils/postgres";
import { sendStatsLinkEmail } from "../utils/email";
import { sendStatsLinkSMS, isValidPhone } from "../utils/sms";
import { logActivity } from "../utils/logger";

// Load environment variables
dotenv.config();

// ============================================
// CONFIGURATION
// ============================================

// Notification type: 'email' or 'sms'
const NOTIFICATION_TYPE = (process.env.NOTIFICATION_TYPE || "email") as
  | "email"
  | "sms";

// Safety: Only send to these approved locations
const APPROVED_LOCATIONS = [
  "MADabolic 14th street",
  "MADabolic Alexandria",
  "MADabolic Arlington",
  "MADabolic H Street",
  "MADabolic Dupont",
];

// Safety: Test user whitelist - only these users will receive real notifications
const TEST_USER_WHITELIST = {
  dupontLocationIds: [" "],
  names: ["David Wolfand"],
  emails: ["dwolfand+madabolic@gmail.com"],
};

// Hours to wait before resending notification (24 hours default)
const NOTIFICATION_COOLDOWN_HOURS = 24;

// Delay between notifications to avoid rate limits (milliseconds)
// Twilio has a 1 SMS/second rate limit, so we use 1000ms to be safe
const NOTIFICATION_DELAY_MS = 1000;

// Dry run mode - if true, only prints what would be sent without actually sending
const DRY_RUN = process.env.DRY_RUN === "true";

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if user is in test whitelist
 */
function isTestUser(client: any): boolean {
  return (
    TEST_USER_WHITELIST.dupontLocationIds.includes(client.dupont_location_id) ||
    TEST_USER_WHITELIST.names.includes(client.name) ||
    TEST_USER_WHITELIST.emails.includes(client.email?.toLowerCase())
  );
}

/**
 * Parse name from "LAST, FIRST" format
 */
function parseFirstName(name: string): string {
  if (name.includes(",")) {
    const [, firstPart] = name.split(",").map((s: string) => s.trim());
    return firstPart
      .toLowerCase()
      .replace(/\b\w/g, (c: string) => c.toUpperCase());
  } else {
    const parts = name.split(" ");
    return (
      parts[0]
        ?.toLowerCase()
        .replace(/\b\w/g, (c: string) => c.toUpperCase()) || ""
    );
  }
}

/**
 * Get clients who haven't viewed their stats and haven't been notified recently
 */
async function getClientsToNotify(): Promise<any[]> {
  const query = `
    WITH 
    -- Clients with 2025 visits in approved locations
    eligible_clients AS (
      SELECT DISTINCT 
        c.dupont_location_id,
        c.name,
        c.email,
        c.phone,
        c.location
      FROM clients c
      INNER JOIN visits v 
        ON v.client_dupont_location_id = c.dupont_location_id
      WHERE c.dupont_location_id IS NOT NULL
        AND c.location = ANY($1::text[])
        AND v.class_date >= '2025-01-01'
        AND v.class_date < '2026-01-01'
        AND NOT v.cancelled
        AND NOT v.missed
        ${NOTIFICATION_TYPE === "email" ? "AND c.email IS NOT NULL" : ""}
        ${NOTIFICATION_TYPE === "sms" ? "AND c.phone IS NOT NULL" : ""}
        AND c.dupont_location_id = '100003434'
    ),
    -- Clients who have viewed their stats
    viewed_stats AS (
      SELECT DISTINCT client_id
      FROM logs
      WHERE type = 'stats_lookup'
        AND status = 200
        AND client_id IS NOT NULL
    ),
    -- Recent notifications of this type
    recent_notifications AS (
      SELECT DISTINCT client_id
      FROM logs
      WHERE type = $2
        AND status = 200
        AND timestamp > NOW() - INTERVAL '${NOTIFICATION_COOLDOWN_HOURS} hours'
        AND client_id IS NOT NULL
    )
    SELECT 
      ec.dupont_location_id,
      ec.name,
      ec.email,
      ec.phone,
      ec.location
    FROM eligible_clients ec
    LEFT JOIN viewed_stats vs ON vs.client_id = ec.dupont_location_id
    LEFT JOIN recent_notifications rn ON rn.client_id = ec.dupont_location_id
    WHERE vs.client_id IS NULL  -- Haven't viewed stats
      AND rn.client_id IS NULL  -- Haven't been notified recently
    ORDER BY ec.name
  `;

  const notificationType =
    NOTIFICATION_TYPE === "email" ? "email_sent" : "sms_sent";

  const result = await pool.query(query, [
    APPROVED_LOCATIONS,
    notificationType,
  ]);
  return result.rows;
}

/**
 * Send email notification
 */
async function sendEmailNotification(client: any): Promise<boolean> {
  const firstName = parseFirstName(client.name);

  try {
    await sendStatsLinkEmail({
      email: client.email,
      firstName,
      clientId: client.dupont_location_id,
      studioId: client.location,
    });

    await logActivity({
      type: "email_sent",
      clientId: client.dupont_location_id,
      email: client.email,
      firstName,
      studioId: client.location,
      status: 200,
    });

    return true;
  } catch (error) {
    console.error(`❌ Failed to send email to ${client.email}:`, error);

    await logActivity({
      type: "email_failed",
      clientId: client.dupont_location_id,
      email: client.email,
      firstName,
      studioId: client.location,
      status: 500,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return false;
  }
}

/**
 * Send SMS notification
 */
async function sendSMSNotification(client: any): Promise<boolean> {
  const firstName = parseFirstName(client.name);

  if (!isValidPhone(client.phone)) {
    console.log(`⚠️  Skipping ${client.name} - invalid phone: ${client.phone}`);
    return false;
  }

  try {
    const result = await sendStatsLinkSMS({
      phone: client.phone,
      firstName,
      clientId: client.dupont_location_id,
      studioId: client.location,
    });

    if (result.success) {
      await logActivity({
        type: "sms_sent",
        clientId: client.dupont_location_id,
        phone: client.phone,
        firstName,
        studioId: client.location,
        status: 200,
      });

      return true;
    } else {
      await logActivity({
        type: "sms_failed",
        clientId: client.dupont_location_id,
        phone: client.phone,
        firstName,
        studioId: client.location,
        status: 500,
        error: result.error || "Unknown error",
      });

      return false;
    }
  } catch (error) {
    console.error(`❌ Failed to send SMS to ${client.phone}:`, error);

    await logActivity({
      type: "sms_failed",
      clientId: client.dupont_location_id,
      phone: client.phone,
      firstName,
      studioId: client.location,
      status: 500,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return false;
  }
}

// ============================================
// MAIN SCRIPT
// ============================================

async function sendNotifications() {
  console.log("╔═══════════════════════════════════════╗");
  console.log("║   MAD WRAPPED - Send Notifications   ║");
  console.log("╚═══════════════════════════════════════╝\n");

  console.log(`📋 Configuration:`);
  console.log(`   Notification Type: ${NOTIFICATION_TYPE.toUpperCase()}`);
  console.log(`   Approved Locations: ${APPROVED_LOCATIONS.join(", ")}`);
  console.log(`   Cooldown Period: ${NOTIFICATION_COOLDOWN_HOURS} hours`);
  console.log(
    `   Dry Run: ${DRY_RUN ? "YES (no notifications will be sent)" : "NO"}`
  );
  console.log(`\n🔐 Safety Mode: Only sending to whitelisted test users`);
  console.log(
    `   Allowed IDs: ${TEST_USER_WHITELIST.dupontLocationIds.join(", ")}`
  );
  console.log(`   Allowed Names: ${TEST_USER_WHITELIST.names.join(", ")}`);
  console.log(`   Allowed Emails: ${TEST_USER_WHITELIST.emails.join(", ")}\n`);

  try {
    // Get clients to notify
    console.log("🔍 Querying for clients who need notifications...\n");
    const clients = await getClientsToNotify();

    // Filter to test users only
    const testClients = clients.filter(isTestUser);
    const skippedCount = clients.length - testClients.length;

    console.log(`📊 Results:`);
    console.log(`   Total eligible: ${clients.length}`);
    console.log(`   Test users (will notify): ${testClients.length}`);
    console.log(`   Skipped (not in whitelist): ${skippedCount}\n`);

    if (skippedCount > 0) {
      console.log(`⚠️  ${skippedCount} users were skipped for safety.`);
      console.log(
        `   To send to all users, update TEST_USER_WHITELIST in the script.\n`
      );
    }

    if (testClients.length === 0) {
      console.log("✅ No clients to notify. Exiting.\n");
      return;
    }

    // Show preview of who will be notified
    console.log("📋 Clients to notify:");
    console.log("═══════════════════════════════════════");
    testClients.forEach((client, index) => {
      const contact =
        NOTIFICATION_TYPE === "email" ? client.email : client.phone;
      console.log(
        `${index + 1}. ${client.name} (${contact}) - Location: ${
          client.location
        }`
      );
    });
    console.log("═══════════════════════════════════════\n");

    if (DRY_RUN) {
      console.log("🚫 DRY RUN MODE - No notifications will be sent");
      console.log("   Set DRY_RUN=false to send real notifications\n");
      return;
    }

    // Send notifications
    console.log(`🚀 Starting to send ${NOTIFICATION_TYPE} notifications...\n`);

    let successCount = 0;
    let failureCount = 0;

    for (const [index, client] of testClients.entries()) {
      const firstName = parseFirstName(client.name);
      const contact =
        NOTIFICATION_TYPE === "email" ? client.email : client.phone;

      console.log(
        `[${index + 1}/${
          testClients.length
        }] Sending to ${firstName} (${contact})...`
      );

      let success = false;
      if (NOTIFICATION_TYPE === "email") {
        success = await sendEmailNotification(client);
      } else {
        success = await sendSMSNotification(client);
      }

      if (success) {
        console.log(`   ✅ Success`);
        successCount++;
      } else {
        console.log(`   ❌ Failed`);
        failureCount++;
      }

      // Add delay between notifications to avoid rate limits
      if (index < testClients.length - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, NOTIFICATION_DELAY_MS)
        );
      }
    }

    // Summary
    console.log("\n╔═══════════════════════════════════════╗");
    console.log("║            Summary                    ║");
    console.log("╚═══════════════════════════════════════╝");
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${failureCount}`);
    console.log(`📊 Total: ${testClients.length}\n`);
  } catch (error) {
    console.error("💥 Fatal error:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the script
if (require.main === module) {
  sendNotifications()
    .then(() => {
      console.log("🎉 Done!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Fatal error:", error);
      process.exit(1);
    });
}

export { sendNotifications };
