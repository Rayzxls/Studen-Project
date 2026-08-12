import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    globals: true,
    css: true,
    include: [
      "tests/unit/**/*.test.{ts,tsx}",
      "tests/integration/**/*.test.{ts,tsx}",
    ],
    exclude: ["node_modules", ".next", "tests/e2e/**"],
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./"),
      // The real package throws unless React is resolving it inside a Server
      // Component. The guard still holds where it matters — a client bundle
      // importing a server-only module fails the build.
      "server-only": resolve(__dirname, "./tests/helpers/server-only-stub.ts"),
    },
  },
});
