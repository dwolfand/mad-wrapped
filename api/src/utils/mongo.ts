import { MongoClient, Db, ServerApiVersion } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017";
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "mad_wrapped";

let mongoClient: MongoClient | null = null;

export async function connectToMongo(): Promise<MongoClient> {
  try {
    console.log("Attempting MongoDB connection...");

    if (!mongoClient) {
      mongoClient = new MongoClient(MONGODB_URI, {
        serverApi: {
          version: ServerApiVersion.v1,
          strict: true,
          deprecationErrors: true,
        },
        connectTimeoutMS: 5000, // 5 seconds
        socketTimeoutMS: 25000, // 25 seconds
      });

      await mongoClient.connect();
      console.log("Successfully connected to MongoDB");

      // Test the connection
      const db = mongoClient.db(MONGODB_DB_NAME);
      await db.command({ ping: 1 });
      console.log("MongoDB connection test successful");
    } else {
      console.log("Reusing existing MongoDB connection");
    }

    return mongoClient;
  } catch (error) {
    console.error("MongoDB connection error:", error);
    if (mongoClient) {
      await mongoClient.close();
      mongoClient = null;
    }
    throw error;
  }
}

export async function getDb(): Promise<Db> {
  try {
    console.log("Getting MongoDB database instance...");
    const client = await connectToMongo();
    const db = client.db(MONGODB_DB_NAME);
    console.log("Successfully got database instance");
    return db;
  } catch (error) {
    console.error("Error getting database instance:", error);
    throw error;
  }
}

export async function closeConnection(): Promise<void> {
  if (mongoClient) {
    try {
      await mongoClient.close();
      mongoClient = null;
      console.log("MongoDB connection closed");
    } catch (error) {
      console.error("Error closing MongoDB connection:", error);
      throw error;
    }
  }
}
