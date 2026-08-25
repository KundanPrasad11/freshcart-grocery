import { existsSync, readFileSync } from "node:fs";
import { MongoClient } from "mongodb";

function envFromLocalFile() {
  if (!existsSync(".env.local")) return {};
  return Object.fromEntries(
    readFileSync(".env.local", "utf8")
      .split(/\r?\n/)
      .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/))
      .filter(Boolean)
      .map((match) => [match[1], match[2].replace(/^("|')|("|')$/g, "")])
  );
}

const local = envFromLocalFile();
const uri = process.env.MONGODB_URI_TEST ?? local.MONGODB_URI_TEST ?? process.env.MONGODB_URI ?? local.MONGODB_URI;
const database = process.env.MONGODB_DB_TEST ?? local.MONGODB_DB_TEST ?? "freshcart_e2e";
if (!uri) throw new Error("Set MONGODB_URI_TEST (or MONGODB_URI in .env.local) before running E2E tests.");
if (!/(?:^|_)(?:test|e2e)$/i.test(database)) throw new Error(`Refusing to reset non-test database: ${database}`);

const client = new MongoClient(uri);
await client.connect();
await client.db(database).dropDatabase();
await client.close();
