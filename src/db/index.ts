import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from 'dotenv';
import * as schema from './schema.js';

// DATABASE_URL dimuat khusus dari .env.local untuk perkakas development
config({ path: '.env.local' });

export function createDatabaseConnection(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) {
    throw new Error('DATABASE_URL belum diatur di .env.local');
  }
  const client = postgres(connectionString);
  const db = drizzle(client, { schema });
  return { db, client };
}

export * from './schema.js';

