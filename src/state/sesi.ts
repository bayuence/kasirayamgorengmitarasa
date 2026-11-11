import { signal } from '@preact/signals';
import { muatProfilKaryawanLengkap } from '../data/presensi.js';
import { getLocalDB } from '../data/db.js';

export interface UserSession {
  id: string;
  email?: string;
  nama?: string;
  peran?: 'owner' | 'kasir';
  presensiUserId?: string;
  loginMethod?: 'email' | 'karyawan';
  foto?: string | null;
  roleOriginal?: string | null; // e.g. 'Admin' atau 'Karyawan'
  divisi?: string | null;       // e.g. 'IT' atau 'Operasional'
}

// ID default akun kasir toko di Supabase Mitra Rasa (agar foreign key pesanan selalu valid)
export const DEFAULT_KASIR_ID = 'd7eab98a-52cc-44c5-bc66-62eb65b58527';

/**
 * Baca sesi secara sinkron langsung dari localStorage saat module pertama kali dimuat
 * (Mencegah sessionSignal bernilai null saat Vite HMR atau refresh halaman)
 */
function bacaSesiAwal(): UserSession | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem('mitarasa_session');
    if (raw) {
      const parsed = JSON.parse(raw) as UserSession;
      if (parsed && (parsed.id || parsed.nama)) {
        return parsed;
      }
    }
  } catch {}
  return null;
}

// Signal sesi global: Diinisialisasi langsung dengan sesi tersimpan (BUKAN null)
export const sessionSignal = signal<UserSession | null>(bacaSesiAwal());
export const isLockedSignal = signal<boolean>(false);

/**
 * Inisialisasi sesi dari penyimpanan lokal dan sinkronkan dengan IndexedDB
 */
export function inisialisasiSesi(): UserSession | null {
  const current = bacaSesiAwal();
  if (current) {
    sessionSignal.value = current;
    isLockedSignal.value = false;

    // Perkaya data foto & divisi jika belum lengkap
    if (!current.foto || !current.divisi || !current.roleOriginal) {
      perkayaSesiDariPresensi(current);
    }
    return current;
  }

  // Jika di localStorage tidak ditemukan, coba pulihkan dari cadangan IndexedDB
  pulihkanSesiDariIndexedDB();
  return null;
}

/**
 * Cadangan pemulihan sesi dari IndexedDB jika localStorage terhapus oleh browser/PWA
 */
async function pulihkanSesiDariIndexedDB(): Promise<void> {
  try {
    const db = await getLocalDB();
    if (db && db.objectStoreNames.contains('meta')) {
      const entry = await db.get('meta', 'mitarasa_session');
      if (entry && entry.val && entry.val.nama) {
        simpanSesi(entry.val);
        console.log('Sesi berhasil dipulihkan dari cadangan IndexedDB');
      }
    }
  } catch (err) {
    console.warn('Gagal memulihkan sesi dari IndexedDB:', err);
  }
}

/**
 * Memuat detail tambahan seperti foto, divisi, dan role asli dari Presensi Donattour
 */
export async function perkayaSesiDariPresensi(sesiSaatIni: UserSession): Promise<void> {
  try {
    const identifier = sesiSaatIni.presensiUserId || sesiSaatIni.nama;
    if (!identifier) return;

    const profil = await muatProfilKaryawanLengkap(identifier);
    if (profil) {
      const updated: UserSession = {
        ...sesiSaatIni,
        presensiUserId: profil.id,
        nama: profil.name || sesiSaatIni.nama,
        foto: profil.photo || sesiSaatIni.foto || null,
        roleOriginal: profil.role || sesiSaatIni.roleOriginal || 'Karyawan',
        divisi: profil.divisionName || sesiSaatIni.divisi || 'Operasional',
      };
      sessionSignal.value = updated;
      localStorage.setItem('mitarasa_session', JSON.stringify(updated));

      // Cadangkan ke IndexedDB
      try {
        const db = await getLocalDB();
        if (db && db.objectStoreNames.contains('meta')) {
          await db.put('meta', { key: 'mitarasa_session', val: updated });
        }
      } catch {}
    }
  } catch (err) {
    console.warn('Gagal memperkaya profil sesi:', err);
  }
}

/**
 * Simpan sesi login secara persisten di localStorage DAN IndexedDB
 */
export function simpanSesi(session: UserSession): void {
  sessionSignal.value = session;
  isLockedSignal.value = false;

  // 1. Simpan di localStorage (cepat & sinkron)
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('mitarasa_session', JSON.stringify(session));
  }

  // 2. Simpan cadangan di IndexedDB (tahan lama untuk PWA)
  try {
    getLocalDB().then((db) => {
      if (db && db.objectStoreNames.contains('meta')) {
        db.put('meta', { key: 'mitarasa_session', val: session });
      }
    });
  } catch {}
}

/**
 * Hapus sesi login (hanya dipanggil ketika user memilih "Keluar dari Sesi Ini")
 */
export function hapusSesi(): void {
  sessionSignal.value = null;
  isLockedSignal.value = false;

  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('mitarasa_session');
  }

  try {
    getLocalDB().then((db) => {
      if (db && db.objectStoreNames.contains('meta')) {
        db.delete('meta', 'mitarasa_session');
      }
    });
  } catch {}
}
