import bcrypt from "bcryptjs";
import { closeDatabaseForTests, getDb } from "@/lib/db";
import { resetRateLimitsForTests } from "@/lib/rate-limit";
import { createUser, ensureDatabase } from "@/lib/store-repository";
import { configureTestEnvironment } from "./test-environment";
import { resetTestDatabase } from "./test-db";

export async function resetApiState() {
  configureTestEnvironment();
  resetRateLimitsForTests();
  await resetTestDatabase();
  await ensureDatabase();
}

export async function closeApiState() {
  await resetTestDatabase();
  await closeDatabaseForTests();
}

export async function createTestUser(email = `shopper-${crypto.randomUUID()}@example.test`) {
  const user = await createUser("Test Shopper", email, await bcrypt.hash("password123", 4));
  if (!user) throw new Error("Failed to create test user.");
  return user;
}

export { getDb };
