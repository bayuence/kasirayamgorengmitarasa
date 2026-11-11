import { getLocalDB, type PesananItem, type ItemPesananDetail, type OutboxItem } from './db.js';
import { sessionSignal } from '../state/sesi.js';
import { pendingOutboxCountSignal } from '../state/sinkron.js';
import { outletAktifSignal } from './outlet.js';
import { prosesOutbox } from './sync.js';

// Ambil kode perangkat dari localStorage atau default 'A'
export function getKodePerangkat(): string {
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem('mitarasa_kode_perangkat') || 'A';
  }
  return 'A';
}

export function setKodePerangkat(kode: string): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('mitarasa_kode_perangkat', kode.toUpperCase());
  }
}

// Format tanggal lokal toko: YYYY-MM-DD
export function getTanggalLokal(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Generate nomor antrean berikutnya untuk hari ini
export async function getNextNomorAntrean(tanggal: string): Promise<number> {
  const db = await getLocalDB();
  const metaKey = `counter_antrean_${tanggal}`;
  const meta = await db.get('meta', metaKey);

  let nextNomor = 1;
  if (meta && typeof meta.val === 'number') {
    nextNomor = meta.val + 1;
  }

  await db.put('meta', { key: metaKey, val: nextNomor });
  return nextNomor;
}

// Bersihkan kode toko untuk dipakai di ID: huruf kecil, hanya a-z dan 0-9
function bersihkanKodeToko(kode?: string | null): string {
  const bersih = (kode || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return bersih || 'trx';
}

// Format: kodetoko + DD + MM + YY + urutan  (mis. lodan1111261 = pesanan ke-1 tgl 11-11-2026)
export function formatKodeTransaksi(kodeToko: string, tanggal: string, urutan: number): string {
  const [y, m, d] = tanggal.split('-');
  return `${bersihkanKodeToko(kodeToko)}${d}${m}${y.slice(-2)}${urutan}`;
}

// Urutan transaksi per toko per hari (mulai dari 1 setiap hari baru)
export async function getNextUrutanTransaksi(outletKey: string, tanggal: string): Promise<number> {
  const db = await getLocalDB();
  const metaKey = `counter_trx_${outletKey}_${tanggal}`;
  const meta = await db.get('meta', metaKey);
  const next = meta && typeof meta.val === 'number' ? meta.val + 1 : 1;
  await db.put('meta', { key: metaKey, val: next });
  return next;
}

export function formatNomorAntrean(kodePerangkat: string, nomor: number): string {
  return `${kodePerangkat}-${String(nomor).padStart(3, '0')}`;
}

export interface SimpanTransaksiParams {
  jenis: 'makan_di_tempat' | 'bawa_pulang';
  metode: 'tunai' | 'qris';
  total: number;
  bayar: number;
  kembalian: number;
  catatan?: string;
  items: Array<{
    produkId: string;
    namaProduk: string;
    qty: number;
    hargaSatuan: number;
    tambahan: Array<{ nama: string; harga: number; qty: number }>;
  }>;
}

export interface HasilTransaksi {
  pesanan: PesananItem;
  itemPesanan: ItemPesananDetail[];
  nomorAntreanFormatted: string;
  kodeTransaksi: string;
}

export async function simpanTransaksiBaru(
  params: SimpanTransaksiParams,
): Promise<HasilTransaksi> {
  const db = await getLocalDB();
  const tanggal = getTanggalLokal();
  const kodePerangkat = getKodePerangkat();
  const nomor = await getNextNomorAntrean(tanggal);
  const nomorAntreanFormatted = formatNomorAntrean(kodePerangkat, nomor);
  const outletAktif = outletAktifSignal.value;
  const urutanTrx = await getNextUrutanTransaksi(outletAktif?.id || 'lokal', tanggal);
  const kodeTransaksi = formatKodeTransaksi(outletAktif?.kode || kodePerangkat, tanggal, urutanTrx);

  const pesananId = crypto.randomUUID();
  const waktuISO = new Date().toISOString();
  const kasirId = sessionSignal.value?.id || 'kasir-lokal';

  // Ambil shift_id aktif jika ada
  const shiftAktif = await db.get('meta', 'shift_aktif_id');
  const shiftId = (shiftAktif?.val as string) || null;

  const dataPesanan: PesananItem = {
    id: pesananId,
    kode_perangkat: kodePerangkat,
    kode_transaksi: kodeTransaksi,
    nomor,
    tanggal,
    waktu: waktuISO,
    jenis: params.jenis,
    status: 'selesai',
    metode: params.metode,
    total: params.total,
    bayar: params.bayar,
    kembalian: params.kembalian,
    catatan: params.catatan || null,
    alasan_batal: null,
    shift_id: shiftId,
    kasir_id: kasirId,
    outlet_id: outletAktifSignal.value?.id || null,
  };

  const dataItems: ItemPesananDetail[] = params.items.map((it) => ({
    id: crypto.randomUUID(),
    pesanan_id: pesananId,
    produk_id: it.produkId,
    nama_produk: it.namaProduk,
    qty: it.qty,
    harga_satuan: it.hargaSatuan,
    tambahan: it.tambahan,
  }));

  const { kode_transaksi: _kodeTrx, ...dataPesananServer } = dataPesanan;

  // Simpan ke IndexedDB dalam satu transaksi atomik
  const tx = db.transaction(['pesanan', 'item_pesanan', 'outbox'], 'readwrite');
  await tx.objectStore('pesanan').put(dataPesanan);

  for (const item of dataItems) {
    await tx.objectStore('item_pesanan').put(item);
  }

  // Tambahkan ke antrean outbox untuk sinkronisasi ke Supabase
  const outboxPesanan: OutboxItem = {
    id: crypto.randomUUID(),
    tabel: 'pesanan',
    // kode_transaksi belum ada kolomnya di server; dikeluarkan agar sinkronisasi tidak gagal
    data: dataPesananServer,
    waktu: waktuISO,
    status: 'pending',
    percobaan: 0,
  };
  await tx.objectStore('outbox').put(outboxPesanan);

  for (const item of dataItems) {
    const outboxItem: OutboxItem = {
      id: crypto.randomUUID(),
      tabel: 'item_pesanan',
      data: item,
      waktu: waktuISO,
      status: 'pending',
      percobaan: 0,
    };
    await tx.objectStore('outbox').put(outboxItem);
  }

  await tx.done;

  // Perbarui indikator jumlah pending outbox
  const totalOutbox = await db.count('outbox');
  pendingOutboxCountSignal.value = totalOutbox;

  // Coba kirim langsung jika sedang online
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    prosesOutbox().catch(() => {});
  }

  return {
    pesanan: dataPesanan,
    itemPesanan: dataItems,
    nomorAntreanFormatted,
    kodeTransaksi,
  };
}

// Batalkan pesanan lokal dan masukkan aksi pembatalan ke outbox
export async function batalkanPesananLokal(
  pesananId: string,
  alasanBatal: string,
): Promise<void> {
  if (!alasanBatal.trim()) {
    throw new Error('Alasan pembatalan wajib diisi');
  }

  const db = await getLocalDB();
  const pesanan = await db.get('pesanan', pesananId);
  if (!pesanan) {
    throw new Error('Pesanan tidak ditemukan');
  }

  pesanan.status = 'batal';
  pesanan.alasan_batal = alasanBatal;

  const tx = db.transaction(['pesanan', 'outbox'], 'readwrite');
  await tx.objectStore('pesanan').put(pesanan);

  const outboxBatal: OutboxItem = {
    id: crypto.randomUUID(),
    tabel: 'batal_pesanan',
    data: {
      id: pesananId,
      alasan: alasanBatal,
      pengguna_id: sessionSignal.value?.id || null,
      waktu: new Date().toISOString(),
    },
    waktu: new Date().toISOString(),
    status: 'pending',
    percobaan: 0,
  };
  await tx.objectStore('outbox').put(outboxBatal);
  await tx.done;

  const totalOutbox = await db.count('outbox');
  pendingOutboxCountSignal.value = totalOutbox;

  if (typeof navigator !== 'undefined' && navigator.onLine) {
    prosesOutbox().catch(() => {});
  }
}

