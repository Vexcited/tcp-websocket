import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],

  outDir: "dist",
  format: ["cjs", "esm"],

  treeshake: true,
  splitting: false,

  sourcemap: true,
  minify: "terser",
  clean: true,
  dts: true
});
