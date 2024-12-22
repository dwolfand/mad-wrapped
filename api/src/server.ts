import express from "express";
import { MongoClient } from "mongodb";
import cors from "cors";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// MongoDB configuration from environment variables
const mongoUrl = process.env.MONGODB_URI || "mongodb://localhost:27017";
const dbName = process.env.MONGODB_DB_NAME || "mad_wrapped";

// Middleware
app.use(cors());
app.use(express.json());

let client: MongoClient;

// Connect to MongoDB
async function connectToMongo() {
  try {
    client = new MongoClient(mongoUrl);
    await client.connect();
    console.log("Connected to MongoDB at", mongoUrl);
    console.log("Using database:", dbName);
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    process.exit(1);
  }
}

// Get stats by clientId endpoint
app.get("/api/stats/:clientId", async (req, res) => {
  try {
    const { clientId } = req.params;

    const db = client.db(dbName);
    const stats = await db.collection("workout_stats").findOne({ clientId });

    if (!stats) {
      return res
        .status(404)
        .json({ error: "Stats not found for this client ID" });
    }

    res.json(stats);
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
async function startServer() {
  await connectToMongo();

  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM signal received: closing HTTP server");
  await client?.close();
  process.exit(0);
});

startServer().catch(console.error);
