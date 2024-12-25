import { MongoClient, Db, ServerApiVersion } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017";
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "mad_wrapped";
const CONNECT_TIMEOUT_MS = 5000;

let mongoClient: MongoClient | null = null;

export async function connectToMongo(): Promise<MongoClient> {
  try {
    if (!mongoClient) {
      mongoClient = new MongoClient(MONGODB_URI, {
        serverApi: {
          version: ServerApiVersion.v1,
          strict: true,
          deprecationErrors: true,
        },
        connectTimeoutMS: CONNECT_TIMEOUT_MS,
        socketTimeoutMS: CONNECT_TIMEOUT_MS,
      });

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(
            new Error(
              `MongoDB connection timed out after ${CONNECT_TIMEOUT_MS}ms`
            )
          );
        }, CONNECT_TIMEOUT_MS);
      });

      await Promise.race([mongoClient.connect(), timeoutPromise]);
      await mongoClient.db(MONGODB_DB_NAME).command({ ping: 1 });
    }

    return mongoClient;
  } catch (error) {
    if (mongoClient) {
      try {
        await mongoClient.close();
      } catch (closeError) {
        console.error("Error closing MongoDB connection:", closeError);
      }
      mongoClient = null;
    }
    throw new Error(
      `Failed to connect to MongoDB: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

export async function getDb(): Promise<Db> {
  try {
    const client = await connectToMongo();
    return client.db(MONGODB_DB_NAME);
  } catch (error) {
    throw new Error(
      `Failed to get database instance: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

export async function closeConnection(): Promise<void> {
  if (mongoClient) {
    try {
      await mongoClient.close();
      mongoClient = null;
    } catch (error) {
      console.error("Error closing MongoDB connection:", error);
      throw error;
    }
  }
}
