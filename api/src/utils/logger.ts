import { getDb } from "./mongo";

type LogType =
  | "notification_request"
  | "stats_lookup"
  | "email_lookup"
  | "stats_not_found"
  | "error";

export interface ActivityLogData {
  type: LogType;
  email?: string;
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
    const db = await getDb();
    await db.collection("logs").insertOne({
      ...data,
      stage: process.env.STAGE || "dev",
      timestamp: new Date(),
    });
  } catch (error) {
    console.error("Error logging activity:", error);
    // Don't throw the error as logging failure shouldn't affect the main request
  }
}
