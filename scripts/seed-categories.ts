// Garante as categorias sugeridas em todos os casais existentes. Idempotente: não duplica
// nem altera categorias já existentes (inclusive as editadas pelo casal).
// Uso: npm run db:seed:categories
import "dotenv/config";
import { db } from "../src/server/db";
import { seedSuggestedCategories } from "../src/server/households/setup";

async function main() {
  const households = await db.household.findMany({ select: { id: true, name: true } });
  for (const h of households) {
    const created = await db.$transaction((tx) => seedSuggestedCategories(tx, h.id));
    console.log(`${h.name}: ${created} categoria(s) criada(s)`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
