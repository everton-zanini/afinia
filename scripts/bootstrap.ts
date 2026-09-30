// Cria o primeiro administrador a partir das variáveis BOOTSTRAP_* (ver .env.example).
// Uso: npm run bootstrap
import "dotenv/config";
import { runBootstrap } from "../src/server/bootstrap";
import { db } from "../src/server/db";

runBootstrap(process.env)
  .then((result) => {
    console.log(
      result.created
        ? "Administrador criado. A troca de senha será exigida no primeiro acesso."
        : "Administrador já existia; nenhum dado foi sobrescrito.",
    );
    if (result.householdCreated) console.log("Casal do administrador criado.");
  })
  .catch((error: unknown) => {
    console.error(`Bootstrap não executado: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
