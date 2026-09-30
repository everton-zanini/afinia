// Recuperação de acesso por quem opera o servidor (ex.: o administrador perdeu a senha).
// Define uma senha temporária, encerra as sessões e exige troca no próximo login.
// Uso: RESET_EMAIL=... RESET_PASSWORD=... npm run reset-password
import "dotenv/config";
import { db } from "../src/server/db";
import { normalizeEmail, setTemporaryPassword } from "../src/server/credentials";

async function main() {
  const email = process.env.RESET_EMAIL;
  const password = process.env.RESET_PASSWORD;
  if (!email || !password || password.length < 12) {
    throw new Error("Defina RESET_EMAIL e RESET_PASSWORD (mínimo 12 caracteres).");
  }
  const user = await db.user.findUnique({ where: { email: normalizeEmail(email) }, select: { id: true } });
  if (!user) throw new Error("Usuário não encontrado.");
  await setTemporaryPassword(user.id, password);
  console.log("Senha temporária definida. A troca será exigida no próximo acesso.");
}

main()
  .catch((error) => {
    console.error(`Não executado: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
