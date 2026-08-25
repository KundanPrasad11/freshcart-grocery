import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

type TestDatabaseConfig = { uri: string; database: string };

function readEnvFile() {
  const file = path.join(process.cwd(), ".env.local");
  if (!existsSync(file)) return {} as Record<string, string>;
  return Object.fromEntries(
    readFileSync(file, "utf8")
      .split(/\r?\n/)
      .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/))
      .filter((match): match is RegExpMatchArray => Boolean(match))
      .map((match) => [match[1], match[2].replace(/^("|')|("|')$/g, "")])
  );
}

export function testDatabaseConfig(): TestDatabaseConfig {
  const local = readEnvFile();
  const uri = process.env.MONGODB_URI_TEST ?? local.MONGODB_URI_TEST ?? process.env.MONGODB_URI ?? local.MONGODB_URI;
  const database = process.env.MONGODB_DB_TEST ?? local.MONGODB_DB_TEST ?? "freshcart_e2e";
  if (!uri) throw new Error("Set MONGODB_URI_TEST (or MONGODB_URI in .env.local) before running integration tests.");
  if (!/(?:^|_)(?:test|e2e)$/i.test(database))
    throw new Error(`Refusing to run tests against non-test database: ${database}`);
  return { uri, database };
}

export function configureTestEnvironment() {
  const { uri, database } = testDatabaseConfig();
  process.env.MONGODB_URI = uri;
  process.env.MONGODB_DB = database;
  process.env.AUTH_SECRET = process.env.AUTH_SECRET_TEST ?? "freshcart-test-secret";
  return { uri, database };
}
