import { execSync } from "node:child_process";
import { assertTestDatabaseUrl } from "../src/server/test-db-guard";

export default async function globalSetup() {
  assertTestDatabaseUrl(process.env.DATABASE_URL);
  execSync("npx tsx e2e/seed.ts", { stdio: "inherit", env: process.env });
}
