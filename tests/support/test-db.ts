import { MongoClient } from "mongodb";
import { closeDatabaseForTests } from "@/lib/db";
import { resetRepositoryForTests } from "@/lib/store-repository";
import { configureTestEnvironment, testDatabaseConfig } from "./test-environment";

export async function resetTestDatabase() {
  const { uri, database } = configureTestEnvironment();
  if (!/(?:^|_)(?:test|e2e)$/i.test(database)) throw new Error("Refusing to reset a non-test database.");
  await closeDatabaseForTests();
  resetRepositoryForTests();
  const client = new MongoClient(uri);
  await client.connect();
  await client.db(database).dropDatabase();
  await client.close();
}

export { testDatabaseConfig };
