import { useState, useEffect } from 'preact/hooks';
import { getLocalDB, type PesananItem, type ItemPesananDetail, type UangAwalItem } from '../../data/db.js';
import { getTanggalLokal, formatNomorAntrean } from '../../data/outbox.js';
import { formatRupiah } from '../../util/rupiah.js';
import { outletAktifSignal } from '../../data/outlet.js';
import {
  formatTanggalPanjang,
  formatTanggalChart,
  formatWaktu as fmtWaktu,
  formatWaktuDetik,
  formatBulanTahun,
} from '../../util/tanggal.js';

// ─── TIPE DATA ────────────────────────────────────────────────────────────────

interface RingkasanHarian {
  tanggal: string;
  totalOmzet: number;
  totalTunai: number;
  totalQris: number;
  jumlahTransaksi: number;
  jumlahBatal: number;
  jumlahItem: number;
  rataRataTransaksi: number;
  transaksiTerbesar: number;
  uangAwalList: UangAwalItem[];
  totalKasAwal: number;
  daftarPesanan: { pesanan: PesananItem; items: ItemPesananDetail[] }[];
  produkTerlaris: { nama: string; qty: number; total: number }[];
}

interface RingkasanRentang {
  totalOmzet: number;
  totalTunai: number;
  totalQris: number;
  jumlahTransaksi: number;
  jumlahBatal: number;
  jumlahItem: number;
  rataRataTransaksi: number;
  transaksiTerbesar: number;
  totalKasAwal: number;
  perHari: { tanggal: string; omzet: number; transaksi: number }[];
  produkTerlaris: { nama: string; qty: number; total: number }[];
  uangAwalList: UangAwalItem[];
  daftarPesanan: { pesanan: PesananItem; items: ItemPesananDetail[] }[];
}

// ─── HELPER ──────────────────────────────────────────────────────────────────

function formatTanggalIndo(tanggal: string): string {
  return formatTanggalPanjang(tanggal);
}

function formatTanggalPendek(tanggal: string): string {
  return formatTanggalChart(tanggal);
}

function formatWaktu(isoStr: string): string {
  return fmtWaktu(isoStr, false);
}

function formatWaktuLengkap(isoStr?: string | null): string {
  if (!isoStr) return '-';
  return formatWaktuDetik(isoStr);
}

function tambahHari(tanggal: string, delta: number): string {
  const d = new Date(tanggal + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  return getTanggalLokal(d);
}

function getMingguRange(tanggal: string): { dari: string; sampai: string } {
  const d = new Date(tanggal + 'T00:00:00');
  const hari = d.getDay(); // 0=minggu
  const selisihSenin = hari === 0 ? -6 : 1 - hari;
  const senin = new Date(d);
  senin.setDate(d.getDate() + selisihSenin);
  const minggu = new Date(senin);
  minggu.setDate(senin.getDate() + 6);
  return { dari: getTanggalLokal(senin), sampai: getTanggalLokal(minggu) };
}

function getBulanRange(tanggal: string): { dari: string; sampai: string } {
  const d = new Date(tanggal + 'T00:00:00');
  const dari = new Date(d.getFullYear(), d.getMonth(), 1);
  const sampai = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { dari: getTanggalLokal(dari), sampai: getTanggalLokal(sampai) };
}

function listTanggal(dari: string, sampai: string): string[] {
  const list: string[] = [];
  let cur = new Date(dari + 'T00:00:00');
  const end = new Date(sampai + 'T00:00:00');
  while (cur <= end) {
    list.push(getTanggalLokal(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return list;
}

// ─── FUNGSI MUAT DATA ─────────────────────────────────────────────────────────

async function muatDataHarian(tanggal: string, outletId?: string | null): Promise<RingkasanHarian> {
  const db = await getLocalDB();

  const pesananAll = await db.getAllFromIndex('pesanan', 'by-tanggal', tanggal);
  const pesanan = outletId
    ? pesananAll.filter((p) => !p.outlet_id || p.outlet_id === outletId)
    : pesananAll;

  const selesai = pesanan.filter((p) => p.status === 'selesai');
  const batal = pesanan.filter((p) => p.status === 'batal');

  const totalOmzet = selesai.reduce((s, p) => s + (p.total || 0), 0);
  const totalTunai = selesai.filter((p) => p.metode === 'tunai').reduce((s, p) => s + (p.total || 0), 0);
  const totalQris = selesai.filter((p) => p.metode === 'qris').reduce((s, p) => s + (p.total || 0), 0);
  const transaksiTerbesar = selesai.length ? Math.max(...selesai.map((p) => p.total)) : 0;
  const rataRataTransaksi = selesai.length ? Math.round(totalOmzet / selesai.length) : 0;

  const daftarPesanan: { pesanan: PesananItem; items: ItemPesananDetail[] }[] = [];
  let jumlahItem = 0;
  const mapProduk: Record<string, { qty: number; total: number }> = {};

  for (const p of selesai) {
    const items = await db.getAllFromIndex('item_pesanan', 'by-pesanan', p.id);
    daftarPesanan.push({ pesanan: p, items });
    for (const it of items) {
      jumlahItem += it.qty;
      const nama = it.nama_produk || 'Unknown';
      if (!mapProduk[nama]) mapProduk[nama] = { qty: 0, total: 0 };
      const totalTambahan = it.tambahan.reduce((s, t) => s + t.harga * t.qty, 0);
      mapProduk[nama].qty += it.qty;
      mapProduk[nama].total += (it.harga_satuan + totalTambahan) * it.qty;
    }
  }

  for (const p of batal) {
    const items = await db.getAllFromIndex('item_pesanan', 'by-pesanan', p.id);
    daftarPesanan.push({ pesanan: p, items });
  }

  const produkTerlaris = Object.entries(mapProduk)
    .map(([nama, v]) => ({ nama, ...v }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10);

  let uangAwalList: UangAwalItem[] = [];
  try {
    const all = await db.getAll('uang_awal');
    uangAwalList = all.filter((u) => {
      const tgl = u.tanggal || u.buka_pada?.slice(0, 10);
      return tgl === tanggal;
    });
  } catch {}

  const totalKasAwal = uangAwalList.reduce((s, u) => s + (u.kas_awal || 0), 0);

  daftarPesanan.sort((a, b) => new Date(b.pesanan.waktu).getTime() - new Date(a.pesanan.waktu).getTime());

  return {
    tanggal, totalOmzet, totalTunai, totalQris,
    jumlahTransaksi: selesai.length, jumlahBatal: batal.length,
    jumlahItem, rataRataTransaksi, transaksiTerbesar,
    uangAwalList, totalKasAwal, daftarPesanan, produkTerlaris,
  };
}

async function muatDataRentang(dari: string, sampai: string, outletId?: string | null): Promise<RingkasanRentang> {
  const tanggalList = listTanggal(dari, sampai);
  const db = await getLocalDB();

  let totalOmzet = 0, totalTunai = 0, totalQris = 0;
  let jumlahTransaksi = 0, jumlahBatal = 0, jumlahItem = 0;
  let transaksiTerbesar = 0;
  const perHari: { tanggal: string; omzet: number; transaksi: number }[] = [];
  const mapProduk: Record<string, { qty: number; total: number }> = {};
  const daftarPesanan: { pesanan: PesananItem; items: ItemPesananDetail[] }[] = [];
  const uangAwalAll: UangAwalItem[] = [];

  for (const tgl of tanggalList) {
    const pesananAll = await db.getAllFromIndex('pesanan', 'by-tanggal', tgl);
    const pesanan = outletId
      ? pesananAll.filter((p) => !p.outlet_id || p.outlet_id === outletId)
      : pesananAll;

    const selesai = pesanan.filter((p) => p.status === 'selesai');
    const batal = pesanan.filter((p) => p.status === 'batal');

    const omzetHari = selesai.reduce((s, p) => s + (p.total || 0), 0);
    totalOmzet += omzetHari;
    totalTunai += selesai.filter((p) => p.metode === 'tunai').reduce((s, p) => s + (p.total || 0), 0);
    totalQris += selesai.filter((p) => p.metode === 'qris').reduce((s, p) => s + (p.total || 0), 0);
    jumlahTransaksi += selesai.length;
    jumlahBatal += batal.length;

    for (const p of selesai) {
      if (p.total > transaksiTerbesar) transaksiTerbesar = p.total;
      const items = await db.getAllFromIndex('item_pesanan', 'by-pesanan', p.id);
      daftarPesanan.push({ pesanan: p, items });
      for (const it of items) {
        jumlahItem += it.qty;
        const nama = it.nama_produk || 'Unknown';
        if (!mapProduk[nama]) mapProduk[nama] = { qty: 0, total: 0 };
        const totalTambahan = it.tambahan.reduce((s, t) => s + t.harga * t.qty, 0);
        mapProduk[nama].qty += it.qty;
        mapProduk[nama].total += (it.harga_satuan + totalTambahan) * it.qty;
      }
    }

    for (const p of batal) {
      const items = await db.getAllFromIndex('item_pesanan', 'by-pesanan', p.id);
      daftarPesanan.push({ pesanan: p, items });
    }

    perHari.push({ tanggal: tgl, omzet: omzetHari, transaksi: selesai.length });
  }

  try {
    const all = await db.getAll('uang_awal');
    for (const u of all) {
      const tgl = u.tanggal || u.buka_pada?.slice(0, 10);
      if (tgl && tgl >= dari && tgl <= sampai) uangAwalAll.push(u);
    }
  } catch {}

  const totalKasAwal = uangAwalAll.reduce((s, u) => s + (u.kas_awal || 0), 0);

  const produkTerlaris = Object.entries(mapProduk)
    .map(([nama, v]) => ({ nama, ...v }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10);

  daftarPesanan.sort((a, b) => new Date(b.pesanan.waktu).getTime() - new Date(a.pesanan.waktu).getTime());

  return {
    totalOmzet, totalTunai, totalQris,
    jumlahTransaksi, jumlahBatal, jumlahItem,
    rataRataTransaksi: jumlahTransaksi > 0 ? Math.round(totalOmzet / jumlahTransaksi) : 0,
    transaksiTerbesar, totalKasAwal, perHari, produkTerlaris,
    uangAwalList: uangAwalAll, daftarPesanan,
  };
}

// ─── KOMPONEN KARTU STAT ─────────────────────────────────────────────────────

function KartuStat({ label, nilai, sub, warna }: { label: string; nilai: string; sub?: string; warna?: string }) {
  return (
    <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
      <p class="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <p class={`text-lg sm:text-xl font-black tracking-tight leading-tight ${warna || 'text-slate-900'}`}>{nilai}</p>
      {sub && <p class="text-[10px] text-slate-400 mt-0.5 leading-tight">{sub}</p>}
    </div>
  );
}

// ─── KOMPONEN DETAIL TRANSAKSI ────────────────────────────────────────────────

function DetailTransaksi({
  data,
  onKembali,
}: {
  data: { pesanan: PesananItem; items: ItemPesananDetail[] };
  onKembali: () => void;
}) {
  const { pesanan, items } = data;
  const isBatal = pesanan.status === 'batal';

  return (
    <div>
      <button
        type="button"
        onClick={onKembali}
        class="flex items-center gap-2 text-xs font-bold text-slate-600 mb-4 hover:text-slate-900 cursor-pointer"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Kembali ke Laporan
      </button>

      <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-4">
        <div class="flex items-start justify-between">
          <div>
            <h3 class="text-sm font-black text-slate-900">
              Antrean: {formatNomorAntrean(pesanan.kode_perangkat, pesanan.nomor)}
            </h3>
            <p class="text-[11px] text-slate-500 font-mono">
              {pesanan.kode_transaksi || pesanan.id.slice(0, 8)}
            </p>
          </div>
          <span class={`text-[11px] font-extrabold px-2.5 py-1 rounded-full ${
            isBatal ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
          }`}>
            {isBatal ? 'BATAL' : 'LUNAS'}
          </span>
        </div>

        <div class="grid grid-cols-2 gap-2 text-xs bg-slate-50 rounded-xl p-3">
          <div><p class="text-slate-400 text-[10px]">Waktu</p><p class="font-bold text-slate-900">{formatWaktu(pesanan.waktu)}</p></div>
          <div><p class="text-slate-400 text-[10px]">Metode</p><p class="font-bold text-slate-900 uppercase">{pesanan.metode || '-'}</p></div>
          {pesanan.catatan && (
            <div class="col-span-2"><p class="text-slate-400 text-[10px]">Catatan</p><p class="font-bold text-slate-900">{pesanan.catatan}</p></div>
          )}
        </div>

        <div class="border-t border-dashed border-slate-200 pt-3 space-y-2">
          <h4 class="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Item Pesanan</h4>
          {items.map((it) => {
            const totalTambahan = it.tambahan.reduce((s, t) => s + t.harga * t.qty, 0);
            const subtotal = (it.harga_satuan + totalTambahan) * it.qty;
            return (
              <div key={it.id} class="flex justify-between items-start text-xs">
                <div class="flex-1 min-w-0 pr-3">
                  <span class="font-bold text-slate-900">{it.qty}× {it.nama_produk}</span>
                  {it.tambahan.map((t) => (
                    <span key={t.nama} class="block text-[10px] text-slate-500 pl-3">
                      + {t.nama} ({formatRupiah(t.harga)})
                    </span>
                  ))}
                </div>
                <span class="font-bold text-slate-900 tabular-nums shrink-0">{formatRupiah(subtotal)}</span>
              </div>
            );
          })}
          {items.length === 0 && <p class="text-xs text-slate-400">Tidak ada item tercatat.</p>}
        </div>

        <div class="border-t border-slate-200 pt-3 space-y-1.5 text-xs">
          <div class="flex justify-between">
            <span class="text-slate-500">Total Tagihan</span>
            <strong class="text-slate-900 font-black text-sm tabular-nums">{formatRupiah(pesanan.total)}</strong>
          </div>
          <div class="flex justify-between text-slate-500">
            <span>Uang Diterima</span>
            <span class="tabular-nums">{formatRupiah(pesanan.bayar)}</span>
          </div>
          <div class="flex justify-between font-bold">
            <span class="text-emerald-700">Kembalian</span>
            <span class="text-emerald-700 tabular-nums">{formatRupiah(pesanan.kembalian)}</span>
          </div>
        </div>

        {isBatal && pesanan.alasan_batal && (
          <div class="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800">
            <strong>Alasan Batal:</strong> {pesanan.alasan_batal}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── KOMPONEN UTAMA ───────────────────────────────────────────────────────────

type ModeView = 'harian' | 'mingguan' | 'bulanan' | 'custom';
type TabAktif = 'ringkasan' | 'transaksi' | 'produk' | 'kasir';

export function LayarLaporan() {
  const [modeView, setModeView] = useState<ModeView>('harian');
  const [tanggal, setTanggal] = useState<string>(getTanggalLokal());
  const [customDari, setCustomDari] = useState<string>(getTanggalLokal());
  const [customSampai, setCustomSampai] = useState<string>(getTanggalLokal());

  const [laporanHarian, setLaporanHarian] = useState<RingkasanHarian | null>(null);
  const [laporanRentang, setLaporanRentang] = useState<RingkasanRentang | null>(null);
  const [loading, setLoading] = useState(true);
  const [tabAktif, setTabAktif] = useState<TabAktif>('ringkasan');
  const [detailPesanan, setDetailPesanan] = useState<{ pesanan: PesananItem; items: ItemPesananDetail[] } | null>(null);

  const outletId = outletAktifSignal.value?.id;
  const namaOutlet = outletAktifSignal.value?.nama || 'Semua Cabang';

  const getDariSampai = (): { dari: string; sampai: string } => {
    if (modeView === 'harian') return { dari: tanggal, sampai: tanggal };
    if (modeView === 'mingguan') return getMingguRange(tanggal);
    if (modeView === 'bulanan') return getBulanRange(tanggal);
    return { dari: customDari, sampai: customSampai };
  };

  const muat = async () => {
    setLoading(true);
    setDetailPesanan(null);
    try {
      const { dari, sampai } = getDariSampai();
      if (modeView === 'harian') {
        const data = await muatDataHarian(dari, outletId || null);
        setLaporanHarian(data);
        setLaporanRentang(null);
      } else {
        const data = await muatDataRentang(dari, sampai, outletId || null);
        setLaporanRentang(data);
        setLaporanHarian(null);
      }
    } catch (e) {
      console.error('Gagal muat laporan:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { muat(); }, [modeView, tanggal, customDari, customSampai, outletId]);

  const pindahHari = (delta: number) => {
    if (modeView === 'harian') {
      setTanggal((t) => tambahHari(t, delta));
    } else if (modeView === 'mingguan') {
      setTanggal((t) => tambahHari(t, delta * 7));
    } else if (modeView === 'bulanan') {
      const d = new Date(tanggal + 'T00:00:00');
      d.setMonth(d.getMonth() + delta);
      setTanggal(getTanggalLokal(d));
    }
  };

  const isHariIni = tanggal === getTanggalLokal();
  const { dari, sampai } = getDariSampai();

  // Data aktif (harian atau rentang)
  const aktif = laporanHarian || laporanRentang;
  const daftarPesananAktif = laporanHarian?.daftarPesanan || laporanRentang?.daftarPesanan || [];
  const produkTerlarisAktif = laporanHarian?.produkTerlaris || laporanRentang?.produkTerlaris || [];
  const uangAwalAktif = laporanHarian?.uangAwalList || laporanRentang?.uangAwalList || [];

  const labelPeriode = () => {
    if (modeView === 'harian') return formatTanggalPanjang(tanggal);
    if (modeView === 'bulanan') return formatBulanTahun(tanggal);
    if (dari === sampai) return formatTanggalPanjang(dari);
    return `${formatTanggalChart(dari)} – ${formatTanggalChart(sampai)}`;
  };

  const TABS: { id: TabAktif; label: string }[] = [
    { id: 'ringkasan', label: 'Ringkasan' },
    { id: 'transaksi', label: 'Transaksi' },
    { id: 'produk', label: 'Menu Terlaris' },
    { id: 'kasir', label: 'Sesi Kasir' },
  ];

  const MODE_OPTIONS: { id: ModeView; label: string }[] = [
    { id: 'harian', label: 'Harian' },
    { id: 'mingguan', label: 'Mingguan' },
    { id: 'bulanan', label: 'Bulanan' },
    { id: 'custom', label: 'Custom' },
  ];

  return (
    <div class="min-h-screen bg-slate-50 pb-28">
      {/* ── HEADER STICKY ── */}
      <div class="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div class="max-w-3xl mx-auto px-4 pt-3 pb-0">

          {/* Judul + Outlet */}
          <div class="flex items-center justify-between gap-3 mb-3">
            <div>
              <h1 class="text-base font-black text-slate-900 tracking-tight leading-tight">Laporan Penjualan</h1>
              <p class="text-[11px] text-slate-500 leading-tight truncate max-w-[200px]">{namaOutlet}</p>
            </div>
            {/* Tombol kembali hari ini */}
            {modeView !== 'custom' && !isHariIni && (
              <button
                type="button"
                onClick={() => setTanggal(getTanggalLokal())}
                class="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
              >
                Hari Ini
              </button>
            )}
          </div>

          {/* Mode Selector */}
          <div class="flex gap-1 mb-2.5 bg-slate-100 p-1 rounded-xl">
            {MODE_OPTIONS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => { setModeView(m.id); }}
                class={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                  modeView === m.id
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Navigator Periode */}
          {modeView !== 'custom' ? (
            <div class="flex items-center gap-2 mb-2">
              <button
                type="button"
                onClick={() => pindahHari(-1)}
                class="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center cursor-pointer transition-colors shrink-0"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>

              <div class="flex-1">
                {modeView === 'harian' ? (
                  <input
                    type="date"
                    value={tanggal}
                    max={getTanggalLokal()}
                    onChange={(e) => setTanggal((e.target as HTMLInputElement).value)}
                    class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-slate-900 cursor-pointer text-center"
                  />
                ) : (
                  <div class="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 text-center truncate">
                    {labelPeriode()}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => !isHariIni && pindahHari(1)}
                disabled={modeView === 'harian' ? isHariIni : false}
                class={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors shrink-0 ${
                  (modeView === 'harian' && isHariIni) ? 'bg-slate-50 text-slate-300 cursor-default' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer'
                }`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          ) : (
            /* Custom Range Picker */
            <div class="flex items-center gap-2 mb-2">
              <div class="flex-1">
                <label class="text-[10px] font-bold text-slate-500 block mb-0.5">Dari</label>
                <input
                  type="date"
                  value={customDari}
                  max={customSampai}
                  onChange={(e) => setCustomDari((e.target as HTMLInputElement).value)}
                  class="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-slate-900 cursor-pointer"
                />
              </div>
              <span class="text-slate-400 text-xs mt-4">—</span>
              <div class="flex-1">
                <label class="text-[10px] font-bold text-slate-500 block mb-0.5">Sampai</label>
                <input
                  type="date"
                  value={customSampai}
                  min={customDari}
                  max={getTanggalLokal()}
                  onChange={(e) => setCustomSampai((e.target as HTMLInputElement).value)}
                  class="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-slate-900 cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* Label Tanggal (untuk harian) */}
          {modeView === 'harian' && (
            <div class="flex items-center justify-center gap-2 mb-3 text-[11px] font-bold text-slate-500">
              <span>{formatTanggalIndo(tanggal)}</span>
              {isHariIni && (
                <span class="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] font-extrabold">
                  HARI INI
                </span>
              )}
            </div>
          )}

          {/* Label Periode (untuk non-harian) */}
          {modeView !== 'harian' && (
            <div class="flex items-center justify-center mb-3 text-[11px] font-bold text-slate-500">
              <span>{labelPeriode()}</span>
            </div>
          )}

          {/* Tab Navigasi */}
          <div class="flex border-t border-slate-100 -mx-4 px-0">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => { setTabAktif(tab.id); setDetailPesanan(null); }}
                class={`flex-1 py-2.5 text-[11px] font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  tabAktif === tab.id
                    ? 'border-slate-900 text-slate-900 bg-white'
                    : 'border-transparent text-slate-500 hover:text-slate-700 bg-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── KONTEN ── */}
      <div class="max-w-3xl mx-auto px-4 py-5">

        {loading ? (
          <div class="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
            <div class="w-6 h-6 border-2 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
            <span class="text-xs font-medium">Memuat data laporan...</span>
          </div>

        ) : !aktif ? (
          <div class="text-center py-20 text-slate-400 text-xs">Gagal memuat laporan</div>

        ) : detailPesanan ? (
          <DetailTransaksi data={detailPesanan} onKembali={() => setDetailPesanan(null)} />

        ) : tabAktif === 'ringkasan' ? (
          /* ── TAB RINGKASAN ── */
          <div class="space-y-4">
            {/* Kartu Hero Omzet */}
            <div class="bg-slate-900 text-white rounded-2xl p-5 shadow-md">
              <p class="text-[11px] font-bold uppercase tracking-widest text-slate-400">Total Omzet</p>
              <p class="text-3xl font-black tracking-tight mt-1">{formatRupiah(aktif.totalOmzet)}</p>
              <div class="flex items-center gap-4 mt-3 text-[11px] text-slate-400">
                <span>{aktif.jumlahTransaksi} transaksi lunas</span>
                {aktif.jumlahBatal > 0 && <span class="text-rose-400">{aktif.jumlahBatal} dibatalkan</span>}
              </div>
            </div>

            {/* Grid Statistik */}
            <div class="grid grid-cols-2 gap-3">
              <KartuStat label="Tunai" nilai={formatRupiah(aktif.totalTunai)}
                sub={aktif.totalOmzet > 0 ? `${Math.round((aktif.totalTunai / aktif.totalOmzet) * 100)}% dari omzet` : '—'} />
              <KartuStat label="QRIS" nilai={formatRupiah(aktif.totalQris)} warna="text-blue-700"
                sub={aktif.totalOmzet > 0 ? `${Math.round((aktif.totalQris / aktif.totalOmzet) * 100)}% dari omzet` : '—'} />
              <KartuStat label="Rata-rata / Nota" nilai={formatRupiah(aktif.rataRataTransaksi)} sub="per transaksi" />
              <KartuStat label="Transaksi Terbesar" nilai={formatRupiah(aktif.transaksiTerbesar)} warna="text-emerald-700" sub="1 nota tertinggi" />
              <KartuStat label="Total Item Terjual" nilai={String(aktif.jumlahItem)} sub="porsi / unit" />
              <KartuStat label="Total Kas Awal" nilai={formatRupiah(aktif.totalKasAwal)} sub={`${uangAwalAktif.length} sesi kasir`} />
            </div>

            {/* Grafik Bar Harian (hanya untuk mode mingguan/bulanan/custom) */}
            {laporanRentang && laporanRentang.perHari.length > 1 && (
              <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
                <h3 class="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-3">
                  Omzet per Hari
                </h3>
                <div class="space-y-1.5">
                  {(() => {
                    const maxOmzet = Math.max(...laporanRentang.perHari.map((h) => h.omzet), 1);
                    return laporanRentang.perHari.map((h) => {
                      const persen = (h.omzet / maxOmzet) * 100;
                      return (
                        <div key={h.tanggal} class="flex items-center gap-2">
                          <span class="text-[10px] font-bold text-slate-500 w-14 shrink-0 text-right">
                            {formatTanggalPendek(h.tanggal)}
                          </span>
                          <div class="flex-1 h-6 bg-slate-100 rounded-lg overflow-hidden relative">
                            <div
                              class="h-full bg-slate-800 rounded-lg transition-all duration-500"
                              style={{ width: `${persen}%` }}
                            />
                            {h.omzet > 0 && (
                              <span class="absolute inset-0 flex items-center px-2 text-[10px] font-bold text-white">
                                {formatRupiah(h.omzet)}
                              </span>
                            )}
                          </div>
                          <span class="text-[10px] font-bold text-slate-500 w-5 shrink-0 text-left">
                            {h.transaksi}
                          </span>
                        </div>
                      );
                    });
                  })()}
                </div>
                <p class="text-[10px] text-slate-400 mt-2 text-right">angka kanan = jumlah transaksi</p>
              </div>
            )}

            {/* Breakdown Metode Pembayaran */}
            {aktif.jumlahTransaksi > 0 && (
              <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
                <h3 class="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-3">
                  Komposisi Metode Pembayaran
                </h3>
                <div class="space-y-2.5">
                  {[
                    { label: 'Tunai', nilai: aktif.totalTunai, warna: 'bg-slate-800' },
                    { label: 'QRIS', nilai: aktif.totalQris, warna: 'bg-blue-500' },
                  ].map((m) => {
                    const persen = aktif.totalOmzet > 0 ? (m.nilai / aktif.totalOmzet) * 100 : 0;
                    return (
                      <div key={m.label}>
                        <div class="flex justify-between text-xs mb-1">
                          <span class="font-bold text-slate-700">{m.label}</span>
                          <span class="font-bold text-slate-900 tabular-nums">{formatRupiah(m.nilai)} ({persen.toFixed(0)}%)</span>
                        </div>
                        <div class="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div class={`h-full ${m.warna} rounded-full transition-all duration-500`} style={{ width: `${persen}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Top 3 Menu Terlaris */}
            {produkTerlarisAktif.length > 0 && (
              <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
                <div class="flex items-center justify-between mb-3">
                  <h3 class="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">Menu Terlaris</h3>
                  <button type="button" onClick={() => setTabAktif('produk')} class="text-[11px] font-bold text-blue-600 cursor-pointer hover:text-blue-800">
                    Lihat Semua →
                  </button>
                </div>
                <div class="space-y-2.5">
                  {produkTerlarisAktif.slice(0, 3).map((p, i) => (
                    <div key={p.nama} class="flex items-center gap-3">
                      <span class={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 ${
                        i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-slate-100 text-slate-600' : 'bg-orange-50 text-orange-600'
                      }`}>{i + 1}</span>
                      <div class="flex-1 min-w-0">
                        <p class="text-xs font-bold text-slate-900 truncate">{p.nama}</p>
                        <p class="text-[10px] text-slate-500">{p.qty} porsi</p>
                      </div>
                      <span class="text-xs font-bold tabular-nums text-slate-700 shrink-0">{formatRupiah(p.total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {aktif.jumlahTransaksi === 0 && (
              <div class="bg-white rounded-2xl border border-slate-200 p-10 text-center shadow-2xs">
                <div class="w-12 h-12 mx-auto mb-3 rounded-2xl bg-slate-100 flex items-center justify-center">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                </div>
                <h4 class="text-sm font-bold text-slate-700">Belum Ada Transaksi</h4>
                <p class="text-xs text-slate-500 mt-1">Tidak ada transaksi tercatat pada periode ini.</p>
              </div>
            )}
          </div>

        ) : tabAktif === 'transaksi' ? (
          /* ── TAB DAFTAR TRANSAKSI ── */
          <div class="space-y-2.5">
            <div class="flex items-center justify-between mb-1">
              <span class="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                {daftarPesananAktif.length} Transaksi
              </span>
              <span class="text-[11px] font-bold text-slate-500">
                {aktif.jumlahBatal > 0 && <span class="text-rose-500">{aktif.jumlahBatal} batal · </span>}
                {aktif.jumlahTransaksi} lunas
              </span>
            </div>

            {daftarPesananAktif.length === 0 ? (
              <div class="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-400 text-xs">
                Tidak ada transaksi pada periode ini.
              </div>
            ) : daftarPesananAktif.map(({ pesanan, items }) => {
              const totalItem = items.reduce((s, it) => s + it.qty, 0);
              const isBatal = pesanan.status === 'batal';
              return (
                <div
                  key={pesanan.id}
                  onClick={() => setDetailPesanan({ pesanan, items })}
                  class={`bg-white rounded-2xl border p-3.5 shadow-2xs cursor-pointer hover:border-slate-400 transition-all ${
                    isBatal ? 'border-rose-200/70 opacity-75' : 'border-slate-200'
                  }`}
                >
                  <div class="flex items-start justify-between gap-2">
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-2 flex-wrap">
                        <span class="text-sm font-black text-slate-900">
                          {formatNomorAntrean(pesanan.kode_perangkat, pesanan.nomor)}
                        </span>
                        <span class={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
                          isBatal ? 'bg-rose-100 text-rose-700' :
                          pesanan.metode === 'qris' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {isBatal ? 'BATAL' : (pesanan.metode || '-').toUpperCase()}
                        </span>
                        {/* Tanggal (untuk mode non-harian) */}
                        {modeView !== 'harian' && (
                          <span class="text-[10px] text-slate-400 font-mono">
                            {pesanan.tanggal || pesanan.waktu?.slice(0, 10)}
                          </span>
                        )}
                      </div>
                      <p class="text-[11px] text-slate-500 mt-0.5 truncate">
                        {totalItem} item · {formatWaktu(pesanan.waktu)}
                        {pesanan.catatan && ` · "${pesanan.catatan}"`}
                      </p>
                    </div>
                    <div class="text-right shrink-0">
                      <span class={`text-sm font-black tabular-nums ${isBatal ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                        {formatRupiah(pesanan.total)}
                      </span>
                      <svg class="ml-auto mt-0.5" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

        ) : tabAktif === 'produk' ? (
          /* ── TAB MENU TERLARIS ── */
          <div class="space-y-3">
            <div class="flex items-center justify-between mb-1">
              <span class="text-xs font-extrabold uppercase tracking-wider text-slate-500">Rekap Menu Terjual</span>
              <span class="text-[11px] text-slate-500">{aktif.jumlahItem} item total</span>
            </div>

            {produkTerlarisAktif.length === 0 ? (
              <div class="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-400 text-xs">
                Belum ada menu terjual pada periode ini.
              </div>
            ) : (
              <div class="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                {produkTerlarisAktif.map((p, i) => {
                  const persen = aktif.jumlahItem > 0 ? (p.qty / aktif.jumlahItem) * 100 : 0;
                  return (
                    <div key={p.nama} class={`p-3.5 ${i < produkTerlarisAktif.length - 1 ? 'border-b border-slate-100' : ''}`}>
                      <div class="flex items-center gap-3 mb-2">
                        <span class={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                          i === 0 ? 'bg-amber-100 text-amber-800' : i === 1 ? 'bg-slate-200 text-slate-700' :
                          i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-slate-50 text-slate-500'
                        }`}>{i + 1}</span>
                        <div class="flex-1 min-w-0">
                          <p class="text-xs font-bold text-slate-900 truncate">{p.nama}</p>
                          <p class="text-[10px] text-slate-500">{p.qty} porsi · {formatRupiah(p.total)}</p>
                        </div>
                        <span class="text-[11px] font-bold text-slate-500 shrink-0">{persen.toFixed(0)}%</span>
                      </div>
                      <div class="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          class={`h-full rounded-full ${i === 0 ? 'bg-amber-400' : i === 1 ? 'bg-slate-400' : i === 2 ? 'bg-orange-400' : 'bg-slate-200'}`}
                          style={{ width: `${persen}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        ) : (
          /* ── TAB SESI KASIR / UANG AWAL ── */
          <div class="space-y-4">
            <div class="flex items-center justify-between mb-1">
              <span class="text-xs font-extrabold uppercase tracking-wider text-slate-500">Sesi Kasir & Uang Awal</span>
              <span class="text-[11px] text-slate-500">{uangAwalAktif.length} sesi</span>
            </div>

            {uangAwalAktif.length === 0 ? (
              <div class="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-400 text-xs">
                Belum ada data uang awal untuk periode ini.
              </div>
            ) : (
              uangAwalAktif.map((u, i) => {
                const selisih = u.selisih || 0;
                return (
                  <div key={u.id} class="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3">
                    <div class="flex items-start justify-between">
                      <div>
                        <h4 class="text-sm font-black text-slate-900">
                          Sesi #{i + 1}{u.kasir_nama ? ` — ${u.kasir_nama}` : ''}
                        </h4>
                        <p class="text-[11px] text-slate-500">
                          {u.tanggal && <span class="font-mono mr-2">{u.tanggal}</span>}
                          Buka: {formatWaktuLengkap(u.buka_pada)}
                          {u.tutup_pada ? ` · Tutup: ${formatWaktuLengkap(u.tutup_pada)}` : ' · Masih Berjalan'}
                        </p>
                        {u.sumber_dana && (
                          <p class="text-[10px] text-amber-700 mt-0.5">Sumber: {u.sumber_dana}</p>
                        )}
                      </div>
                      <span class={`text-[10px] font-extrabold px-2.5 py-1 rounded-full ${
                        u.tutup_pada ? 'bg-slate-100 text-slate-700' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {u.tutup_pada ? 'Tutup' : 'Aktif'}
                      </span>
                    </div>

                    <div class="grid grid-cols-2 gap-2 text-xs">
                      <div class="bg-amber-50 rounded-xl p-2.5">
                        <p class="text-[10px] font-bold text-slate-500 uppercase">Kas Awal</p>
                        <p class="font-black text-amber-900 mt-0.5 tabular-nums">{formatRupiah(u.kas_awal)}</p>
                      </div>
                      {u.kas_akhir != null && (
                        <div class="bg-slate-50 rounded-xl p-2.5">
                          <p class="text-[10px] font-bold text-slate-500 uppercase">Kas Akhir (Fisik)</p>
                          <p class="font-black text-slate-900 mt-0.5 tabular-nums">{formatRupiah(u.kas_akhir)}</p>
                        </div>
                      )}
                      <div class="bg-emerald-50 rounded-xl p-2.5">
                        <p class="text-[10px] font-bold text-slate-500 uppercase">Tunai Masuk</p>
                        <p class="font-black text-emerald-800 mt-0.5 tabular-nums">{formatRupiah(u.total_tunai || 0)}</p>
                      </div>
                      <div class="bg-blue-50 rounded-xl p-2.5">
                        <p class="text-[10px] font-bold text-slate-500 uppercase">QRIS Masuk</p>
                        <p class="font-black text-blue-800 mt-0.5 tabular-nums">{formatRupiah(u.total_qris || 0)}</p>
                      </div>
                      <div class="bg-slate-50 rounded-xl p-2.5">
                        <p class="text-[10px] font-bold text-slate-500 uppercase">Total Omzet Sesi</p>
                        <p class="font-black text-slate-900 mt-0.5 tabular-nums">{formatRupiah((u.total_tunai || 0) + (u.total_qris || 0))}</p>
                      </div>
                      {u.jumlah_pesanan != null && (
                        <div class="bg-slate-50 rounded-xl p-2.5">
                          <p class="text-[10px] font-bold text-slate-500 uppercase">Jml Transaksi</p>
                          <p class="font-black text-slate-900 mt-0.5">{u.jumlah_pesanan} nota</p>
                        </div>
                      )}
                      {u.tutup_pada && (
                        <div class={`rounded-xl p-2.5 col-span-2 ${
                          selisih < 0 ? 'bg-rose-50' : selisih > 0 ? 'bg-amber-50' : 'bg-emerald-50'
                        }`}>
                          <p class="text-[10px] font-bold text-slate-500 uppercase">Selisih Kas</p>
                          <div class="flex items-center justify-between mt-0.5">
                            <p class={`font-black tabular-nums text-sm ${
                              selisih < 0 ? 'text-rose-700' : selisih > 0 ? 'text-amber-700' : 'text-emerald-700'
                            }`}>
                              {selisih > 0 ? '+' : ''}{formatRupiah(selisih)}
                            </p>
                            <span class={`text-[10px] font-bold ${
                              selisih === 0 ? 'text-emerald-700' : selisih > 0 ? 'text-amber-700' : 'text-rose-700'
                            }`}>
                              {selisih === 0 ? 'Pas / Sesuai' : selisih > 0 ? 'Lebih' : 'Kurang'}
                            </span>
                          </div>
                          <p class="text-[10px] text-slate-400 mt-0.5">
                            Estimasi laci: {formatRupiah(u.kas_awal + (u.total_tunai || 0))} · Fisik dihitung: {formatRupiah(u.kas_akhir || 0)}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Rincian Pecahan */}
                    {u.rincian_pecahan && Object.values(u.rincian_pecahan).some((v) => v > 0) && (
                      <div class="bg-amber-50/70 border border-amber-200/60 rounded-xl px-3 py-2 text-[11px] text-amber-950">
                        <span class="font-bold block mb-1">Rincian Lembaran Uang Awal:</span>
                        <div class="flex flex-wrap gap-1.5">
                          {Object.entries(u.rincian_pecahan)
                            .filter(([_, qty]) => qty > 0)
                            .map(([nom, qty]) => (
                              <span key={nom} class="px-2 py-0.5 bg-white border border-amber-200 rounded-md text-[10px] font-semibold font-mono">
                                {qty}x {formatRupiah(Number(nom))}
                              </span>
                            ))}
                        </div>
                      </div>
                    )}

                    {u.catatan && (
                      <div class="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 text-[11px] text-amber-800">
                        <strong>Catatan:</strong> {u.catatan}
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {/* Rekap total */}
            {uangAwalAktif.length > 0 && (
              <div class="bg-slate-900 rounded-2xl p-4 text-white shadow-md mt-2">
                <h4 class="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">Rekap Total Semua Sesi</h4>
                <div class="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p class="text-slate-400 text-[10px]">Total Kas Awal</p>
                    <p class="font-black text-amber-300 mt-0.5 tabular-nums">{formatRupiah(aktif.totalKasAwal)}</p>
                  </div>
                  <div>
                    <p class="text-slate-400 text-[10px]">Total Omzet</p>
                    <p class="font-black text-emerald-400 mt-0.5 tabular-nums">{formatRupiah(aktif.totalOmzet)}</p>
                  </div>
                  <div>
                    <p class="text-slate-400 text-[10px]">Total Tunai</p>
                    <p class="font-black text-white mt-0.5 tabular-nums">{formatRupiah(aktif.totalTunai)}</p>
                  </div>
                  <div>
                    <p class="text-slate-400 text-[10px]">Total QRIS</p>
                    <p class="font-black text-blue-300 mt-0.5 tabular-nums">{formatRupiah(aktif.totalQris)}</p>
                  </div>
                  <div class="col-span-2 pt-2 border-t border-slate-700">
                    <p class="text-slate-400 text-[10px]">Uang Fisik Laci Estimasi (Kas Awal + Tunai)</p>
                    <p class="font-black text-white mt-0.5 tabular-nums text-sm">
                      {formatRupiah(aktif.totalKasAwal + aktif.totalTunai)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
