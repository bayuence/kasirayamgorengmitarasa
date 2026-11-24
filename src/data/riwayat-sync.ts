import { getLocalDB, type PesananItem, type ItemPesananDetail } from './db.js';
import { getSupabase } from './supabase.js';

/**
 * Sinkronkan pesanan & item_pesanan dari Supabase cloud ke IndexedDB lokal
 * Dipanggil saat buka aplikasi atau saat buka menu Riwayat
 */
export async function sinkronkanPesananDariSupabase(tanggalFilter?: string): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;

  try {
    const supabase = await getSupabase();
    let query = supabase.from('pesanan').select('*').order('waktu', { ascending: false });
    if (tanggalFilter) {
      query = query.eq('tanggal', tanggalFilter);
    } else {
      query = query.limit(200);
    }

    const { data: pesananList, error: errPesanan } = await query;
    if (errPesanan || !pesananList || pesananList.length === 0) return;

    const pesananIds = pesananList.map((p) => p.id);
    const { data: itemsList, error: errItems } = await supabase
      .from('item_pesanan')
      .select('*')
      .in('pesanan_id', pesananIds);

    const db = await getLocalDB();
    const tx = db.transaction(['pesanan', 'item_pesanan'], 'readwrite');

    for (const p of pesananList) {
      await tx.objectStore('pesanan').put(p as PesananItem);
    }

    if (itemsList && itemsList.length > 0) {
      for (const item of itemsList) {
        await tx.objectStore('item_pesanan').put(item as ItemPesananDetail);
      }
    }

    await tx.done;
  } catch (err) {
    console.warn('Gagal tarik pesanan dari Supabase:', err);
  }
}
