import { getLocalDB, type PengeluaranItem, type OutboxItem } from './db.js';
import { getSupabase } from './supabase.js';
import { sessionSignal } from '../state/sesi.js';
import { outletAktifSignal } from './outlet.js';
import { pendingOutboxCountSignal } from '../state/sinkron.js';
import { prosesOutbox } from './sync.js';
import { getTanggalLokal } from './outbox.js';

export const KATEGORI_PENGELUARAN = [
  'Bahan Baku & Dapur',
  'Gas & Minyak Goreng',
  'Plastik & Kemasan',
  'Operasional & Listrik/Air',
  'Gaji & Uang Makan Karyawan',
  'Belanja Kebutuhan Kasir',
  'Lain-lain',
] as const;

/**
 * Muat daftar pengeluaran berdasarkan tanggal dan/atau outlet
 */
export async function muatPengeluaran(tanggal?: string, outletId?: string | null): Promise<PengeluaranItem[]> {
  const db = await getLocalDB();
  let list: PengeluaranItem[] = [];

  // Tarik dari Supabase jika online agar data sinkron
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      const supabase = await getSupabase();
      let query = supabase.from('pengeluaran').select('*').order('waktu', { ascending: false });
      if (tanggal) query = query.eq('tanggal', tanggal);
      if (outletId && outletId !== 'semua') query = query.eq('outlet_id', outletId);
      const { data, error } = await query.limit(100);

      if (!error && data && data.length > 0) {
        const tx = db.transaction('pengeluaran', 'readwrite');
        for (const item of data) {
          await tx.objectStore('pengeluaran').put(item as PengeluaranItem);
        }
        await tx.done;
      }
    } catch {}
  }

  if (tanggal) {
    try {
      list = await db.getAllFromIndex('pengeluaran', 'by-tanggal', tanggal);
    } catch {
      list = await db.getAll('pengeluaran');
      list = list.filter((p) => p.tanggal === tanggal);
    }
  } else {
    list = await db.getAll('pengeluaran');
  }

  if (outletId && outletId !== 'semua') {
    list = list.filter((p) => !p.outlet_id || p.outlet_id === outletId);
  }

  // Urutkan dari waktu pengeluaran terbaru
  list.sort((a, b) => new Date(b.waktu).getTime() - new Date(a.waktu).getTime());
  return list;
}

/**
 * Simpan / Tambah Pengeluaran Baru (Kasir Operasional atau Admin)
 */
export async function simpanPengeluaran(params: {
  tanggal?: string;
  kategori: string;
  keterangan: string;
  nominal: number;
  metode: 'tunai' | 'transfer';
  outlet_id?: string | null;
  outlet_nama?: string | null;
  bukti_foto?: string | null;
  id?: string;
}): Promise<PengeluaranItem> {
  const db = await getLocalDB();
  const id = params.id || crypto.randomUUID();
  const waktuISO = new Date().toISOString();
  const tanggal = params.tanggal || getTanggalLokal();
  const session = sessionSignal.value;
  const outlet = outletAktifSignal.value;

  const item: PengeluaranItem = {
    id,
    tanggal,
    waktu: waktuISO,
    kategori: params.kategori,
    keterangan: params.keterangan.trim(),
    nominal: Number(params.nominal) || 0,
    metode: params.metode,
    outlet_id: params.outlet_id !== undefined ? params.outlet_id : (outlet?.id || null),
    outlet_nama: params.outlet_nama !== undefined ? params.outlet_nama : (outlet?.nama || 'Cabang Utama'),
    kasir_id: session?.id || 'kasir-lokal',
    kasir_nama: session?.nama || 'Kasir',
    bukti_foto: params.bukti_foto || null,
    diubah_pada: waktuISO,
  };

  const outboxItem: OutboxItem = {
    id: crypto.randomUUID(),
    tabel: 'pengeluaran' as any,
    data: item,
    waktu: waktuISO,
    status: 'pending',
    percobaan: 0,
  };

  const tx = db.transaction(['pengeluaran', 'outbox'], 'readwrite');
  await tx.objectStore('pengeluaran').put(item);
  await tx.objectStore('outbox').put(outboxItem);
  await tx.done;

  pendingOutboxCountSignal.value = await db.count('outbox');

  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      const supabase = await getSupabase();
      await supabase.from('pengeluaran').upsert(item);
    } catch {}
    prosesOutbox().catch(() => {});
  }

  return item;
}

/**
 * Hapus pengeluaran (Permanen)
 */
export async function hapusPengeluaran(id: string): Promise<void> {
  const db = await getLocalDB();
  const waktuISO = new Date().toISOString();

  const outboxItem: OutboxItem = {
    id: crypto.randomUUID(),
    tabel: 'hapus_pengeluaran' as any,
    data: { id },
    waktu: waktuISO,
    status: 'pending',
    percobaan: 0,
  };

  const tx = db.transaction(['pengeluaran', 'outbox'], 'readwrite');
  await tx.objectStore('pengeluaran').delete(id);
  await tx.objectStore('outbox').put(outboxItem);
  await tx.done;

  pendingOutboxCountSignal.value = await db.count('outbox');

  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      const supabase = await getSupabase();
      await supabase.from('pengeluaran').delete().eq('id', id);
    } catch {}
    prosesOutbox().catch(() => {});
  }
}
