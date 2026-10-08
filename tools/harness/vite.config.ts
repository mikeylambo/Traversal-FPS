import { resolve } from "node:path";
import { defineConfig } from "vite";

/** `npx vite --config tools/harness/vite.config.ts` then open /tools/harness/index.html?room=... */
const root = resolve(import.meta.dirname, "../..");
export default defineConfig({
  root,
  resolve: { alias: { "@slu/web-shell": resolve(import.meta.dirname, "shellStub.ts") } },
  optimizeDeps: { entries: ["tools/harness/index.html"] },
  server: { port: 5199, strictPort: true }
});
