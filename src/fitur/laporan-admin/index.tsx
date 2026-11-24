import { useState, useEffect } from 'preact/hooks';
import { getLocalDB, type PesananItem, type ItemPesananDetail, type OutletItem, type PengeluaranItem } from '../../data/db.js';
import { muatSemuaOutlet } from '../../data/outlet.js';
import { muatPengeluaran } from '../../data/pengeluaran.js';
import { sinkronkanPesananDariSupabase } from '../../data/riwayat-sync.js';
import { getTanggalLokal } from '../../data/outbox.js';
import { formatRupiah } from '../../util/rupiah.js';
import { formatTanggalPanjang, formatWaktu } from '../../util/tanggal.js';
import {
  IconLaporan,
  IconToko,
  IconDompet,
  IconCheck,
  IconPrinter,
  IconCari,
  IconChevronDown,
} from '../../komponen/Icon.js';

export function LayarLaporanAdmin() {
  const [daftarOutlet, setDaftarOutlet] = useState<OutletItem[]>([]);
  const [outletPilih, setOutletPilih] = useState<string>('semua');
  
  // Rentang Tanggal
  const [tanggalMulai, setTanggalMulai] = useState<string>(getTanggalLokal());
  const [tanggalSampai, setTanggalSampai] = useState<string>(getTanggalLokal());
  const [tabAktif, setTabAktif] = useState<'ringkasan' | 'transaksi' | 'pengeluaran' | 'produk' | 'outlet'>('ringkasan');

  const [pesananList, setPesananList] = useState<PesananItem[]>([]);
  const [itemPesananList, setItemPesananList] = useState<ItemPesananDetail[]>([]);
  const [pengeluaranList, setPengeluaranList] = useState<PengeluaranItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [cariTeks, setCariTeks] = useState('');

  // 1. Muat Outlet
  useEffect(() => {
    muatSemuaOutlet().then(setDaftarOutlet).catch(() => {});
  }, []);

  // 2. Muat Data Transaksi & Pengeluaran
  const muatData = async () => {
    setLoading(true);
    try {
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        await sinkronkanPesananDariSupabase().catch(() => {});
      }

      const db = await getLocalDB();
      const allPesanan = await db.getAll('pesanan');
      const allItems = await db.getAll('item_pesanan');
      const allPengeluaran = await muatPengeluaran();

      // Filter berdasarkan rentang tanggal
      let filteredPesanan = allPesanan.filter((p) => {
        return p.tanggal >= tanggalMulai && p.tanggal <= tanggalSampai;
      });

      let filteredPengeluaran = allPengeluaran.filter((b) => {
        return b.tanggal >= tanggalMulai && b.tanggal <= tanggalSampai;
      });

      // Filter berdasarkan Toko / Cabang
      if (outletPilih !== 'semua') {
        filteredPesanan = filteredPesanan.filter((p) => p.outlet_id === outletPilih);
        filteredPengeluaran = filteredPengeluaran.filter((b) => b.outlet_id === outletPilih);
      }

      filteredPesanan.sort((a, b) => new Date(b.waktu).getTime() - new Date(a.waktu).getTime());
      filteredPengeluaran.sort((a, b) => new Date(b.waktu).getTime() - new Date(a.waktu).getTime());

      setPesananList(filteredPesanan);
      setItemPesananList(allItems);
      setPengeluaranList(filteredPengeluaran);
    } catch (err) {
      console.warn('Gagal muat data laporan admin:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    muatData();
    const handleUpdate = () => {
      muatData();
    };
    window.addEventListener('mitarasa:data-updated', handleUpdate);
    return () => window.removeEventListener('mitarasa:data-updated', handleUpdate);
  }, [tanggalMulai, tanggalSampai, outletPilih]);

  // Kalkulasi Finansial
  const pesananSelesai = pesananList.filter((p) => p.status === 'selesai');
  const pesananBatal = pesananList.filter((p) => p.status === 'batal');

  const totalOmzet = pesananSelesai.reduce((s, p) => s + (p.total || 0), 0);
  const totalTunai = pesananSelesai.filter((p) => p.metode === 'tunai').reduce((s, p) => s + (p.total || 0), 0);
  const totalQris = pesananSelesai.filter((p) => p.metode === 'qris').reduce((s, p) => s + (p.total || 0), 0);
  const totalPengeluaran = pengeluaranList.reduce((s, b) => s + (b.nominal || 0), 0);
  const saldoBersih = totalOmzet - totalPengeluaran;

  // Analisis Menu Terlaris
  const pesananSelesaiIds = new Set(pesananSelesai.map((p) => p.id));
  const itemTerjualMap: Record<string, { nama: string; qty: number; totalRupiah: number }> = {};

  for (const it of itemPesananList) {
    if (pesananSelesaiIds.has(it.pesanan_id)) {
      if (!itemTerjualMap[it.nama_produk]) {
        itemTerjualMap[it.nama_produk] = { nama: it.nama_produk, qty: 0, totalRupiah: 0 };
      }
      itemTerjualMap[it.nama_produk].qty += it.qty;
      itemTerjualMap[it.nama_produk].totalRupiah += it.qty * it.harga_satuan;
    }
  }

  const topProduk = Object.values(itemTerjualMap).sort((a, b) => b.qty - a.qty);

  // Analisis Per-Toko / Cabang
  const outletMap: Record<string, { nama: string; omzet: number; tunai: number; qris: number; biaya: number; trx: number }> = {};
  for (const o of daftarOutlet) {
    outletMap[o.id] = { nama: o.nama, omzet: 0, tunai: 0, qris: 0, biaya: 0, trx: 0 };
  }
  outletMap['tanpa_outlet'] = { nama: 'Outlet Lain / Pusat', omzet: 0, tunai: 0, qris: 0, biaya: 0, trx: 0 };

  for (const p of pesananSelesai) {
    const key = p.outlet_id && outletMap[p.outlet_id] ? p.outlet_id : 'tanpa_outlet';
    outletMap[key].omzet += p.total;
    if (p.metode === 'tunai') outletMap[key].tunai += p.total;
    if (p.metode === 'qris') outletMap[key].qris += p.total;
    outletMap[key].trx += 1;
  }

  for (const b of pengeluaranList) {
    const key = b.outlet_id && outletMap[b.outlet_id] ? b.outlet_id : 'tanpa_outlet';
    outletMap[key].biaya += b.nominal || 0;
  }

  const listOutletRekap = Object.entries(outletMap)
    .filter(([_, v]) => v.omzet > 0 || v.biaya > 0 || v.trx > 0)
    .map(([id, v]) => ({ id, ...v }));

  return (
    <div class="min-h-screen bg-slate-50 pb-28 text-slate-900">
      {/* ── HEADER ── */}
      <div class="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-2xs">
        <div class="max-w-5xl mx-auto px-4 py-3.5">
          <div class="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div class="flex items-center gap-2">
                <span class="px-2 py-0.5 rounded-md bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider">
                  ADMIN
                </span>
                <h1 class="text-base font-black text-slate-900 tracking-tight leading-tight">
                  Laporan Lengkap Seluruh Toko
                </h1>
              </div>
              <p class="text-[11px] text-slate-500 mt-0.5">
                Audit keuangan komprehensif, penjualan per cabang, arus kas tunai/QRIS, dan operasional
              </p>
            </div>

            <div class="flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                class="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <IconPrinter size={14} />
                <span>Cetak / PDF</span>
              </button>
            </div>
          </div>

          {/* ── BARIS FILTER: PILIH TOKO + RENTANG TANGGAL ── */}
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-3.5 pt-3 border-t border-slate-100">
            <div>
              <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                Pilih Cabang / Toko:
              </label>
              <select
                value={outletPilih}
                onChange={(e) => setOutletPilih((e.target as HTMLSelectElement).value)}
                class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-slate-900 cursor-pointer"
              >
                <option value="semua">Semua Cabang Toko</option>
                {daftarOutlet.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nama} ({o.kode})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                Dari Tanggal:
              </label>
              <input
                type="date"
                value={tanggalMulai}
                onChange={(e) => setTanggalMulai((e.target as HTMLInputElement).value)}
                class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-slate-900 cursor-pointer"
              >
              </input>
            </div>

            <div>
              <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                Sampai Tanggal:
              </label>
              <input
                type="date"
                value={tanggalSampai}
                onChange={(e) => setTanggalSampai((e.target as HTMLInputElement).value)}
                class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-slate-900 cursor-pointer"
              >
              </input>
            </div>
          </div>

          {/* ── TAB NAVIGASI LAPORAN ── */}
          <div class="flex items-center gap-1.5 mt-3 overflow-x-auto pb-1 text-xs font-bold">
            {[
              { id: 'ringkasan', label: 'Ringkasan Keuangan' },
              { id: 'outlet', label: `Performa Cabang (${listOutletRekap.length})` },
              { id: 'transaksi', label: `Daftar Penjualan (${pesananSelesai.length})` },
              { id: 'pengeluaran', label: `Biaya & Pengeluaran (${pengeluaranList.length})` },
              { id: 'produk', label: `Menu Terlaris (${topProduk.length})` },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTabAktif(t.id as any)}
                class={`px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                  tabAktif === t.id
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── KONTEN LAPORAN DETAIL ── */}
      <div class="max-w-5xl mx-auto px-4 py-4 space-y-4">
        {loading ? (
          <div class="py-20 text-center text-slate-400 text-xs">
            <div class="w-6 h-6 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin mx-auto mb-2" />
            Mengompilasi laporan seluruh toko...
          </div>
        ) : (
          <>
            {/* ── 4 KARTU METRIK KEUANGAN UTAMA ── */}
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div class="bg-slate-900 text-white rounded-2xl p-4 shadow-xs">
                <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Omzet Penjualan</span>
                <span class="text-xl font-black tracking-tight block mt-1 tabular-nums">
                  {formatRupiah(totalOmzet)}
                </span>
                <p class="text-[10px] text-slate-400 mt-1">
                  {pesananSelesai.length} transaksi lunas
                </p>
              </div>

              <div class="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                <span class="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">Penerimaan Tunai</span>
                <span class="text-xl font-black text-emerald-950 block mt-1 tabular-nums">
                  {formatRupiah(totalTunai)}
                </span>
                <p class="text-[10px] text-emerald-700 mt-1">
                  Uang fisik di kasir
                </p>
              </div>

              <div class="bg-indigo-50 border border-indigo-200 rounded-2xl p-4">
                <span class="text-[10px] font-bold uppercase tracking-wider text-indigo-800 block">Penerimaan QRIS</span>
                <span class="text-xl font-black text-indigo-950 block mt-1 tabular-nums">
                  {formatRupiah(totalQris)}
                </span>
                <p class="text-[10px] text-indigo-700 mt-1">
                  Non-tunai rekening toko
                </p>
              </div>

              <div class="bg-rose-50 border border-rose-200 rounded-2xl p-4">
                <span class="text-[10px] font-bold uppercase tracking-wider text-rose-800 block">Total Pengeluaran</span>
                <span class="text-xl font-black text-rose-950 block mt-1 tabular-nums">
                  {formatRupiah(totalPengeluaran)}
                </span>
                <p class="text-[10px] text-rose-700 mt-1">
                  {pengeluaranList.length} pos biaya dicatat
                </p>
              </div>
            </div>

            {/* Saldo Akhir Kas Toko */}
            <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3">
              <div>
                <span class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Saldo Bersih Periode Ini</span>
                <div class="flex items-baseline gap-2 mt-0.5">
                  <span class={`text-2xl font-black tabular-nums ${saldoBersih >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
                    {formatRupiah(saldoBersih)}
                  </span>
                  <span class="text-xs text-slate-500">
                    (Omzet {formatRupiah(totalOmzet)} - Biaya {formatRupiah(totalPengeluaran)})
                  </span>
                </div>
              </div>

              <div class="text-right text-xs text-slate-500">
                <span>Periode: </span>
                <strong class="text-slate-800 font-bold">
                  {formatTanggalPanjang(tanggalMulai)} {tanggalMulai !== tanggalSampai ? `s/d ${formatTanggalPanjang(tanggalSampai)}` : ''}
                </strong>
              </div>
            </div>

            {/* ── TAB 1: RINGKASAN ── */}
            {tabAktif === 'ringkasan' && (
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Rincian Arus Kas */}
                <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3">
                  <h3 class="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2">
                    Komposisi Pendapatan
                  </h3>
                  <div class="space-y-2 text-xs">
                    <div class="flex justify-between items-center py-1 border-b border-slate-50">
                      <span class="text-slate-600">Total Transaksi Selesai</span>
                      <strong class="font-bold text-slate-900">{pesananSelesai.length} Nota</strong>
                    </div>
                    <div class="flex justify-between items-center py-1 border-b border-slate-50">
                      <span class="text-slate-600">Transaksi Dibatalkan</span>
                      <strong class="font-bold text-rose-600">{pesananBatal.length} Nota</strong>
                    </div>
                    <div class="flex justify-between items-center py-1 border-b border-slate-50">
                      <span class="text-slate-600">Rata-rata Nilai Belanja (Basket Size)</span>
                      <strong class="font-bold text-slate-900">
                        {pesananSelesai.length > 0 ? formatRupiah(Math.round(totalOmzet / pesananSelesai.length)) : 'Rp 0,00'}
                      </strong>
                    </div>
                    <div class="flex justify-between items-center py-1 border-b border-slate-50">
                      <span class="text-slate-600">Porsi Pembayaran Tunai</span>
                      <strong class="font-bold text-emerald-700">
                        {totalOmzet > 0 ? Math.round((totalTunai / totalOmzet) * 100) : 0}% ({formatRupiah(totalTunai)})
                      </strong>
                    </div>
                    <div class="flex justify-between items-center py-1">
                      <span class="text-slate-600">Porsi Pembayaran QRIS</span>
                      <strong class="font-bold text-indigo-700">
                        {totalOmzet > 0 ? Math.round((totalQris / totalOmzet) * 100) : 0}% ({formatRupiah(totalQris)})
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Top 5 Menu */}
                <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3">
                  <h3 class="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2">
                    5 Menu Paling Laris
                  </h3>
                  {topProduk.length === 0 ? (
                    <p class="text-xs text-slate-400 py-6 text-center">Belum ada data penjualan pada periode ini</p>
                  ) : (
                    <div class="space-y-2 text-xs">
                      {topProduk.slice(0, 5).map((p, idx) => (
                        <div key={p.nama} class="flex items-center justify-between py-1 border-b border-slate-50 last:border-0">
                          <div class="flex items-center gap-2">
                            <span class="w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-black flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <span class="font-bold text-slate-800">{p.nama}</span>
                          </div>
                          <div class="text-right">
                            <span class="font-black text-slate-900 block">{p.qty} Porsi</span>
                            <span class="text-[10px] text-slate-500">{formatRupiah(p.totalRupiah)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── TAB 2: PERFORMA CABANG / TOKO ── */}
            {tabAktif === 'outlet' && (
              <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                <div class="p-3.5 border-b border-slate-100 bg-slate-50/60">
                  <h3 class="text-xs font-black uppercase tracking-wider text-slate-800">
                    Perbandingan Performa Toko / Cabang
                  </h3>
                </div>
                {listOutletRekap.length === 0 ? (
                  <p class="text-xs text-slate-400 py-10 text-center">Belum ada data cabang pada periode ini</p>
                ) : (
                  <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr class="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                          <th class="p-3">Nama Cabang / Toko</th>
                          <th class="p-3 text-center">Total Transaksi</th>
                          <th class="p-3 text-right">Kas Tunai</th>
                          <th class="p-3 text-right">QRIS</th>
                          <th class="p-3 text-right">Total Omzet</th>
                          <th class="p-3 text-right">Pengeluaran</th>
                          <th class="p-3 text-right">Saldo Kas</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-slate-100 font-medium">
                        {listOutletRekap.map((o) => (
                          <tr key={o.id} class="hover:bg-slate-50/60 transition-colors">
                            <td class="p-3 font-bold text-slate-900">{o.nama}</td>
                            <td class="p-3 text-center font-bold">{o.trx} Nota</td>
                            <td class="p-3 text-right text-emerald-700">{formatRupiah(o.tunai)}</td>
                            <td class="p-3 text-right text-indigo-700">{formatRupiah(o.qris)}</td>
                            <td class="p-3 text-right font-black text-slate-900">{formatRupiah(o.omzet)}</td>
                            <td class="p-3 text-right text-rose-600">-{formatRupiah(o.biaya)}</td>
                            <td class="p-3 text-right font-black text-slate-900">
                              {formatRupiah(o.omzet - o.biaya)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ── TAB 3: DAFTAR TRANSAKSI LENGKAP ── */}
            {tabAktif === 'transaksi' && (
              <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs space-y-3 p-4">
                <div class="flex items-center justify-between gap-3 flex-wrap">
                  <h3 class="text-xs font-black uppercase tracking-wider text-slate-800">
                    Log Transaksi Lengkap
                  </h3>
                  <div class="w-full sm:w-64">
                    <input
                      type="search"
                      placeholder="Cari antrean / nota..."
                      value={cariTeks}
                      onInput={(e) => setCariTeks((e.target as HTMLInputElement).value)}
                      class="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-slate-900"
                    />
                  </div>
                </div>

                <div class="overflow-x-auto">
                  <table class="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr class="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                        <th class="p-2.5">Waktu</th>
                        <th class="p-2.5">No Antrean / Nota</th>
                        <th class="p-2.5">Jenis</th>
                        <th class="p-2.5">Metode</th>
                        <th class="p-2.5 text-right">Total Tagihan</th>
                        <th class="p-2.5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                      {pesananList
                        .filter((p) => {
                          if (!cariTeks.trim()) return true;
                          const k = cariTeks.toLowerCase();
                          return (
                            (p.kode_transaksi || '').toLowerCase().includes(k) ||
                            String(p.nomor).includes(k) ||
                            (p.catatan || '').toLowerCase().includes(k)
                          );
                        })
                        .map((p) => (
                          <tr key={p.id} class="hover:bg-slate-50/60 transition-colors">
                            <td class="p-2.5 text-slate-500 whitespace-nowrap">
                              {p.tanggal} · {formatWaktu(p.waktu)}
                            </td>
                            <td class="p-2.5 font-bold text-slate-900 whitespace-nowrap">
                              {p.kode_perangkat}-{String(p.nomor).padStart(3, '0')}
                              {p.kode_transaksi && (
                                <span class="text-[10px] text-slate-400 font-normal block font-mono">
                                  {p.kode_transaksi}
                                </span>
                              )}
                            </td>
                            <td class="p-2.5 capitalize">{p.jenis.replace(/_/g, ' ')}</td>
                            <td class="p-2.5 uppercase font-bold text-[11px]">
                              <span class={`px-2 py-0.5 rounded-full ${p.metode === 'qris' ? 'bg-indigo-100 text-indigo-800' : 'bg-emerald-100 text-emerald-800'}`}>
                                {p.metode}
                              </span>
                            </td>
                            <td class="p-2.5 text-right font-black text-slate-900 tabular-nums">
                              {formatRupiah(p.total)}
                            </td>
                            <td class="p-2.5 text-center">
                              <span class={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.status === 'selesai' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                                {p.status === 'selesai' ? 'LUNAS' : 'BATAL'}
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── TAB 4: DAFTAR PENGELUARAN ── */}
            {tabAktif === 'pengeluaran' && (
              <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs space-y-3 p-4">
                <h3 class="text-xs font-black uppercase tracking-wider text-slate-800">
                  Rincian Biaya & Pengeluaran Toko
                </h3>

                {pengeluaranList.length === 0 ? (
                  <p class="text-xs text-slate-400 py-10 text-center">Tidak ada pengeluaran pada periode ini</p>
                ) : (
                  <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr class="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                          <th class="p-2.5">Tanggal</th>
                          <th class="p-2.5">Kategori</th>
                          <th class="p-2.5">Keterangan</th>
                          <th class="p-2.5">Petugas / Kasir</th>
                          <th class="p-2.5 text-right">Nominal</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-slate-100">
                        {pengeluaranList.map((b) => (
                          <tr key={b.id} class="hover:bg-slate-50/60 transition-colors">
                            <td class="p-2.5 text-slate-500 whitespace-nowrap">{b.tanggal}</td>
                            <td class="p-2.5 font-bold text-slate-800">{b.kategori}</td>
                            <td class="p-2.5 text-slate-600">{b.keterangan || '-'}</td>
                            <td class="p-2.5 text-slate-500">{b.kasir_nama || '-'}</td>
                            <td class="p-2.5 text-right font-black text-rose-600 tabular-nums">
                              -{formatRupiah(b.nominal)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ── TAB 5: PRODUK TERLARIS ── */}
            {tabAktif === 'produk' && (
              <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs p-4 space-y-3">
                <h3 class="text-xs font-black uppercase tracking-wider text-slate-800">
                  Daftar Porsi Menu Terjual Lengkap
                </h3>

                {topProduk.length === 0 ? (
                  <p class="text-xs text-slate-400 py-10 text-center">Belum ada menu terjual pada periode ini</p>
                ) : (
                  <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr class="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                          <th class="p-2.5 w-12 text-center">Rank</th>
                          <th class="p-2.5">Nama Menu / Produk</th>
                          <th class="p-2.5 text-center">Porsi Terjual</th>
                          <th class="p-2.5 text-right">Total Penjualan (Rp)</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-slate-100 font-medium">
                        {topProduk.map((p, idx) => (
                          <tr key={p.nama} class="hover:bg-slate-50/60 transition-colors">
                            <td class="p-2.5 text-center font-black text-slate-400">{idx + 1}</td>
                            <td class="p-2.5 font-bold text-slate-900">{p.nama}</td>
                            <td class="p-2.5 text-center font-black text-emerald-800">{p.qty} Porsi</td>
                            <td class="p-2.5 text-right font-black text-slate-900 tabular-nums">
                              {formatRupiah(p.totalRupiah)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
