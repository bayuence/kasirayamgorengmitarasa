import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  date,
  jsonb,
  check,
  unique,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { authUsers } from 'drizzle-orm/supabase';

// Profil pengguna dan peran
export const profil = pgTable(
  'profil',
  {
    id: uuid('id')
      .primaryKey()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    nama: text('nama').notNull(),
    peran: text('peran').notNull().default('kasir'),
    dibuatPada: timestamp('dibuat_pada', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check('profil_peran_check', sql`${table.peran} in ('owner', 'kasir')`),
  ],
);

// Katalog produk
export const produk = pgTable(
  'produk',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    varian: text('varian').notNull(),
    paket: text('paket').notNull(),
    isi: text('isi').notNull().default(''),
    harga: integer('harga').notNull(),
    urutan: integer('urutan').notNull().default(0),
    aktif: boolean('aktif').notNull().default(true),
    diubahPada: timestamp('diubah_pada', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check('produk_harga_check', sql`${table.harga} >= 0`),
  ],
);

// Tambahan menu (add-ons)
export const tambahan = pgTable(
  'tambahan',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    nama: text('nama').notNull(),
    harga: integer('harga').notNull(),
    urutan: integer('urutan').notNull().default(0),
    aktif: boolean('aktif').notNull().default(true),
    diubahPada: timestamp('diubah_pada', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check('tambahan_harga_check', sql`${table.harga} >= 0`),
  ],
);

// Shift kasir
export const shift = pgTable('shift', {
  id: uuid('id').primaryKey(),
  kasirId: uuid('kasir_id')
    .notNull()
    .references(() => profil.id),
  bukaPada: timestamp('buka_pada', { withTimezone: true }).notNull(),
  tutupPada: timestamp('tutup_pada', { withTimezone: true }),
  kasAwal: integer('kas_awal').notNull().default(0),
  kasAkhir: integer('kas_akhir'),
  selisih: integer('selisih'),
});

// Pesanan / transaksi
export const pesanan = pgTable(
  'pesanan',
  {
    id: uuid('id').primaryKey(),
    kodePerangkat: text('kode_perangkat').notNull(),
    nomor: integer('nomor').notNull(),
    tanggal: date('tanggal').notNull(),
    waktu: timestamp('waktu', { withTimezone: true }).notNull(),
    jenis: text('jenis').notNull(),
    status: text('status').notNull().default('selesai'),
    metode: text('metode').notNull(),
    total: integer('total').notNull(),
    bayar: integer('bayar').notNull(),
    kembalian: integer('kembalian').notNull().default(0),
    catatan: text('catatan'),
    alasanBatal: text('alasan_batal'),
    shiftId: uuid('shift_id').references(() => shift.id),
    kasirId: uuid('kasir_id')
      .notNull()
      .references(() => profil.id),
  },
  (table) => [
    unique('pesanan_tanggal_kode_perangkat_nomor_key').on(
      table.tanggal,
      table.kodePerangkat,
      table.nomor,
    ),
    index('pesanan_tanggal_idx').on(table.tanggal),
    check(
      'pesanan_jenis_check',
      sql`${table.jenis} in ('makan_di_tempat', 'bawa_pulang')`,
    ),
    check('pesanan_status_check', sql`${table.status} in ('selesai', 'batal')`),
    check('pesanan_metode_check', sql`${table.metode} in ('tunai', 'qris')`),
    check('pesanan_total_check', sql`${table.total} >= 0`),
    check('pesanan_bayar_check', sql`${table.bayar} >= 0`),
  ],
);

// Detail item pesanan (snapshot produk & tambahan)
export const itemPesanan = pgTable(
  'item_pesanan',
  {
    id: uuid('id').primaryKey(),
    pesananId: uuid('pesanan_id')
      .notNull()
      .references(() => pesanan.id, { onDelete: 'cascade' }),
    produkId: uuid('produk_id')
      .notNull()
      .references(() => produk.id),
    namaProduk: text('nama_produk').notNull(),
    qty: integer('qty').notNull(),
    hargaSatuan: integer('harga_satuan').notNull(),
    tambahan: jsonb('tambahan').notNull().default(sql`'[]'::jsonb`),
  },
  (table) => [
    index('item_pesanan_pesanan_id_idx').on(table.pesananId),
    check('item_pesanan_qty_check', sql`${table.qty} > 0`),
  ],
);

// Log audit untuk aksi penting (seperti pembatalan transaksi)
export const logAudit = pgTable('log_audit', {
  id: uuid('id').primaryKey().defaultRandom(),
  waktu: timestamp('waktu', { withTimezone: true }).notNull().defaultNow(),
  penggunaId: uuid('pengguna_id').references(() => profil.id),
  aksi: text('aksi').notNull(),
  detail: jsonb('detail'),
});

