// Executa um comando apontando DATABASE_URL para o banco de testes (validado).
// Uso: tsx scripts/with-test-db.ts <comando> [args...]
import "dotenv/config";
import { spawnSync } from "node:child_process";
import { assertTestDatabaseUrl } from "../src/server/test-db-guard";

const url = assertTestDatabaseUrl(process.env.DATABASE_URL_TEST);
const [cmd, ...args] = process.argv.slice(2);
if (!cmd) {
  console.error("Informe o comando a executar.");
  process.exit(1);
}

const result = spawnSync(cmd, args, {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url, AFINIA_TEST_DB: "1" },
});
process.exit(result.status ?? 1);
