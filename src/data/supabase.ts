import type { SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;
let supabasePresensiInstance: SupabaseClient | null = null;

/**
 * Lazy import Supabase client untuk database Kasir Mitarasa
 */
export async function getSupabase(): Promise<SupabaseClient> {
  if (!supabaseInstance) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('VITE_SUPABASE_URL atau VITE_SUPABASE_ANON_KEY belum disetel.');
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
