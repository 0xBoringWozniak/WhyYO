import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@whyyo/shared": path.resolve(__dirname, "packages/shared/src/index.ts"),
      "@whyyo/domain": path.resolve(__dirname, "packages/domain/src/index.ts"),
      "@whyyo/integrations": path.resolve(__dirname, "packages/integrations/src/index.ts"),
      "@whyyo/ui": path.resolve(__dirname, "packages/ui/src/index.ts"),
    },
  },
  test: {
    passWithNoTests: true,
  },
});
