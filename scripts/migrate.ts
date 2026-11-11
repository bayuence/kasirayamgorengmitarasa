import { config } from 'dotenv';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { createDatabaseConnection } from '../src/db/index.js';

// Muat konfigurasi dari .env.local
config({ path: '.env.local' });

async function runMigrate() {
  console.log('Menjalankan migrasi database Drizzle...');
  const { db, client } = createDatabaseConnection();

  try {
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('Semua migrasi Drizzle berhasil diaplikasikan!');
  } catch (error) {
    console.error('Terjadi kesalahan saat migrasi:', error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

if (process.argv[1]?.endsWith('migrate.ts')) {
  runMigrate();
}

