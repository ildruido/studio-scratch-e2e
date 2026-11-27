import { readFileSync } from "node:fs";
import { defineConfig } from "vitest/config";
import { viteSingleFile } from "vite-plugin-singlefile";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as {
  version: string;
};

// One codebase, two builds:
//   vite build --mode artifact --outDir dist-artifact   ONE self-contained index.html (a Claude artifact is a single page)
//   vite build --mode web --outDir dist-web             a multi-file site served by server/
// `vite` and `vitest` without a mode use the artifact build.
export default defineConfig(({ mode }) => ({
  plugins: mode === "web" ? [] : [viteSingleFile()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __TARGET__: JSON.stringify(mode === "web" ? "web" : "artifact"),
  },
  build: {
    target: "es2022",
    // Artifacts are capped at 16 MB.
    chunkSizeWarningLimit: 4096,
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
  },
}));
