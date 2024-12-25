import serverless from "serverless-http";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import * as Sentry from "@sentry/node";
import { ProfilingIntegration } from "@sentry/profiling-node";

// Load environment variables
dotenv.config();

// Initialize Sentry only if DSN is provided
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    integrations: [new ProfilingIntegration()],
    tracesSampleRate: 1.0,
    profilesSampleRate: 1.0,
  });
}

const app = express();

// CORS configuration
const corsOptions = {
  origin: [
    "http://localhost:5173",
    "http://localhost:4173",
    "https://madwrapped.com",
    "https://www.madwrapped.com",
  ],
  methods: ["GET"],
  credentials: true,
};

// Middleware
app.use(Sentry.Handlers.requestHandler());
app.use(cors(corsOptions));
app.use(express.json());

// Try to find the stats file in different locations
function findStatsFile() {
  const possiblePaths = [
    path.join(__dirname, "../data/workout_stats.json"),
    path.join(__dirname, "../../data/workout_stats.json"),
  ];

  for (const filePath of possiblePaths) {
    if (fs.existsSync(filePath)) {
      console.log(`Found stats file at: ${filePath}`);
      return filePath;
    }
  }

  console.log("No stats file found, creating a new one");
  const defaultPath = possiblePaths[0];
  const defaultDir = path.dirname(defaultPath);

  if (!fs.existsSync(defaultDir)) {
    fs.mkdirSync(defaultDir, { recursive: true });
  }

  fs.writeFileSync(defaultPath, JSON.stringify({}, null, 2));
  return defaultPath;
}

const STATS_FILE = findStatsFile();

// Function to read stats
function readStats() {
  try {
    const data = fs.readFileSync(STATS_FILE, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error reading stats file:", error);
    return {};
  }
}

// Get stats by clientId endpoint
app.get("/api/stats/:clientId/:studioId", (req, res) => {
  try {
    const { clientId, studioId } = req.params;
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

    console.log(
      `Querying stats for clientId: ${clientId} and studioId: ${studioId}`
    );

    if (process.env.SENTRY_DSN) {
      Sentry.addBreadcrumb({
        category: "stats-query",
        message: "Stats queried",
        data: {
          clientId,
          studioId,
          ip,
          userAgent: req.headers["user-agent"],
        },
        level: "info",
      });
    }

    const stats = readStats();
    const key = `${clientId}-${studioId}`;

    if (!stats[key]) {
      if (process.env.SENTRY_DSN) {
        Sentry.captureMessage(
          `Stats not found for client ${clientId} and studio ${studioId}`,
          "warning"
        );
      }
      return res
        .status(404)
        .json({ error: "Stats not found for this client ID and studio" });
    }

    res.json(stats[key]);
  } catch (error) {
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    console.error("Error fetching stats:", error);

    if (process.env.SENTRY_DSN) {
      Sentry.withScope((scope) => {
        scope.setExtra("ip", ip);
        scope.setExtra("userAgent", req.headers["user-agent"]);
        Sentry.captureException(error);
      });
    }

    res.status(500).json({ error: "Internal server error" });
  }
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Only set up Sentry error handler if DSN is provided
if (process.env.SENTRY_DSN) {
  app.use(Sentry.Handlers.errorHandler());
}

// Create the serverless handler
export const handler = serverless(app);
