import { pool } from "./postgres";

type LogType =
  | "notification_request"
  | "stats_lookup"
  | "email_lookup"
  | "email_sent"
  | "email_failed"
  | "sms_sent"
  | "sms_failed"
  | "stats_not_found"
  | "error";

export interface ActivityLogData {
  type: LogType;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  clientId?: string;
  studioId?: string;
  studio?: string;
  isCustomStudio?: boolean;
  ip?: string | string[];
  userAgent?: string;
  status?: number;
  error?: any;
}

export async function logActivity(data: ActivityLogData) {
  try {
    const stage = process.env.STAGE || "dev";

    // Convert ip array to string if needed
    const ipAddress = Array.isArray(data.ip) ? data.ip[0] : data.ip;

    // Convert error to string if it's an object
    const errorMessage = data.error
      ? typeof data.error === "string"
        ? data.error
        : JSON.stringify(data.error)
      : null;

    await pool.query(
      `
      INSERT INTO logs (
        type, email, phone, first_name, last_name, client_id, studio_id, 
        studio, is_custom_studio, ip, user_agent, status, error, stage
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `,
      [
        data.type,
        data.email?.toLowerCase() || null,
        data.phone || null,
        data.firstName || null,
        data.lastName || null,
        data.clientId || null,
        data.studioId || null,
        data.studio || null,
        data.isCustomStudio || null,
        ipAddress || null,
        data.userAgent || null,
        data.status || null,
        errorMessage,
        stage,
      ]
    );
  } catch (error) {
    console.error("Error logging activity:", error);
    // Don't throw the error as logging failure shouldn't affect the main request
  }
}
