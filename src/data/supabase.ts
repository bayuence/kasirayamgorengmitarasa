import type { SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;
let supabasePresensiInstance: SupabaseClient | null = null;

/**
 * Lazy import Supabase client untuk database Kasir Mitarasa
 */
export async function getSupabase(): Promise<SupabaseClient> {
  if (!supabaseInstance) {
    let supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
    let supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

    // Pastikan selalu terhubung ke database resmi proyek Mitarasa ini (dkkgncgioenbrkzqqekn)
    // dan tolak jika ada injeksi environment variable lama yang mengarah ke proyek lain/mati
    if (!supabaseUrl || supabaseUrl.includes('dgnpcutgnmrsyjaspgwj')) {
      supabaseUrl = 'https://dkkgncgioenbrkzqqekn.supabase.co';
    }
    if (!supabaseAnonKey || supabaseAnonKey.length < 20) {
      supabaseAnonKey = 'sb_publishable_dBGwaMxyCffekjt6YDVJww_pQApMkMK';
    }

    const { createClient } = await import('@supabase/supabase-js');
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
  }

  return supabaseInstance;
}

/**
 * Lazy import Supabase client untuk database Presensi Donattour (User / Karyawan)
 */
export async function getSupabasePresensi(): Promise<SupabaseClient> {
  if (!supabasePresensiInstance) {
    const presensiUrl = import.meta.env.VITE_PRESENSI_SUPABASE_URL || 'https://qkzldaagnbrrxuxzrddj.supabase.co';
    const presensiKey = import.meta.env.VITE_PRESENSI_SUPABASE_ANON_KEY || 'sb_publishable_N5pgoJWXW3BSxE5qdnTyYg_RFGNWvt2';

    const { createClient } = await import('@supabase/supabase-js');
    supabasePresensiInstance = createClient(presensiUrl, presensiKey);
  }

  return supabasePresensiInstance;
}
