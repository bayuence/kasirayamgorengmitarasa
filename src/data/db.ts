import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export interface ProdukItem {
  id: string;
  varian: string;
  paket: string;
  isi: string;
  harga: number;
  urutan: number;
  aktif: boolean;
  diubah_pada: string;
}

export interface TambahanItem {
  id: string;
  nama: string;
  harga: number;
  urutan: number;
  aktif: boolean;
  diubah_pada: string;
}

export interface OutletItem {
  id: string;
  kode: string;
  nama: string;
  alamat: string;
  telepon: string;
  catatan_struk: string;
  aktif: boolean;
  sumber?: 'manual' | 'presensi';
  presensi_location_id?: string | null;
  diubah_pada: string;
}

export interface HargaProdukOutletItem {
  id: string;
  outlet_id: string;
  produk_id: string;
  harga: number;
  aktif: boolean;
  diubah_pada: string;
}

export interface HargaTambahanOutletItem {
  id: string;
  outlet_id: string;
  tambahan_id: string;
  harga: number;
  aktif: boolean;
  diubah_pada: string;
}

export interface PesananItem {
  id: string;
  kode_perangkat: string;
  nomor: number;
  tanggal: string;
  waktu: string;
  jenis: 'makan_di_tempat' | 'bawa_pulang';
  status: 'selesai' | 'batal';
  metode: 'tunai' | 'qris';
  total: number;
  bayar: number;
  kembalian: number;
  catatan?: string | null;
  alasan_batal?: string | null;
  shift_id?: string | null;
  kasir_id: string;
  outlet_id?: string | null;
}

export interface ItemPesananDetail {
  id: string;
  pesanan_id: string;
  produk_id: string;
  nama_produk: string;
  qty: number;
  harga_satuan: number;
  tambahan: Array<{ nama: string; harga: number; qty: number }>;
}

export interface ShiftItem {
  id: string;
  kasir_id: string;
  buka_pada: string;
  tutup_pada?: string | null;
  kas_awal: number;
  kas_akhir?: number | null;
  selisih?: number | null;
}

export interface OutboxItem {
  id: string;
  tabel: 'pesanan' | 'item_pesanan' | 'shift' | 'batal_pesanan';
  data: any;
  waktu: string;
  status: 'pending' | 'syncing' | 'failed';
  percobaan: number;
}

export interface MitarasaDBSchema extends DBSchema {
  produk: {
    key: string;
    value: ProdukItem;
    indexes: { 'by-urutan': number };
  };
  tambahan: {
    key: string;
    value: TambahanItem;
    indexes: { 'by-urutan': number };
  };
  outlet: {
    key: string;
    value: OutletItem;
    indexes: { 'by-kode': string };
  };
  harga_produk_outlet: {
    key: string;
    value: HargaProdukOutletItem;
    indexes: { 'by-outlet': string };
  };
  harga_tambahan_outlet: {
    key: string;
    value: HargaTambahanOutletItem;
    indexes: { 'by-outlet': string };
  };
  pesanan: {
    key: string;
    value: PesananItem;
    indexes: { 'by-tanggal': string };
  };
  item_pesanan: {
    key: string;
    value: ItemPesananDetail;
    indexes: { 'by-pesanan': string };
  };
  shift: {
    key: string;
    value: ShiftItem;
  };
  outbox: {
    key: string;
    value: OutboxItem;
  };
  meta: {
    key: string;
    value: { key: string; val: any };
  };
}

let dbPromise: Promise<IDBPDatabase<MitarasaDBSchema>> | null = null;

export function getLocalDB(): Promise<IDBPDatabase<MitarasaDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<MitarasaDBSchema>('mitarasa-kasir-db', 2, {
      upgrade(db) {
        // Store produk
        if (!db.objectStoreNames.contains('produk')) {
          const produkStore = db.createObjectStore('produk', { keyPath: 'id' });
          produkStore.createIndex('by-urutan', 'urutan');
        }
        // Store tambahan
        if (!db.objectStoreNames.contains('tambahan')) {
          const tambahanStore = db.createObjectStore('tambahan', { keyPath: 'id' });
          tambahanStore.createIndex('by-urutan', 'urutan');
        }
        // Store outlet
        if (!db.objectStoreNames.contains('outlet')) {
          const outletStore = db.createObjectStore('outlet', { keyPath: 'id' });
          outletStore.createIndex('by-kode', 'kode');
        }
        // Store harga produk per outlet
        if (!db.objectStoreNames.contains('harga_produk_outlet')) {
          const hpoStore = db.createObjectStore('harga_produk_outlet', { keyPath: 'id' });
          hpoStore.createIndex('by-outlet', 'outlet_id');
        }
        // Store harga tambahan per outlet
        if (!db.objectStoreNames.contains('harga_tambahan_outlet')) {
          const htoStore = db.createObjectStore('harga_tambahan_outlet', { keyPath: 'id' });
          htoStore.createIndex('by-outlet', 'outlet_id');
        }
        // Store pesanan
        if (!db.objectStoreNames.contains('pesanan')) {
          const pesananStore = db.createObjectStore('pesanan', { keyPath: 'id' });
          pesananStore.createIndex('by-tanggal', 'tanggal');
        }
        // Store item_pesanan
        if (!db.objectStoreNames.contains('item_pesanan')) {
          const itemStore = db.createObjectStore('item_pesanan', { keyPath: 'id' });
          itemStore.createIndex('by-pesanan', 'pesanan_id');
        }
        // Store shift
        if (!db.objectStoreNames.contains('shift')) {
          db.createObjectStore('shift', { keyPath: 'id' });
        }
        // Store outbox (antrean sinkronisasi)
        if (!db.objectStoreNames.contains('outbox')) {
          db.createObjectStore('outbox', { keyPath: 'id' });
        }
        // Store meta (catatan timestamp sinkron terakhir, pengaturan lokal)
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
      },
      blocked() {
        console.warn('Upgrade IndexedDB tertunda karena ada tab lain yang membuka.');
      },
      blocking() {
        console.warn('Menutup koneksi IndexedDB untuk upgrade versi.');
        dbPromise = null;
      },
      terminated() {
        dbPromise = null;
      },
    });
  }
  return dbPromise;
}
