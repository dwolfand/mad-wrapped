import { getDb } from "./mongo";

interface ActivityLogData {
  clientId: string;
  studioId: string;
  ip: string | string[] | undefined;
  userAgent?: string;
  status: number;
  error?: string;
  email?: string;
  type?: string;
  firstName?: string;
  lastName?: string;
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
