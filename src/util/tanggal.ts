/**
 * Utilitas format tanggal & waktu standar Indonesia.
 * Gunakan fungsi ini di seluruh proyek — jangan pakai toLocaleString() langsung
 * karena hasilnya bisa berbeda antar browser/OS.
 *
 * Format tanggal Indonesia: DD Bulan YYYY  (mis. 24 November 2026)
 * Format angka: 24/11/2026
 */

const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const NAMA_HARI = [
  'Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu',
];

/** Parsing tanggal dari string ISO / "YYYY-MM-DD" atau Date object */
function parseDate(input: string | Date): Date {
  if (input instanceof Date) return input;
  // "YYYY-MM-DD" → tambahkan jam 12:00 agar tidak geser zona waktu
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return new Date(input + 'T12:00:00');
  }
  return new Date(input);
}

/**
 * Format tanggal lengkap: Senin, 24 November 2026
 */
export function formatTanggalPanjang(input: string | Date): string {
  const d = parseDate(input);
  if (isNaN(d.getTime())) return '-';
  return `${NAMA_HARI[d.getDay()]}, ${d.getDate()} ${NAMA_BULAN[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Format tanggal pendek: 24 Nov 2026
 */
export function formatTanggalPendek(input: string | Date): string {
  const d = parseDate(input);
  if (isNaN(d.getTime())) return '-';
  const bln = NAMA_BULAN[d.getMonth()].slice(0, 3);
  return `${d.getDate()} ${bln} ${d.getFullYear()}`;
}

/**
 * Format tanggal angka Indonesia: 24/11/2026
 */
export function formatTanggalAngka(input: string | Date): string {
  const d = parseDate(input);
  if (isNaN(d.getTime())) return '-';
  const tgl = String(d.getDate()).padStart(2, '0');
  const bln = String(d.getMonth() + 1).padStart(2, '0');
  return `${tgl}/${bln}/${d.getFullYear()}`;
}

/**
 * Format bulan + tahun: November 2026
 */
export function formatBulanTahun(input: string | Date): string {
  const d = parseDate(input);
  if (isNaN(d.getTime())) return '-';
  return `${NAMA_BULAN[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Format waktu: 13:45 WIB
 */
export function formatWaktu(input: string | Date, withWIB = true): string {
  const d = typeof input === 'string' ? new Date(input) : input;
  if (isNaN(d.getTime())) return '-';
  const jam = String(d.getHours()).padStart(2, '0');
  const menit = String(d.getMinutes()).padStart(2, '0');
  return withWIB ? `${jam}:${menit} WIB` : `${jam}:${menit}`;
}

/**
 * Format waktu dengan detik: 13:45:30 WIB
 */
export function formatWaktuDetik(input: string | Date, withWIB = true): string {
  const d = typeof input === 'string' ? new Date(input) : input;
  if (isNaN(d.getTime())) return '-';
  const jam = String(d.getHours()).padStart(2, '0');
  const menit = String(d.getMinutes()).padStart(2, '0');
  const detik = String(d.getSeconds()).padStart(2, '0');
  return withWIB ? `${jam}:${menit}:${detik} WIB` : `${jam}:${menit}:${detik}`;
}

/**
 * Format tanggal + waktu lengkap: Senin, 24 November 2026 pukul 13:45 WIB
 */
export function formatTanggalWaktu(input: string | Date): string {
  const d = typeof input === 'string' ? new Date(input) : input;
  if (isNaN(d.getTime())) return '-';
  return `${formatTanggalPanjang(d)} pukul ${formatWaktu(d)}`;
}

/**
 * Format ringkas untuk struk/laporan: 24/11/2026 13:45
 */
export function formatStrukWaktu(input: string | Date): string {
  const d = typeof input === 'string' ? new Date(input) : input;
  if (isNaN(d.getTime())) return '-';
  return `${formatTanggalAngka(d)} ${formatWaktu(d, false)}`;
}

/**
 * Format nama hari: Senin
 */
export function formatNamaHari(input: string | Date): string {
  const d = parseDate(input);
  if (isNaN(d.getTime())) return '-';
  return NAMA_HARI[d.getDay()];
}

/**
 * Format tanggal pendek untuk grafik/chart: 24 Nov
 */
export function formatTanggalChart(input: string | Date): string {
  const d = parseDate(input);
  if (isNaN(d.getTime())) return '-';
  return `${d.getDate()} ${NAMA_BULAN[d.getMonth()].slice(0, 3)}`;
}
