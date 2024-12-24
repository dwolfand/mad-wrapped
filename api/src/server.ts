import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

console.log("Starting server");

// Load environment variables
dotenv.config();

const app = express();
const port = parseInt(process.env.PORT || "8080", 10);
const host = "0.0.0.0";

console.log("Server starting on port", port);

// CORS configuration
const corsOptions = {
  origin: [
    "http://localhost:5173", // Local development
    "http://localhost:4173", // Local preview
    "https://madwrapped.com", // Production domain
    "https://www.madwrapped.com", // Production www subdomain
  ],
  methods: ["GET"], // Only allow GET requests
  credentials: true,
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Try to find the stats file in different locations
function findStatsFile() {
  const possiblePaths = [
    path.join(__dirname, "../data/workout_stats.json"), // Production path
    path.join(__dirname, "../../data/workout_stats.json"), // Development path
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

// Function to write stats
function writeStats(stats: any) {
  try {
    fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));
  } catch (error) {
    console.error("Error writing stats file:", error);
  }
}

// Get stats by clientId endpoint
app.get("/api/stats/:clientId/:studioId", (req, res) => {
  try {
    const { clientId, studioId } = req.params;
    const stats = readStats();

    // Create a composite key using both clientId and studioId
    const key = `${clientId}-${studioId}`;

    if (!stats[key]) {
      return res
        .status(404)
        .json({ error: "Stats not found for this client ID and studio" });
    }

    res.json(stats[key]);
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Start server
function startServer() {
  app.listen(port, host, () => {
    console.log(`Server running on ${host}:${port}`);
  });
  console.log("Server started");
}

startServer();
