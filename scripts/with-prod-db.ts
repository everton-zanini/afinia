// Executa um comando contra o banco de PRODUÇÃO, lendo as credenciais de `.env.prod`.
// O arquivo `.env.prod` não é versionado e não é carregado automaticamente pelo Next.js,
// pelo Prisma (que lê `.env`) nem pelos testes — só por este script.
// Uso: tsx scripts/with-prod-db.ts [--write] <comando> [args...]
//   --write: operações que alteram o banco exigem também AFINIA_CONFIRM_PROD=1.
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { config } from "dotenv";

const FILE = ".env.prod";
if (!existsSync(FILE)) {
  console.error(`Arquivo ${FILE} não encontrado. Copie .env.prod.example e preencha as URLs de produção.`);
  process.exit(1);
}
const prod = config({ path: FILE, processEnv: {} }).parsed ?? {};
const url = prod.DATABASE_URL;
if (!url) {
  console.error(`DATABASE_URL ausente em ${FILE}.`);
  process.exit(1);
}

let host = "?";
let dbName = "?";
try {
  const u = new URL(url);
  host = u.host;
  dbName = u.pathname.replace(/^\//, "");
} catch {
  console.error("DATABASE_URL de produção inválida.");
  process.exit(1);
}
if (/_test$|_dev$/.test(dbName) || /^(127\.0\.0\.1|localhost)/.test(host)) {
  console.error(`Recusado: ${FILE} aponta para um banco local/de teste (${host}/${dbName}).`);
  process.exit(1);
}

const args = process.argv.slice(2);
const write = args[0] === "--write";
if (write) args.shift();
if (args.length === 0) {
  console.error("Informe o comando a executar.");
  process.exit(1);
}
if (write && process.env.AFINIA_CONFIRM_PROD !== "1") {
  console.error(`Operação de escrita em PRODUÇÃO (${host}/${dbName}). Para confirmar, rode com AFINIA_CONFIRM_PROD=1.`);
  process.exit(1);
}

console.error(`>>> PRODUÇÃO: ${host}/${dbName}${write ? " (escrita)" : " (leitura)"}`);
const direct = prod.DIRECT_URL || url;
const result = spawnSync(args[0], args.slice(1), {
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    ...prod,
    DATABASE_URL: url,
    DIRECT_URL: direct,
    NODE_ENV: "production",
  },
});
process.exit(result.status ?? 1);
