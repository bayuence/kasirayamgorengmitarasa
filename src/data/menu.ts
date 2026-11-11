import { getLocalDB, type ProdukItem, type TambahanItem, type KategoriItem, type HargaProdukOutletItem } from './db.js';
import { getSupabase } from './supabase.js';
import { outletAktifSignal, inisialisasiOutletAktif } from './outlet.js';

// Kategori bawaan
export const DEFAULT_KATEGORI: KategoriItem[] = [
  {
    id: 'kat-1',
    nama: 'Paket Ayam',
    urutan: 1,
    aktif: true,
    diubah_pada: new Date().toISOString(),
  },
  {
    id: 'kat-2',
    nama: 'Ala Carte / Satuan',
    urutan: 2,
    aktif: true,
    diubah_pada: new Date().toISOString(),
  },
  {
    id: 'kat-3',
    nama: 'Minuman',
    urutan: 3,
    aktif: true,
    diubah_pada: new Date().toISOString(),
  },
  {
    id: 'kat-4',
    nama: 'Tambahan & Sambal',
    urutan: 4,
    aktif: true,
    diubah_pada: new Date().toISOString(),
  },
];

// Data bawaan produk
const DEFAULT_PRODUK: ProdukItem[] = [
  {
    id: 'prod-1',
    varian: 'Ayam Rempah Jawa',
    paket: 'Ayam Rempah - Reguler',
    kategori: 'Paket Ayam',
    kategori_id: 'kat-1',
    gambar: '',
    hpp: 11000,
    harga: 18000,
    isi: 'Nasi pulen, ayam rempah paha/dada, sambal bawang, lalapan',
    urutan: 1,
    aktif: true,
    diubah_pada: new Date().toISOString(),
  },
  {
    id: 'prod-2',
    varian: 'Ayam Rempah Jawa',
    paket: 'Ayam Rempah - Komplit',
    kategori: 'Paket Ayam',
    kategori_id: 'kat-1',
    gambar: '',
    hpp: 15000,
    harga: 25000,
    isi: 'Nasi, ayam rempah, sambel, lalapan, jukut goreng, tempe/tahu',
    urutan: 2,
    aktif: true,
    diubah_pada: new Date().toISOString(),
  },
  {
    id: 'prod-3',
    varian: 'Ayam Goreng Bawang Putih',
    paket: 'Ayam Bawang - Reguler',
    kategori: 'Paket Ayam',
    kategori_id: 'kat-1',
    gambar: '',
    hpp: 11000,
    harga: 18000,
    isi: 'Nasi pulen, ayam bawang gurih, sambel terasi/bawang, lalapan',
    urutan: 3,
    aktif: true,
    diubah_pada: new Date().toISOString(),
  },
  {
    id: 'prod-4',
    varian: 'Ayam Goreng Bawang Putih',
    paket: 'Ayam Bawang - Komplit',
    kategori: 'Paket Ayam',
    kategori_id: 'kat-1',
    gambar: '',
    hpp: 15000,
    harga: 25000,
    isi: 'Nasi, ayam bawang, sambel, lalapan, jukut goreng, tempe/tahu',
    urutan: 4,
    aktif: true,
    diubah_pada: new Date().toISOString(),
  },
  {
    id: 'prod-5',
    varian: 'Minuman',
    paket: 'Es Teh Manis Jumbo',
    kategori: 'Minuman',
    kategori_id: 'kat-3',
    gambar: '',
    hpp: 1500,
    harga: 5000,
    isi: 'Teh melati segar racikan khas Mitarasa porsi jumbo',
    urutan: 5,
    aktif: true,
    diubah_pada: new Date().toISOString(),
  },
  {
    id: 'prod-6',
    varian: 'Minuman',
    paket: 'Es Jeruk Peras Segar',
    kategori: 'Minuman',
    kategori_id: 'kat-3',
    gambar: '',
    hpp: 3000,
    harga: 8000,
    isi: 'Jeruk peras murni segar dengan gula asli',
    urutan: 6,
    aktif: true,
    diubah_pada: new Date().toISOString(),
  },
];

const DEFAULT_TAMBAHAN: TambahanItem[] = [
  {
    id: 'plus-1',
    nama: 'Upgrade nasi daun jeruk',
    harga: 2000,
    urutan: 1,
    aktif: true,
    diubah_pada: new Date().toISOString(),
  },
  {
    id: 'plus-2',
    nama: 'Extra kremes renyah',
    harga: 5000,
    urutan: 2,
    aktif: true,
    diubah_pada: new Date().toISOString(),
  },
  {
    id: 'plus-3',
    nama: 'Extra sambel korek/bawang',
    harga: 5000,
    urutan: 3,
    aktif: true,
    diubah_pada: new Date().toISOString(),
  },
];

/**
 * Kalkulator Keuntungan (Nominal Laba), Margin (%), dan Markup (%)
 */
export function hitungKeuntungan(hargaJual: number, hpp: number): {
  laba: number;
  marginPersen: number;
  markupPersen: number;
} {
  const jual = Number(hargaJual) || 0;
  const modal = Number(hpp) || 0;
  const laba = jual - modal;
  const marginPersen = jual > 0 ? Math.round(((laba / jual) * 100) * 10) / 10 : 0;
  const markupPersen = modal > 0 ? Math.round(((laba / modal) * 100) * 10) / 10 : 0;
  return { laba, marginPersen, markupPersen };
}

/**
 * Muat daftar Kategori (IndexedDB + fallback)
 */
export async function muatSemuaKategori(): Promise<KategoriItem[]> {
  const db = await getLocalDB();
  let kategoriList = await db.getAllFromIndex('kategori', 'by-urutan');

  if (kategoriList.length === 0) {
    const tx = db.transaction('kategori', 'readwrite');
    for (const k of DEFAULT_KATEGORI) {
      await tx.objectStore('kategori').put(k);
    }
    await tx.done;
    kategoriList = await db.getAllFromIndex('kategori', 'by-urutan');
  }

  return kategoriList;
}

/**
 * Simpan / perbarui Kategori
 */
export async function simpanKategoriAdmin(item: KategoriItem): Promise<void> {
  const db = await getLocalDB();
  await db.put('kategori', item);

  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      const supabase = await getSupabase();
      await supabase.from('kategori').upsert({
        id: item.id,
        nama: item.nama,
        urutan: item.urutan,
        aktif: item.aktif,
        diubah_pada: item.diubah_pada || new Date().toISOString(),
      });
    } catch (e) {
      console.warn('Gagal upsert kategori ke Supabase:', e);
    }
  }
}

/**
 * Hapus Kategori
 */
export async function hapusKategoriAdmin(id: string): Promise<void> {
  const db = await getLocalDB();
  await db.delete('kategori', id);

  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      const supabase = await getSupabase();
      await supabase.from('kategori').delete().eq('id', id);
    } catch (e) {
      console.warn('Gagal hapus kategori dari Supabase:', e);
    }
  }
}

/**
 * Muat menu untuk layar kasir POS dengan memperhitungkan harga khusus per outlet/toko
 */
export async function muatMenuLokal(customOutletId?: string): Promise<{
  produk: ProdukItem[];
  tambahan: TambahanItem[];
  kategori: KategoriItem[];
}> {
  const db = await getLocalDB();
  let kategoriList = await muatSemuaKategori();
  let produkList = await db.getAllFromIndex('produk', 'by-urutan');
  let tambahanList = await db.getAllFromIndex('tambahan', 'by-urutan');

  // Jika IndexedDB masih kosong, inisialisasi dengan data awal
  if (produkList.length === 0) {
    const tx = db.transaction(['produk', 'tambahan'], 'readwrite');
    for (const p of DEFAULT_PRODUK) {
      await tx.objectStore('produk').put(p);
    }
    for (const t of DEFAULT_TAMBAHAN) {
      await tx.objectStore('tambahan').put(t);
    }
    await tx.done;

    produkList = await db.getAllFromIndex('produk', 'by-urutan');
    tambahanList = await db.getAllFromIndex('tambahan', 'by-urutan');
  }

  // Terapkan penyesuaian harga khusus cabang / outlet
  const targetOutletId = customOutletId || outletAktifSignal.value?.id || inisialisasiOutletAktif()?.id || null;
  if (targetOutletId) {
    try {
      const hargaKhususList = await db.getAllFromIndex('harga_produk_outlet', 'by-outlet', targetOutletId);
      const mapHarga = new Map(hargaKhususList.map((h) => [h.produk_id, h]));

      produkList = produkList.map((p) => {
        const khusus = mapHarga.get(p.id);
        if (khusus) {
          return {
            ...p,
            harga: khusus.harga,
            hpp: khusus.hpp !== undefined && khusus.hpp !== null ? khusus.hpp : p.hpp,
            aktif: khusus.aktif,
          };
        }
        return p;
      });
    } catch {}
  }

  return {
    produk: produkList.filter((p) => p.aktif),
    tambahan: tambahanList.filter((t) => t.aktif),
    kategori: kategoriList.filter((k) => k.aktif),
  };
}

/**
 * Muat semua menu untuk panel Admin (termasuk yang tidak aktif)
 */
export async function muatSemuaMenuAdmin(): Promise<{
  produk: ProdukItem[];
  tambahan: TambahanItem[];
  kategori: KategoriItem[];
}> {
  const db = await getLocalDB();
  const kategoriList = await muatSemuaKategori();
  const produkList = await db.getAllFromIndex('produk', 'by-urutan');
  const tambahanList = await db.getAllFromIndex('tambahan', 'by-urutan');
  return { produk: produkList, tambahan: tambahanList, kategori: kategoriList };
}

export interface ProdukDenganHargaOutlet {
  produk: ProdukItem;
  hargaKhusus: number | null;
  hppEfektif: number;
  hargaEfektif: number;
  keuntungan: number;
  marginPersen: number;
  aktifDiOutlet: boolean;
}

/**
 * Muat daftar produk beserta perbandingan harga master vs harga khusus di outlet tertentu
 */
export async function muatProdukDenganHargaOutlet(outletId: string): Promise<ProdukDenganHargaOutlet[]> {
  const db = await getLocalDB();
  const produkList = await db.getAllFromIndex('produk', 'by-urutan');
  let hargaKhususList: HargaProdukOutletItem[] = [];
  try {
    hargaKhususList = await db.getAllFromIndex('harga_produk_outlet', 'by-outlet', outletId);
  } catch {}

  const mapHarga = new Map(hargaKhususList.map((h) => [h.produk_id, h]));

  return produkList.map((p) => {
    const khusus = mapHarga.get(p.id);
    const hppEfektif = (khusus && khusus.hpp !== null && khusus.hpp !== undefined) ? khusus.hpp : (p.hpp || 0);
    const hargaEfektif = khusus ? khusus.harga : p.harga;
    const { laba, marginPersen } = hitungKeuntungan(hargaEfektif, hppEfektif);

    return {
      produk: p,
      hargaKhusus: khusus ? khusus.harga : null,
      hppEfektif,
      hargaEfektif,
      keuntungan: laba,
      marginPersen,
      aktifDiOutlet: khusus ? khusus.aktif : p.aktif,
    };
  });
}

/**
 * Simpan / perbarui produk (IndexedDB + Supabase jika online)
 */
export async function simpanProdukAdmin(item: ProdukItem): Promise<void> {
  const db = await getLocalDB();
  await db.put('produk', item);

  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      const supabase = await getSupabase();
      await supabase.from('produk').upsert({
        id: item.id,
        varian: item.varian || item.kategori || 'Paket Ayam',
        paket: item.paket,
        kategori: item.kategori || 'Paket Ayam',
        kategori_id: item.kategori_id || null,
        gambar: item.gambar || '',
        hpp: Number(item.hpp) || 0,
        harga: Number(item.harga) || 0,
        isi: item.isi || '',
        urutan: item.urutan || 0,
        aktif: item.aktif !== false,
        diubah_pada: item.diubah_pada || new Date().toISOString(),
      });
    } catch (e) {
      console.warn('Gagal upsert produk ke Supabase:', e);
    }
  }
}

/**
 * Hapus produk
 */
export async function hapusProdukAdmin(id: string): Promise<void> {
  const db = await getLocalDB();
  await db.delete('produk', id);

  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      const supabase = await getSupabase();
      await supabase.from('produk').delete().eq('id', id);
    } catch (e) {
      console.warn('Gagal hapus produk dari Supabase:', e);
    }
  }
}

/**
 * Simpan / perbarui item tambahan (Add-ons)
 */
export async function simpanTambahanAdmin(item: TambahanItem): Promise<void> {
  const db = await getLocalDB();
  await db.put('tambahan', item);

  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      const supabase = await getSupabase();
      await supabase.from('tambahan').upsert(item);
    } catch (e) {
      console.warn('Gagal upsert tambahan ke Supabase:', e);
    }
  }
}

/**
 * Hapus item tambahan
 */
export async function hapusTambahanAdmin(id: string): Promise<void> {
  const db = await getLocalDB();
  await db.delete('tambahan', id);

  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      const supabase = await getSupabase();
      await supabase.from('tambahan').delete().eq('id', id);
    } catch (e) {
      console.warn('Gagal hapus tambahan dari Supabase:', e);
    }
  }
}

export async function sinkronkanMenuDariSupabase(): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return;
  }

  try {
    const supabase = await getSupabase();

    const [
      { data: katData },
      { data: produkData },
      { data: tambahanData },
    ] = await Promise.all([
      supabase.from('kategori').select('*').order('urutan', { ascending: true }),
      supabase.from('produk').select('*').order('urutan', { ascending: true }),
      supabase.from('tambahan').select('*').order('urutan', { ascending: true }),
    ]);

    const db = await getLocalDB();
    const tx = db.transaction(['kategori', 'produk', 'tambahan', 'meta'], 'readwrite');

    if (katData && katData.length > 0) {
      for (const k of katData) {
        await tx.objectStore('kategori').put(k as KategoriItem);
      }
    }

    if (produkData && produkData.length > 0) {
      for (const p of produkData) {
        await tx.objectStore('produk').put(p as ProdukItem);
      }
    }

    if (tambahanData && tambahanData.length > 0) {
      for (const t of tambahanData) {
        await tx.objectStore('tambahan').put(t as TambahanItem);
      }
    }

    await tx.objectStore('meta').put({
      key: 'menu_terakhir_sinkron',
      val: new Date().toISOString(),
    });

    await tx.done;
  } catch (err) {
    console.warn('Sinkron menu dilewati:', err);
  }
}
