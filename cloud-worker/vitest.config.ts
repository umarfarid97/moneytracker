import { defineConfig } from 'vitest/config';
export default defineConfig({ resolve: { alias: { 'cloudflare:workers': new URL('./test/platform.ts', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1') } }, test: { testTimeout: 30_000 } });
