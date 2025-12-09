// Main stats computation orchestrator - runs queries in parallel

import { Pool } from "pg";
import { StatsResult } from "./statsTypes";
import { computeClientStats } from "./clientStats";
import { computePeerStats } from "./peerStats";
import { computeGlobalStats } from "./globalStats";

export { StatsResult } from "./statsTypes";

export async function computeStatsForClient(
  pool: Pool,
  clientId: string,
  studioId: string
): Promise<StatsResult | null> {
  const dbClient = await pool.connect();
  const operationStart = performance.now();

  try {
    // First, get client stats (includes client info lookup)
    // We need this first to verify the client exists
    const clientStats = await computeClientStats(dbClient, clientId);

    if (!clientStats) {
      return null;
    }

    // Run peer and global stats in parallel - they don't depend on each other
    const [peerComparison, globalStats] = await Promise.all([
      computePeerStats(dbClient, clientId),
      computeGlobalStats(dbClient),
    ]);

    const totalDuration = Math.round(performance.now() - operationStart);
    console.log(
      `⏱️ Total stats computation for ${clientId}: ${totalDuration}ms`
    );

    return {
      clientId,
      studioId,
      ...clientStats,
      lastUpdated: new Date().toISOString(),
      peerComparison,
      globalStats,
    };
  } finally {
    dbClient.release();
  }
}
