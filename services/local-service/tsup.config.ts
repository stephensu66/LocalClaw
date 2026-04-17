import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  platform: 'node',
  target: 'node20',
  outDir: 'dist',
  clean: true,
  sourcemap: false,
  noExternal: ['@openclaw/shared', 'cors', 'dotenv', 'express', 'zod'],
  external: ['@prisma/client'],
  outExtension() {
    return {
      js: '.cjs',
    };
  },
});
