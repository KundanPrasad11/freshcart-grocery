import { resetTestDatabase } from "../support/test-db";

export default async function globalTeardown() {
  await resetTestDatabase();
}
