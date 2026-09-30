import path from "node:path";
import { defineConfig } from "vitest/config";

const root = import.meta.dirname;
const alias = {
  "@": path.resolve(root, "src"),
  // `server-only` lança erro fora do bundler do Next; nos testes é inofensivo.
  "server-only": path.resolve(root, "test/stubs/empty.ts"),
};

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
          exclude: ["**/*.int.test.ts", "node_modules/**"],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "integration",
          environment: "node",
          include: ["src/**/*.int.test.ts", "test/**/*.int.test.ts"],
          setupFiles: ["test/setup-integration.ts"],
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 30_000,
        },
      },
    ],
  },
});
