import { getLocalDB } from './db.js';
import { getSupabase } from './supabase.js';
import { sinkronkanMenuDariSupabase } from './menu.js';
import { statusSinkronSignal, pendingOutboxCountSignal } from '../state/sinkron.js';

let isSyncing = false;

/**
 * Memproses antrean outbox secara idempoten ke Supabase.
 * Dipanggil saat: event online, interval 30 detik, atau setelah transaksi baru.
 */
export async function prosesOutbox(): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    statusSinkronSignal.value = 'offline';
    return;
  }

  if (isSyncing) return;
  isSyncing = true;

  try {
    const db = await getLocalDB();
    const antrean = await db.getAll('outbox');

    pendingOutboxCountSignal.value = antrean.length;

    if (antrean.length === 0) {
      statusSinkronSignal.value = 'tersinkron';
      isSyncing = false;
      return;
    }

    statusSinkronSignal.value = 'menunggu';
    const supabase = await getSupabase();

    // Urutkan berdasarkan waktu transaksi tertua lebih dulu
    antrean.sort((a, b) => new Date(a.waktu).getTime() - new Date(b.waktu).getTime());

    for (const item of antrean) {
      try {
        let sukses = false;

        if (item.tabel === 'pesanan') {
          const { error } = await supabase.from('pesanan').upsert(item.data);
          if (!error) sukses = true;
          else console.warn('Gagal upsert pesanan ke server:', error);
        } else if (item.tabel === 'item_pesanan') {
          const { error } = await supabase.from('item_pesanan').upsert(item.data);
          if (!error) sukses = true;
          else console.warn('Gagal upsert item_pesanan ke server:', error);
        } else if (item.tabel === 'shift') {
          const { error } = await supabase.from('shift').upsert(item.data);
          if (!error) sukses = true;
          else console.warn('Gagal upsert shift ke server:', error);
        } else if (item.tabel === 'batal_pesanan') {
          const { error } = await supabase.rpc('batalkan_pesanan', {
            p_id: item.data.id,
            p_alasan: item.data.alasan,
          });
          if (!error) sukses = true;
          else console.warn('Gagal eksekusi batalkan_pesanan via RPC:', error);
        }

        if (sukses) {
          // Hapus entri outbox hanya setelah server membalas sukses
          await db.delete('outbox', item.id);
        } else {
          // Naikkan jumlah percobaan
          item.percobaan = (item.percobaan || 0) + 1;
          await db.put('outbox', item);
        }
      } catch (e) {
        console.warn('Kesalahan sinkronisasi item outbox:', e);
        break; // Hentikan batch jika terjadi putus koneksi di tengah jalan
      }
    }

    const sisa = await db.count('outbox');
    pendingOutboxCountSignal.value = sisa;
    statusSinkronSignal.value = sisa > 0 ? 'menunggu' : 'tersinkron';

    // Tarik katalog menu terbaru jika ada pembaruan dari owner
    await sinkronkanMenuDariSupabase();
  } catch (err) {
    console.warn('Gagal memproses outbox:', err);
  } finally {
    isSyncing = false;
  }
}

// Inisialisasi pendengar event online dan timer interval 30 detik
export function inisialisasiSinkronisasiOtomatis(): () => void {
  const handleOnline = () => {
    prosesOutbox();
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('online', handleOnline);
    const intervalTimer = setInterval(() => {
      if (navigator.onLine) {
        prosesOutbox();
      }
    }, 30 * 1000);

    // Jalankan segera saat aplikasi dimuat
    if (navigator.onLine) {
      prosesOutbox();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      clearInterval(intervalTimer);
    };
  }

  return () => {};
}

