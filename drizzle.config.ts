import { defineConfig } from 'drizzle-kit';
import { config } from 'dotenv';

// Baca DATABASE_URL dari .env.local (hanya untuk perkakas development/CLI)
config({ path: '.env.local' });

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || '',
  },
  // Hanya introspect schema public, abaikan schema auth/storage Supabase
  schemaFilter: ['public'],
});

