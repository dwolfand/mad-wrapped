import { Request, Response } from "express";
import { getDb } from "../utils/mongo";

const stage = process.env.STAGE || "dev";

export async function healthCheck(req: Request, res: Response) {
  try {
    // Check MongoDB connection
    const db = await getDb();
    await db.command({ ping: 1 });
    res.json({ status: "ok", database: "connected", stage });
  } catch (error) {
    console.error("Health check failed:", error);
    res.status(500).json({ status: "error", database: "disconnected", stage });
  }
}
