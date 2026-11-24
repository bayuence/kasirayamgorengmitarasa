import { useState, useEffect } from 'preact/hooks';
import {
  getLocalDB,
  type PesananItem,
  type ItemPesananDetail,
  type UangAwalItem,
  type PengeluaranItem,
} from '../../data/db.js';
import { getTanggalLokal, formatNomorAntrean } from '../../data/outbox.js';
import { formatRupiah } from '../../util/rupiah.js';
import { outletAktifSignal } from '../../data/outlet.js';
import { muatPengeluaran } from '../../data/pengeluaran.js';
import {
  formatTanggalPanjang,
  formatTanggalChart,
  formatWaktu as fmtWaktu,
  formatWaktuDetik,
  formatBulanTahun,
} from '../../util/tanggal.js';

// ─── TIPE DATA LAPORAN ────────────────────────────────────────────────────────

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
  totalHpp: number;
  totalLabaKotor: number;
  totalPengeluaran: number;
  labaBersih: number;
  marginKotorPersen: number;
  uangAwalList: UangAwalItem[];
  pengeluaranList: PengeluaranItem[];
  totalKasAwal: number;
  daftarPesanan: { pesanan: PesananItem; items: ItemPesananDetail[]; laba: number; hpp: number }[];
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
  totalHpp: number;
  totalLabaKotor: number;
  totalPengeluaran: number;
  labaBersih: number;
  marginKotorPersen: number;
  totalKasAwal: number;
  perHari: { tanggal: string; omzet: number; transaksi: number; pengeluaran: number }[];
  produkTerlaris: { nama: string; qty: number; total: number }[];
  uangAwalList: UangAwalItem[];
  pengeluaranList: PengeluaranItem[];
  daftarPesanan: { pesanan: PesananItem; items: ItemPesananDetail[]; laba: number; hpp: number }[];
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
  const hari = d.getDay();
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

// ─── FUNGSI MUAT DATA LAPORAN ─────────────────────────────────────────────────

async function muatDataHarian(tanggal: string, outletId?: string | null): Promise<RingkasanHarian> {
  const db = await getLocalDB();

  // Mapping HPP Produk
  const listProduk = await db.getAll('produk');
  const hppMap = new Map<string, number>();
  for (const p of listProduk) {
    hppMap.set(p.id, p.hpp || 0);
  }

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

  const daftarPesanan: { pesanan: PesananItem; items: ItemPesananDetail[]; laba: number; hpp: number }[] = [];
  let jumlahItem = 0;
  let totalHpp = 0;
  const mapProduk: Record<string, { qty: number; total: number }> = {};

  for (const p of selesai) {
    const items = await db.getAllFromIndex('item_pesanan', 'by-pesanan', p.id);
    let hppNota = 0;
    for (const it of items) {
      jumlahItem += it.qty;
      const nama = it.nama_produk || 'Unknown';
      if (!mapProduk[nama]) mapProduk[nama] = { qty: 0, total: 0 };
      const totalTambahan = it.tambahan.reduce((s, t) => s + t.harga * t.qty, 0);
      mapProduk[nama].qty += it.qty;
      mapProduk[nama].total += (it.harga_satuan + totalTambahan) * it.qty;

      const unitHpp = hppMap.get(it.produk_id) || Math.round(it.harga_satuan * 0.55);
      hppNota += unitHpp * it.qty;
    }
    totalHpp += hppNota;
    daftarPesanan.push({
      pesanan: p,
      items,
      hpp: hppNota,
      laba: p.total - hppNota,
    });
  }

  for (const p of batal) {
    const items = await db.getAllFromIndex('item_pesanan', 'by-pesanan', p.id);
    daftarPesanan.push({ pesanan: p, items, hpp: 0, laba: 0 });
  }

  const produkTerlaris = Object.entries(mapProduk)
    .map(([nama, v]) => ({ nama, ...v }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10);

  // Muat Uang Awal
  let uangAwalList: UangAwalItem[] = [];
  try {
    const all = await db.getAll('uang_awal');
    uangAwalList = all.filter((u) => {
      const tgl = u.tanggal || u.buka_pada?.slice(0, 10);
      return tgl === tanggal;
    });
  } catch {}
  const totalKasAwal = uangAwalList.reduce((s, u) => s + (u.kas_awal || 0), 0);

  // Muat Pengeluaran Operasional
  let pengeluaranList: PengeluaranItem[] = [];
  try {
    pengeluaranList = await muatPengeluaran(tanggal, outletId);
  } catch {}
  const totalPengeluaran = pengeluaranList.reduce((s, p) => s + (p.nominal || 0), 0);

  const totalLabaKotor = totalOmzet - totalHpp;
  const labaBersih = Math.max(0, totalLabaKotor - totalPengeluaran);
  const marginKotorPersen = totalOmzet > 0 ? Math.round((totalLabaKotor / totalOmzet) * 100) : 0;

  daftarPesanan.sort((a, b) => new Date(b.pesanan.waktu).getTime() - new Date(a.pesanan.waktu).getTime());

  return {
    tanggal, totalOmzet, totalTunai, totalQris,
    jumlahTransaksi: selesai.length, jumlahBatal: batal.length,
    jumlahItem, rataRataTransaksi, transaksiTerbesar,
    totalHpp, totalLabaKotor, totalPengeluaran, labaBersih, marginKotorPersen,
    uangAwalList, pengeluaranList, totalKasAwal, daftarPesanan, produkTerlaris,
  };
}

async function muatDataRentang(dari: string, sampai: string, outletId?: string | null): Promise<RingkasanRentang> {
  const tanggalList = listTanggal(dari, sampai);
  const db = await getLocalDB();

  const listProduk = await db.getAll('produk');
  const hppMap = new Map<string, number>();
  for (const p of listProduk) {
    hppMap.set(p.id, p.hpp || 0);
  }

  let totalOmzet = 0, totalTunai = 0, totalQris = 0;
  let jumlahTransaksi = 0, jumlahBatal = 0, jumlahItem = 0;
  let transaksiTerbesar = 0, totalHpp = 0;
  const perHari: { tanggal: string; omzet: number; transaksi: number; pengeluaran: number }[] = [];
  const mapProduk: Record<string, { qty: number; total: number }> = {};
  const daftarPesanan: { pesanan: PesananItem; items: ItemPesananDetail[]; laba: number; hpp: number }[] = [];
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
      let hppNota = 0;
      for (const it of items) {
        jumlahItem += it.qty;
        const nama = it.nama_produk || 'Unknown';
        if (!mapProduk[nama]) mapProduk[nama] = { qty: 0, total: 0 };
        const totalTambahan = it.tambahan.reduce((s, t) => s + t.harga * t.qty, 0);
        mapProduk[nama].qty += it.qty;
        mapProduk[nama].total += (it.harga_satuan + totalTambahan) * it.qty;

        const unitHpp = hppMap.get(it.produk_id) || Math.round(it.harga_satuan * 0.55);
        hppNota += unitHpp * it.qty;
      }
      totalHpp += hppNota;
      daftarPesanan.push({ pesanan: p, items, hpp: hppNota, laba: p.total - hppNota });
    }

    for (const p of batal) {
      const items = await db.getAllFromIndex('item_pesanan', 'by-pesanan', p.id);
      daftarPesanan.push({ pesanan: p, items, hpp: 0, laba: 0 });
    }

    perHari.push({ tanggal: tgl, omzet: omzetHari, transaksi: selesai.length, pengeluaran: 0 });
  }

  // Uang awal
  try {
    const all = await db.getAll('uang_awal');
    for (const u of all) {
      const tgl = u.tanggal || u.buka_pada?.slice(0, 10);
      if (tgl && tgl >= dari && tgl <= sampai) uangAwalAll.push(u);
    }
  } catch {}

  // Pengeluaran rentang
  let pengeluaranAll: PengeluaranItem[] = [];
  try {
    const allExp = await db.getAll('pengeluaran');
    pengeluaranAll = allExp.filter((e) => {
      const cocokTgl = e.tanggal >= dari && e.tanggal <= sampai;
      const cocokOutlet = !outletId || !e.outlet_id || e.outlet_id === outletId;
      return cocokTgl && cocokOutlet;
    });
  } catch {}

  const totalPengeluaran = pengeluaranAll.reduce((s, p) => s + (p.nominal || 0), 0);
  const totalLabaKotor = totalOmzet - totalHpp;
  const labaBersih = Math.max(0, totalLabaKotor - totalPengeluaran);
  const marginKotorPersen = totalOmzet > 0 ? Math.round((totalLabaKotor / totalOmzet) * 100) : 0;
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
    transaksiTerbesar, totalHpp, totalLabaKotor, totalPengeluaran, labaBersih, marginKotorPersen,
    totalKasAwal, perHari, produkTerlaris,
    uangAwalList: uangAwalAll, pengeluaranList: pengeluaranAll, daftarPesanan,
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
  data: { pesanan: PesananItem; items: ItemPesananDetail[]; laba: number; hpp: number };
  onKembali: () => void;
}) {
  const { pesanan, items, laba, hpp } = data;
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

        {/* Ringkasan Profit Transaksi Ini */}
        {!isBatal && (
          <div class="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex justify-between items-center text-xs">
            <div>
              <span class="text-[10px] uppercase font-bold text-emerald-800 block">Laba Kotor Transaksi</span>
              <span class="text-[10px] text-emerald-700">Modal Bahan: {formatRupiah(hpp)}</span>
            </div>
            <strong class="text-sm font-black text-emerald-900 tabular-nums">
              +{formatRupiah(laba)}
            </strong>
          </div>
        )}

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

// ─── KOMPONEN UTAMA LAYAR LAPORAN ─────────────────────────────────────────────

type ModeView = 'harian' | 'mingguan' | 'bulanan' | 'custom';
type TabAktif = 'ringkasan' | 'transaksi' | 'pengeluaran' | 'produk' | 'kasir';

export function LayarLaporan() {
  const [modeView, setModeView] = useState<ModeView>('harian');
  const [tanggal, setTanggal] = useState<string>(getTanggalLokal());
  const [customDari, setCustomDari] = useState<string>(getTanggalLokal());
  const [customSampai, setCustomSampai] = useState<string>(getTanggalLokal());

  const [laporanHarian, setLaporanHarian] = useState<RingkasanHarian | null>(null);
  const [laporanRentang, setLaporanRentang] = useState<RingkasanRentang | null>(null);
  const [loading, setLoading] = useState(true);
  const [tabAktif, setTabAktif] = useState<TabAktif>('ringkasan');
  const [detailPesanan, setDetailPesanan] = useState<{ pesanan: PesananItem; items: ItemPesananDetail[]; laba: number; hpp: number } | null>(null);

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

  const aktif = laporanHarian || laporanRentang;
  const daftarPesananAktif = laporanHarian?.daftarPesanan || laporanRentang?.daftarPesanan || [];
  const produkTerlarisAktif = laporanHarian?.produkTerlaris || laporanRentang?.produkTerlaris || [];
  const uangAwalAktif = laporanHarian?.uangAwalList || laporanRentang?.uangAwalList || [];
  const pengeluaranAktif = laporanHarian?.pengeluaranList || laporanRentang?.pengeluaranList || [];

  const labelPeriode = () => {
    if (modeView === 'harian') return formatTanggalPanjang(tanggal);
    if (modeView === 'bulanan') return formatBulanTahun(tanggal);
    if (dari === sampai) return formatTanggalPanjang(dari);
    return `${formatTanggalChart(dari)} – ${formatTanggalChart(sampai)}`;
  };

  const TABS: { id: TabAktif; label: string }[] = [
    { id: 'ringkasan', label: 'Ringkasan' },
    { id: 'transaksi', label: 'Transaksi' },
    { id: 'pengeluaran', label: 'Biaya' },
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
      <div class="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-2xs">
        <div class="max-w-3xl mx-auto px-4 pt-3 pb-0">

          {/* Judul + Outlet */}
          <div class="flex items-center justify-between gap-3 mb-3">
            <div>
              <span class="text-[10px] font-black text-slate-800 bg-slate-100 px-2 py-0.5 rounded uppercase">
                Operasional Laporan
              </span>
              <h1 class="text-base font-black text-slate-900 tracking-tight leading-tight mt-0.5">
                Laporan Keuangan & Penjualan
              </h1>
              <p class="text-[11px] text-slate-500 truncate max-w-[220px]">{namaOutlet}</p>
            </div>
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
                onClick={() => setModeView(m.id)}
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

          {/* Label Tanggal */}
          <div class="flex items-center justify-center mb-3 text-[11px] font-bold text-slate-500">
            <span>{labelPeriode()}</span>
          </div>

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

      {/* ── KONTEN LAPORAN ── */}
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
          /* ── TAB RINGKASAN: PEMISAHAN OMZET, HPP, LABA KOTOR, BIAYA, LABA BERSIH ── */
          <div class="space-y-4">
            {/* 1. PEMISAHAN JELAS OMZET vs LABA BERSIH */}
            <div class="grid grid-cols-2 gap-3">
              {/* Card Omzet */}
              <div class="bg-slate-900 text-white rounded-2xl p-4 shadow-md">
                <span class="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                  1. Total Omzet Penjualan
                </span>
                <span class="text-xl sm:text-2xl font-black block mt-1 tabular-nums">
                  {formatRupiah(aktif.totalOmzet)}
                </span>
                <p class="text-[10px] text-slate-400 mt-1">
                  {aktif.jumlahTransaksi} transaksi lunas
                </p>
              </div>

              {/* Card Laba Bersih */}
              <div class="bg-emerald-600 text-white rounded-2xl p-4 shadow-md">
                <span class="text-[10px] font-black uppercase tracking-wider text-emerald-200 block">
                  2. Keuntungan Laba Bersih
                </span>
                <span class="text-xl sm:text-2xl font-black block mt-1 tabular-nums">
                  +{formatRupiah(aktif.labaBersih)}
                </span>
                <p class="text-[10px] text-emerald-100 mt-1">
                  Hasil murni setelah potong biaya
                </p>
              </div>
            </div>

            {/* Rekapitulasi Rinci Finansial (HPP, Laba Kotor, Biaya Pengeluaran) */}
            <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3">
              <h3 class="text-xs font-black uppercase tracking-wider text-slate-700 border-b border-slate-100 pb-2">
                Bedah Arus Kas & Keuntungan Bersih
              </h3>

              <div class="space-y-2 text-xs">
                <div class="flex justify-between items-center p-2 rounded-xl bg-slate-50">
                  <span class="font-bold text-slate-600">Total Omzet Penjualan (Kotor)</span>
                  <strong class="font-black text-slate-900 tabular-nums">{formatRupiah(aktif.totalOmzet)}</strong>
                </div>

                <div class="flex justify-between items-center p-2 rounded-xl bg-amber-50/70 border border-amber-200/70">
                  <span class="font-bold text-amber-900">Modal Pokok Menu (HPP Bahan Baku)</span>
                  <strong class="font-black text-amber-950 tabular-nums">-{formatRupiah(aktif.totalHpp)}</strong>
                </div>

                <div class="flex justify-between items-center p-2 rounded-xl bg-blue-50/80 border border-blue-200/80">
                  <span class="font-bold text-blue-900">
                    Laba Kotor Toko ({aktif.marginKotorPersen}% Margin)
                  </span>
                  <strong class="font-black text-blue-950 tabular-nums">+{formatRupiah(aktif.totalLabaKotor)}</strong>
                </div>

                <div class="flex justify-between items-center p-2 rounded-xl bg-rose-50/80 border border-rose-200/80">
                  <span class="font-bold text-rose-900">
                    Biaya Pengeluaran Operasional ({pengeluaranAktif.length} catatan)
                  </span>
                  <strong class="font-black text-rose-950 tabular-nums">-{formatRupiah(aktif.totalPengeluaran)}</strong>
                </div>

                <div class="flex justify-between items-center p-3 rounded-xl bg-emerald-50 border border-emerald-300">
                  <div>
                    <span class="font-black text-emerald-950 block text-xs">Laba Bersih Akhir Toko</span>
                    <span class="text-[10px] text-emerald-700">Laba Kotor dikurangi Semua Biaya Pengeluaran</span>
                  </div>
                  <strong class="text-base font-black text-emerald-950 tabular-nums font-mono">
                    +{formatRupiah(aktif.labaBersih)}
                  </strong>
                </div>
              </div>
            </div>

            {/* Grid Statistik 6 Metrik */}
            <div class="grid grid-cols-2 gap-3">
              <KartuStat label="Tunai Diterima" nilai={formatRupiah(aktif.totalTunai)}
                sub={aktif.totalOmzet > 0 ? `${Math.round((aktif.totalTunai / aktif.totalOmzet) * 100)}% dari omzet` : '—'} />
              <KartuStat label="QRIS Diterima" nilai={formatRupiah(aktif.totalQris)} warna="text-indigo-700"
                sub={aktif.totalOmzet > 0 ? `${Math.round((aktif.totalQris / aktif.totalOmzet) * 100)}% dari omzet` : '—'} />
              <KartuStat label="Rata-rata / Nota" nilai={formatRupiah(aktif.rataRataTransaksi)} sub="per transaksi" />
              <KartuStat label="Transaksi Terbesar" nilai={formatRupiah(aktif.transaksiTerbesar)} warna="text-emerald-700" sub="1 nota tertinggi" />
              <KartuStat label="Total Item Terjual" nilai={String(aktif.jumlahItem)} sub="porsi / unit" />
              <KartuStat label="Total Kas Awal" nilai={formatRupiah(aktif.totalKasAwal)} sub={`${uangAwalAktif.length} sesi kasir`} />
            </div>

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
          </div>

        ) : tabAktif === 'transaksi' ? (
          /* ── TAB TRANSAKSI ── */
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
            ) : daftarPesananAktif.map((item) => {
              const { pesanan, items, laba } = item;
              const totalItem = items.reduce((s, it) => s + it.qty, 0);
              const isBatal = pesanan.status === 'batal';
              return (
                <div
                  key={pesanan.id}
                  onClick={() => setDetailPesanan(item)}
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
                          pesanan.metode === 'qris' ? 'bg-indigo-100 text-indigo-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {isBatal ? 'BATAL' : (pesanan.metode || '-').toUpperCase()}
                        </span>
                        {!isBatal && (
                          <span class="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                            Laba: +{formatRupiah(laba)}
                          </span>
                        )}
                      </div>
                      <p class="text-[11px] text-slate-500 mt-0.5 truncate">
                        {totalItem} item · {formatWaktu(pesanan.waktu)}
                      </p>
                    </div>
                    <div class="text-right shrink-0">
                      <span class={`text-sm font-black tabular-nums ${isBatal ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                        {formatRupiah(pesanan.total)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

        ) : tabAktif === 'pengeluaran' ? (
          /* ── TAB PENGELUARAN BIAYA TOKO ── */
          <div class="space-y-3">
            <div class="flex items-center justify-between mb-1">
              <span class="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                Rincian Biaya Pengeluaran Toko
              </span>
              <span class="text-xs font-black text-rose-700">
                Total: -{formatRupiah(aktif.totalPengeluaran)}
              </span>
            </div>

            {pengeluaranAktif.length === 0 ? (
              <div class="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-400 text-xs">
                Tidak ada catatan biaya pengeluaran pada periode ini.
              </div>
            ) : (
              <div class="space-y-2">
                {pengeluaranAktif.map((p) => (
                  <div key={p.id} class="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-2xs flex items-center justify-between gap-3">
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-2">
                        <span class="text-[10px] font-black px-2 py-0.5 rounded bg-rose-100 text-rose-800">
                          {p.kategori}
                        </span>
                        <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 uppercase">
                          {p.metode}
                        </span>
                      </div>
                      <h4 class="text-xs font-bold text-slate-900 mt-1">{p.keterangan}</h4>
                      <p class="text-[10px] text-slate-400 mt-0.5">
                        {formatTanggalPanjang(p.tanggal)} · {formatWaktu(p.waktu)}
                      </p>
                    </div>
                    <strong class="text-sm font-black text-rose-700 tabular-nums shrink-0">
                      -{formatRupiah(p.nominal)}
                    </strong>
                  </div>
                ))}
              </div>
            )}
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
          /* ── TAB SESI KASIR ── */
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
              uangAwalAktif.map((u, i) => (
                <div key={u.id} class="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3">
                  <div class="flex items-start justify-between">
                    <div>
                      <h4 class="text-sm font-black text-slate-900">
                        Sesi #{i + 1}{u.kasir_nama ? ` — ${u.kasir_nama}` : ''}
                      </h4>
                      <p class="text-[11px] text-slate-500">
                        Buka: {formatWaktuLengkap(u.buka_pada)}
                        {u.tutup_pada ? ` · Tutup: ${formatWaktuLengkap(u.tutup_pada)}` : ' · Masih Berjalan'}
                      </p>
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
                    <div class="bg-emerald-50 rounded-xl p-2.5">
                      <p class="text-[10px] font-bold text-slate-500 uppercase">Tunai Masuk</p>
                      <p class="font-black text-emerald-800 mt-0.5 tabular-nums">{formatRupiah(u.total_tunai || 0)}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
