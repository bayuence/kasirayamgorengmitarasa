import { getSupabase } from './supabase.js';
import { sinkronkanMenuDariSupabase } from './menu.js';
import { sinkronkanPesananDariSupabase } from './riwayat-sync.js';
import { sinkronkanPembayaranDariSupabase } from './pembayaran.js';
import { muatSemuaOutlet } from './outlet.js';

let channelInstance: any = null;

/**
 * Berlangganan (Subscribe) ke Supabase Realtime secara instan
 * Saat ada perubahan di tabel produk, pesanan, kategori, outlet, atau pengaturan_toko,
 * semua klien (baik di lokal maupun deploy Vercel) otomatis mengunduh data terkini tanpa perlu reload!
 */
export async function mulaiRealtimeSupabase(onUpdate?: () => void) {
  if (typeof window === 'undefined' || !navigator.onLine) return;

  try {
    const supabase = await getSupabase();
    if (channelInstance) return;

    channelInstance = supabase
      .channel('mitarasa-realtime-global')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'produk' },
        async () => {
          await sinkronkanMenuDariSupabase();
          onUpdate?.();
          window.dispatchEvent(new CustomEvent('mitarasa:data-updated'));
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'kategori' },
        async () => {
          await sinkronkanMenuDariSupabase();
          onUpdate?.();
          window.dispatchEvent(new CustomEvent('mitarasa:data-updated'));
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pesanan' },
        async () => {
          await sinkronkanPesananDariSupabase();
          onUpdate?.();
          window.dispatchEvent(new CustomEvent('mitarasa:data-updated'));
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'outlet' },
        async () => {
          await muatSemuaOutlet();
          onUpdate?.();
          window.dispatchEvent(new CustomEvent('mitarasa:data-updated'));
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pengaturan_toko' },
        async () => {
          await sinkronkanPembayaranDariSupabase();
          onUpdate?.();
          window.dispatchEvent(new CustomEvent('mitarasa:data-updated'));
        }
      )
      .subscribe();
  } catch (err) {
    console.warn('Realtime Supabase belum aktif:', err);
  }
}
