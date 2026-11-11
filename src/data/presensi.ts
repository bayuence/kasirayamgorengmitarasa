import { getSupabasePresensi } from './supabase.js';

export interface KaryawanPresensi {
  id: string;
  name: string;
  dob: string;
  role: string;
  photo?: string | null;
  divisionId?: string | null;
  divisionName?: string | null;
}

/**
 * Normalisasi format tanggal lahir ke format YYYY-MM-DD
 */
export function normalisasiTanggalLahir(input: string): string {
  const clean = input.trim();
  // Jika format YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return clean;
  }
  // Jika format DD-MM-YYYY atau DD/MM/YYYY
  const parts = clean.split(/[-/]/);
  if (parts.length === 3) {
    if (parts[0].length === 2 && parts[2].length === 4) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  return clean;
}

/**
 * Ambil daftar semua karyawan aktif dari proyek Presensi Donattour (ringan untuk autocomplete)
 */
export async function muatDaftarKaryawan(): Promise<KaryawanPresensi[]> {
  try {
    const supabase = await getSupabasePresensi();
    const { data, error } = await supabase
      .from('User')
      .select('id, name, dob, role')
      .order('name', { ascending: true });

    if (error) {
      console.warn('Gagal memuat daftar karyawan dari Presensi Donattour:', error);
      return [];
    }
    return (data as KaryawanPresensi[]) || [];
  } catch (err) {
    console.warn('Kesalahan koneksi Presensi Donattour:', err);
    return [];
  }
}

/**
 * Verifikasi login karyawan dengan Nama dan Tanggal Lahir
 * Mengambil juga foto profil dan nama divisi
 */
export async function verifikasiKaryawan(
  nama: string,
  tanggalLahir: string,
): Promise<{ sukses: boolean; user?: KaryawanPresensi; pesan?: string }> {
  try {
    const namaBersih = nama.trim();
    const dobBersih = normalisasiTanggalLahir(tanggalLahir);

    if (!namaBersih || !dobBersih) {
      return { sukses: false, pesan: 'Nama dan tanggal lahir wajib diisi.' };
    }

    const supabase = await getSupabasePresensi();
    const { data, error } = await supabase
      .from('User')
      .select('id, name, dob, role, photo, divisionId, Division:divisionId(id, name)')
      .ilike('name', namaBersih);

    if (error) {
      return { sukses: false, pesan: `Gagal verifikasi: ${error.message}` };
    }

    if (!data || data.length === 0) {
      return { sukses: false, pesan: `Karyawan dengan nama "${namaBersih}" tidak ditemukan.` };
    }

    // Cocokkan tanggal lahir
    const match: any = data.find((k: any) => k.dob === dobBersih);
    if (!match) {
      return { sukses: false, pesan: 'Tanggal lahir tidak sesuai.' };
    }

    return {
      sukses: true,
      user: {
        id: match.id,
        name: match.name,
        dob: match.dob,
        role: match.role || 'Karyawan',
        photo: match.photo || null,
        divisionId: match.divisionId || null,
        divisionName: match.Division?.name || 'Operasional',
      },
    };
  } catch (err: any) {
    return {
      sukses: false,
      pesan: `Terjadi kesalahan koneksi: ${err.message || 'Periksa jaringan internet'}`,
    };
  }
}

/**
 * Muat profil lengkap karyawan (foto, role, divisi) berdasarkan ID atau Nama
 */
export async function muatProfilKaryawanLengkap(userIdOrName: string): Promise<KaryawanPresensi | null> {
  try {
    const supabase = await getSupabasePresensi();
    const query = supabase
      .from('User')
      .select('id, name, dob, role, photo, divisionId, Division:divisionId(id, name)');

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userIdOrName);
    const { data, error } = isUuid
      ? await query.eq('id', userIdOrName).maybeSingle()
      : await query.ilike('name', userIdOrName).limit(1).maybeSingle();

    if (error || !data) return null;

    const row: any = data;
    return {
      id: row.id,
      name: row.name,
      dob: row.dob,
      role: row.role || 'Karyawan',
      photo: row.photo || null,
      divisionId: row.divisionId || null,
      divisionName: row.Division?.name || 'Operasional',
    };
  } catch (err) {
    console.warn('Gagal memuat profil karyawan lengkap:', err);
    return null;
  }
}

export interface LokasiPresensi {
  id: string;
  name: string;
  latitude?: number | null;
  longitude?: number | null;
  radius?: number | null;
  createdAt?: string;
}

/**
 * Muat daftar seluruh cabang/lokasi yang terdaftar di Presensi Donattour
 */
export async function muatDaftarLokasiPresensi(): Promise<LokasiPresensi[]> {
  try {
    const supabase = await getSupabasePresensi();
    const { data, error } = await supabase
      .from('Location')
      .select('id, name, latitude, longitude, radius, createdAt')
      .order('name', { ascending: true });

    if (error) {
      console.warn('Gagal memuat lokasi dari Presensi Donattour:', error);
      return [];
    }
    return (data as LokasiPresensi[]) || [];
  } catch (err) {
    console.warn('Kesalahan saat koneksi ke tabel Location Presensi:', err);
    return [];
  }
}
