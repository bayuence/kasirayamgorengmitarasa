import { config } from 'dotenv';
import { createDatabaseConnection } from '../src/db/index.js';
import { produk, tambahan } from '../src/db/schema.js';

// Pastikan .env.local terbaca
config({ path: '.env.local' });

export const seedProdukData = [
  {
    varian: 'Ayam Rempah Jawa',
    paket: 'Reguler',
    isi: 'Nasi, ayam, sambel, lalapan',
    harga: 18000,
    urutan: 1,
    aktif: true,
  },
  {
    varian: 'Ayam Rempah Jawa',
    paket: 'Komplit',
    isi: 'Nasi, ayam, sambel, lalapan, jukut goreng, tempe/tahu',
    harga: 25000,
    urutan: 2,
    aktif: true,
  },
  {
    varian: 'Ayam Goreng Bawang Putih',
    paket: 'Reguler',
    isi: 'Nasi, ayam, sambel, lalapan',
    harga: 18000,
    urutan: 3,
    aktif: true,
  },
  {
    varian: 'Ayam Goreng Bawang Putih',
    paket: 'Komplit',
    isi: 'Nasi, ayam, sambel, lalapan, jukut goreng, tempe/tahu',
    harga: 25000,
    urutan: 4,
    aktif: true,
  },
];

export const seedTambahanData = [
  {
    nama: 'Upgrade nasi daun jeruk',
    harga: 2000,
    urutan: 1,
    aktif: true,
  },
  {
    nama: 'Extra kremes',
    harga: 5000,
    urutan: 2,
    aktif: true,
  },
  {
    nama: 'Extra sambel',
    harga: 5000,
    urutan: 3,
    aktif: true,
  },
];

async function runSeed() {
  console.log('Memulai seeding database Mitarasa...');
  const { db, client } = createDatabaseConnection();

  try {
    console.log('Memasukkan data produk bawaan (Bagian 5 PRD)...');
    for (const item of seedProdukData) {
      await db.insert(produk).values(item);
    }
    console.log(`Berhasil menyimpan ${seedProdukData.length} varian & paket produk.`);

    console.log('Memasukkan data tambahan bawaan (Bagian 5 PRD)...');
    for (const item of seedTambahanData) {
      await db.insert(tambahan).values(item);
    }
    console.log(`Berhasil menyimpan ${seedTambahanData.length} item tambahan.`);

    console.log('Seeding data menu selesai dengan sukses!');
  } catch (error) {
    console.error('Terjadi kesalahan saat seeding:', error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

// Eksekusi jika dijalankan langsung via CLI
if (process.argv[1]?.endsWith('seed.ts')) {
  runSeed();
}

