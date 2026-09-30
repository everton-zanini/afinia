import "dotenv/config";
import { defineConfig } from "prisma/config";

// Migrations usam a conexão direta (sem pooler) quando o provedor exige; senão, DATABASE_URL.
const url = process.env.DIRECT_URL || process.env.DATABASE_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: url ?? "",
  },
});
