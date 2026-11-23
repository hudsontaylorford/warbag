import { defineConfig } from "vitest/config";
import path from "node:path";

/** Receipt reading against real photos kept outside the repo. Calls the real API; never part of `npm test`. */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "server-only": path.resolve(import.meta.dirname, "tests/support/empty.ts"),
    },
  },
  test: { include: ["tests/eval/**/*.eval.ts"], testTimeout: 180_000 },
});
