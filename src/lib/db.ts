import { Db, MongoClient } from "mongodb";

const databaseName = () => process.env.MONGODB_DB ?? "freshcart";

declare global {
  // eslint-disable-next-line no-var
  var mongoClientPromise: Promise<MongoClient> | undefined;
}

function client() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is required. Add it to .env.local before using database features.");
  if (!global.mongoClientPromise) global.mongoClientPromise = new MongoClient(uri).connect();
  return global.mongoClientPromise;
}

export async function getMongoClient(): Promise<MongoClient> {
  return client();
}

export async function getDb(): Promise<Db> {
  return (await client()).db(databaseName());
}

/** Lets integration tests switch to an isolated database between cases. */
export async function closeDatabaseForTests() {
  if (global.mongoClientPromise) await (await global.mongoClientPromise).close();
  global.mongoClientPromise = undefined;
}
