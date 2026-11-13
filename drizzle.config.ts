import { defineConfig } from 'drizzle-kit';

/** Configuración de drizzle-kit (ADR-006): migraciones SQL con el empaquetado `migrations.js` de Expo. */
export default defineConfig({
  dialect: 'sqlite',
  driver: 'expo',
  schema: './src/core/db/schema',
  out: './src/core/db/migrations',
});
