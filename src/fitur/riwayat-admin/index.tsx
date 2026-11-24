import { useState, useEffect } from 'preact/hooks';
import {
  getLocalDB,
  type PesananItem,
  type ItemPesananDetail,
  type OutletItem,
  type ProdukItem,
  type OutboxItem,
} from '../../data/db.js';
import { getTanggalLokal, formatNomorAntrean, batalkanPesananLokal, hapusPesananPermanen } from '../../data/outbox.js';
import { formatRupiah } from '../../util/rupiah.js';
import { formatTeksStruk, bagikanStruk } from '../../util/struk.js';
import { sessionSignal } from '../../state/sesi.js';
import { muatSemuaOutlet } from '../../data/outlet.js';
import { muatPengeluaran } from '../../data/pengeluaran.js';
import { getSupabase } from '../../data/supabase.js';
import { pendingOutboxCountSignal } from '../../state/sinkron.js';
import { prosesOutbox } from '../../data/sync.js';
import {
  formatTanggalPanjang,
  formatWaktu,
  formatTanggalWaktu,
} from '../../util/tanggal.js';
import {
  IconCari,
  IconCheck,
  IconTutup,
  IconPrinter,
  IconShare,
  IconPlus,
  IconMinus,
} from '../../komponen/Icon.js';

interface PesananDenganItem {
  pesanan: PesananItem;
  items: ItemPesananDetail[];
  nomorAntrean: string;
  totalHpp: number;
  totalLaba: number;
  marginPersen: number;
}

export function LayarRiwayatAdmin() {
  const [daftarPesanan, setDaftarPesanan] = useState<PesananDenganItem[]>([]);
  const [tanggalPilih, setTanggalPilih] = useState<string>(getTanggalLokal());
  const [outletPilih, setOutletPilih] = useState<string>('semua');
  const [statusFilter, setStatusFilter] = useState<'semua' | 'selesai' | 'batal'>('semua');
  const [metodeFilter, setMetodeFilter] = useState<'semua' | 'tunai' | 'qris'>('semua');
  const [cari, setCari] = useState('');
  const [loading, setLoading] = useState(true);
  const [daftarOutlet, setDaftarOutlet] = useState<OutletItem[]>([]);
  const [mapHppProduk, setMapHppProduk] = useState<Map<string, number>>(new Map());
  const [totalPengeluaranOperasional, setTotalPengeluaranOperasional] = useState<number>(0);

  // Modal Detail & Edit
  const [pesananDipilih, setPesananDipilih] = useState<PesananDenganItem | null>(null);
  const [modeEdit, setModeEdit] = useState(false);
  const [editMetode, setEditMetode] = useState<'tunai' | 'qris'>('tunai');
  const [editStatus, setEditStatus] = useState<'selesai' | 'batal'>('selesai');
  const [editBayar, setEditBayar] = useState<number>(0);
  const [editCatatan, setEditCatatan] = useState<string>('');
  const [editAlasanBatal, setEditAlasanBatal] = useState<string>('');
  const [editItems, setEditItems] = useState<ItemPesananDetail[]>([]);
  const [pesanNotif, setPesanNotif] = useState('');

  // Modal Batal Cepat
  const [modalBatal, setModalBatal] = useState(false);
  const [alasanBatalCepat, setAlasanBatalCepat] = useState('');
  const [errorBatal, setErrorBatal] = useState('');

  // Modal Hapus Permanen
  const [modalHapus, setModalHapus] = useState(false);
  const [konfirmasiHapusTeks, setKonfirmasiHapusTeks] = useState('');

  const notifikasi = (teks: string) => {
    setPesanNotif(teks);
    setTimeout(() => setPesanNotif(''), 3500);
  };

  // Muat outlet dan daftar produk untuk mapping HPP
  useEffect(() => {
    muatSemuaOutlet().then(setDaftarOutlet).catch(() => {});
    getLocalDB().then(async (db) => {
      const listProduk = await db.getAll('produk');
      const map = new Map<string, number>();
      for (const p of listProduk) {
        map.set(p.id, p.hpp || 0);
      }
      setMapHppProduk(map);
    });
  }, []);

  const muatDataPesanan = async () => {
    setLoading(true);
    const db = await getLocalDB();

    let pesananData: PesananItem[] = [];
    if (tanggalPilih) {
      pesananData = await db.getAllFromIndex('pesanan', 'by-tanggal', tanggalPilih);
    } else {
      pesananData = await db.getAll('pesanan');
    }

    if (outletPilih !== 'semua') {
      pesananData = pesananData.filter((p) => p.outlet_id === outletPilih);
    }

    if (statusFilter !== 'semua') {
      pesananData = pesananData.filter((p) => p.status === statusFilter);
    }

    if (metodeFilter !== 'semua') {
      pesananData = pesananData.filter((p) => p.metode === metodeFilter);
    }

    pesananData.sort((a, b) => new Date(b.waktu).getTime() - new Date(a.waktu).getTime());

    // Ambil produk untuk referensi HPP terbaru jika map kosong
    const listProduk = await db.getAll('produk');
    const hppMap = new Map<string, number>();
    for (const p of listProduk) {
      hppMap.set(p.id, p.hpp || 0);
    }

    const hasil: PesananDenganItem[] = [];
    for (const p of pesananData) {
      const items = await db.getAllFromIndex('item_pesanan', 'by-pesanan', p.id);

      // Hitung HPP dan Laba Kotor
      let totalHpp = 0;
      for (const it of items) {
        const hppPerUnit = hppMap.get(it.produk_id) || Math.round(it.harga_satuan * 0.55);
        totalHpp += hppPerUnit * it.qty;
      }
      const totalLaba = p.total - totalHpp;
      const marginPersen = p.total > 0 ? Math.round((totalLaba / p.total) * 100) : 0;

      hasil.push({
        pesanan: p,
        items,
        nomorAntrean: formatNomorAntrean(p.kode_perangkat, p.nomor),
        totalHpp,
        totalLaba,
        marginPersen,
      });
    }

    setDaftarPesanan(hasil);

    // Muat juga total pengeluaran operasional toko pada tanggal/outlet tersebut
    try {
      const listBiaya = await muatPengeluaran(tanggalPilih, outletPilih);
      const sumBiaya = listBiaya.reduce((s, b) => s + (b.nominal || 0), 0);
      setTotalPengeluaranOperasional(sumBiaya);
    } catch {}

    setLoading(false);
  };

  useEffect(() => {
    muatDataPesanan();
  }, [tanggalPilih, outletPilih, statusFilter, metodeFilter]);

  // Siapkan data saat membuka detail pesanan
  const bukaDetail = (item: PesananDenganItem) => {
    setPesananDipilih(item);
    setModeEdit(false);
    setEditMetode(item.pesanan.metode);
    setEditStatus(item.pesanan.status);
    setEditBayar(item.pesanan.bayar);
    setEditCatatan(item.pesanan.catatan || '');
    setEditAlasanBatal(item.pesanan.alasan_batal || '');
    setEditItems(JSON.parse(JSON.stringify(item.items)));
  };

  // Hitung ulang total di mode edit
  const hitungTotalEdit = () => {
    let t = 0;
    for (const it of editItems) {
      const totTambahan = it.tambahan.reduce((s, x) => s + x.harga * x.qty, 0);
      t += (it.harga_satuan + totTambahan) * it.qty;
    }
    return t;
  };

  const ubahQtyEditItem = (idx: number, delta: number) => {
    const list = [...editItems];
    const item = list[idx];
    const baru = item.qty + delta;
    if (baru <= 0) {
      if (list.length === 1) {
        alert('Minimal harus ada 1 item pesanan. Jika ingin membatalkan transaksi, ubah status menjadi Batal.');
        return;
      }
      list.splice(idx, 1);
    } else {
      list[idx] = { ...item, qty: baru };
    }
    setEditItems(list);
  };

  // Simpan Perubahan oleh Admin (IndexedDB + Outbox + Supabase langsung jika online)
  const handleSimpanEditAdmin = async (e: Event) => {
    e.preventDefault();
    if (!pesananDipilih) return;

    const totalBaru = hitungTotalEdit();
    let bayarBaru = editBayar;
    if (editMetode === 'qris' || bayarBaru < totalBaru) {
      bayarBaru = totalBaru;
    }
    const kembalianBaru = Math.max(0, bayarBaru - totalBaru);

    const pesananTerupdate: PesananItem = {
      ...pesananDipilih.pesanan,
      metode: editMetode,
      status: editStatus,
      total: totalBaru,
      bayar: bayarBaru,
      kembalian: kembalianBaru,
      catatan: editCatatan.trim() || null,
      alasan_batal: editStatus === 'batal' ? (editAlasanBatal.trim() || 'Dibatalkan oleh Admin') : null,
    };

    const db = await getLocalDB();
    const waktuISO = new Date().toISOString();

    // Transaksi update lokal
    const tx = db.transaction(['pesanan', 'item_pesanan', 'outbox'], 'readwrite');
    await tx.objectStore('pesanan').put(pesananTerupdate);

    // Hapus item lama yang di-delete/diupdate lalu simpan editItems
    for (const it of editItems) {
      await tx.objectStore('item_pesanan').put(it);
    }

    // Buat outbox untuk update server
    const { kode_transaksi: _k, ...dataServer } = pesananTerupdate;
    const outboxItem: OutboxItem = {
      id: crypto.randomUUID(),
      tabel: 'pesanan',
      data: dataServer,
      waktu: waktuISO,
      status: 'pending',
      percobaan: 0,
    };
    await tx.objectStore('outbox').put(outboxItem);
    await tx.done;

    pendingOutboxCountSignal.value = await db.count('outbox');

    // Langsung tembak Supabase jika online agar langsung sinkron
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const supabase = await getSupabase();
        await supabase.from('pesanan').upsert(dataServer);
        for (const it of editItems) {
          await supabase.from('item_pesanan').upsert(it);
        }
      } catch (err) {
        console.warn('Gagal sinkron edit pesanan ke cloud:', err);
      }
      prosesOutbox().catch(() => {});
    }

    notifikasi(`Transaksi ${pesananDipilih.nomorAntrean} berhasil diperbarui oleh Admin!`);
    setModeEdit(false);
    setPesananDipilih(null);
    await muatDataPesanan();
  };

  // Hapus Permanen Transaksi oleh Admin
  const handleHapusPermanen = async () => {
    if (!pesananDipilih) return;
    try {
      await hapusPesananPermanen(pesananDipilih.pesanan.id);
      notifikasi(`Transaksi ${pesananDipilih.nomorAntrean} telah dihapus permanen dari sistem.`);
      setModalHapus(false);
      setPesananDipilih(null);
      await muatDataPesanan();
    } catch (err: any) {
      alert('Gagal menghapus transaksi: ' + (err.message || 'Error tidak diketahui'));
    }
  };

  // Batalkan Cepat dari Detail
  const handleBatalkanCepat = async (e: Event) => {
    e.preventDefault();
    if (!alasanBatalCepat.trim()) {
      setErrorBatal('Alasan pembatalan wajib diisi');
      return;
    }
    if (!pesananDipilih) return;

    try {
      await batalkanPesananLokal(pesananDipilih.pesanan.id, alasanBatalCepat.trim());
      setModalBatal(false);
      setAlasanBatalCepat('');
      setErrorBatal('');
      setPesananDipilih(null);
      notifikasi(`Pesanan ${pesananDipilih.nomorAntrean} telah dibatalkan.`);
      await muatDataPesanan();
    } catch (err: any) {
      setErrorBatal(err.message || 'Gagal membatalkan pesanan');
    }
  };

  const handleCetak = () => {
    window.print();
  };

  const handleBagikan = async () => {
    if (!pesananDipilih) return;
    const namaKasir = sessionSignal.value?.nama || 'Admin';
    const teks = formatTeksStruk(
      pesananDipilih.pesanan,
      pesananDipilih.items,
      namaKasir,
    );

    const res = await bagikanStruk(teks, pesananDipilih.nomorAntrean);
    if (res === 'clipboard') {
      notifikasi('Teks nota struk berhasil disalin ke clipboard');
    }
  };

  const pesananTersaring = daftarPesanan.filter((item) => {
    if (!cari.trim()) return true;
    const k = cari.toLowerCase().trim();
    return (
      item.nomorAntrean.toLowerCase().includes(k) ||
      (item.pesanan.kode_transaksi || '').toLowerCase().includes(k) ||
      String(item.pesanan.nomor).includes(k) ||
      (item.pesanan.catatan || '').toLowerCase().includes(k) ||
      item.items.some((it) => it.nama_produk.toLowerCase().includes(k))
    );
  });

  const totalOmzetLunas = pesananTersaring
    .filter((p) => p.pesanan.status === 'selesai')
    .reduce((s, p) => s + (p.pesanan.total || 0), 0);

  const totalLabaKotor = pesananTersaring
    .filter((p) => p.pesanan.status === 'selesai')
    .reduce((s, p) => s + p.totalLaba, 0);

  const totalHppSemua = pesananTersaring
    .filter((p) => p.pesanan.status === 'selesai')
    .reduce((s, p) => s + p.totalHpp, 0);

  const totalTunai = pesananTersaring
    .filter((p) => p.pesanan.status === 'selesai' && p.pesanan.metode === 'tunai')
    .reduce((s, p) => s + (p.pesanan.total || 0), 0);

  const totalQris = pesananTersaring
    .filter((p) => p.pesanan.status === 'selesai' && p.pesanan.metode === 'qris')
    .reduce((s, p) => s + (p.pesanan.total || 0), 0);

  const totalBatal = pesananTersaring.filter((p) => p.pesanan.status === 'batal').length;
  const totalLunas = pesananTersaring.filter((p) => p.pesanan.status === 'selesai').length;

  return (
    <div class="min-h-screen bg-slate-50 pb-28 text-slate-900">
      {/* Toast Notifikasi */}
      {pesanNotif && (
        <div class="fixed top-14 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-4 py-2.5 rounded-full text-xs font-semibold z-50 shadow-xl flex items-center gap-2">
          <IconCheck size={14} color="#22c55e" />
          <span>{pesanNotif}</span>
        </div>
      )}

      {/* ── HEADER HALAMAN ADMIN ── */}
      <div class="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-2xs">
        <div class="max-w-4xl mx-auto px-4 py-3.5">
          <div class="flex items-center justify-between gap-3">
            <div>
              <div class="flex items-center gap-2">
                <span class="px-2 py-0.5 rounded-md bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider">
                  ADMIN
                </span>
                <h1 class="text-base font-black text-slate-900 tracking-tight leading-tight">
                  Riwayat & Edit Transaksi
                </h1>
              </div>
              <p class="text-[11px] text-slate-500 mt-0.5">
                Audit, koreksi metode bayar/item, dan pantau laba keuntungan per transaksi
              </p>
            </div>

            {tanggalPilih !== getTanggalLokal() && (
              <button
                type="button"
                onClick={() => setTanggalPilih(getTanggalLokal())}
                class="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
              >
                Hari Ini
              </button>
            )}
          </div>

          {/* ── BARIS FILTER: TANGGAL + OUTLET ── */}
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
            <div>
              <div class="flex items-center justify-between mb-1">
                <label class="text-[10px] font-bold text-slate-500 uppercase">
                  Tanggal Transaksi:
                </label>
                <span class="text-[10px] font-bold text-slate-700">
                  {formatTanggalPanjang(tanggalPilih)}
                </span>
              </div>
              <input
                type="date"
                value={tanggalPilih}
                onChange={(e) => setTanggalPilih((e.target as HTMLInputElement).value)}
                class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-slate-900 cursor-pointer"
              />
            </div>

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
          </div>

          {/* ── BARIS FILTER: STATUS & METODE & CARI ── */}
          <div class="flex flex-wrap items-center gap-2 mt-2.5">
            {/* Status Segmented */}
            <div class="flex bg-slate-100 p-0.5 rounded-xl text-[11px] font-bold">
              {(['semua', 'selesai', 'batal'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  class={`px-2.5 py-1 rounded-lg transition-all cursor-pointer capitalize ${
                    statusFilter === st ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
                  }`}
                >
                  {st === 'semua' ? 'Semua Status' : st === 'selesai' ? 'Lunas' : 'Batal'}
                </button>
              ))}
            </div>

            {/* Metode Segmented */}
            <div class="flex bg-slate-100 p-0.5 rounded-xl text-[11px] font-bold">
              {(['semua', 'tunai', 'qris'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMetodeFilter(m)}
                  class={`px-2.5 py-1 rounded-lg transition-all cursor-pointer uppercase ${
                    metodeFilter === m ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
                  }`}
                >
                  {m === 'semua' ? 'Semua' : m}
                </button>
              ))}
            </div>

            {/* Input Pencarian */}
            <div class="flex-1 min-w-[180px]">
              <input
                type="search"
                placeholder="Cari antrean / nota / menu..."
                value={cari}
                onInput={(e) => setCari((e.target as HTMLInputElement).value)}
                class="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-slate-900"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── KONTEN UTAMA ── */}
      <div class="max-w-4xl mx-auto px-4 py-4 space-y-3.5">
        {/* Ringkasan Finansial: Pemisahan Jelas Omzet, Modal HPP, Laba Kotor, dan Estimasi Laba Bersih */}
        <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3">
          <div class="flex items-center justify-between border-b border-slate-100 pb-2">
            <span class="text-xs font-black uppercase tracking-wider text-slate-800">
              📊 Laporan Rekap Keuangan & Margin Toko
            </span>
            <span class="text-[11px] font-bold text-slate-500 font-mono">
              {totalLunas} Transaksi Lunas {totalBatal > 0 ? `· ${totalBatal} Dibatalkan` : ''}
            </span>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {/* 1. OMZET PENJUALAN */}
            <div class="bg-slate-900 text-white rounded-xl p-3 shadow-xs">
              <div class="flex items-center justify-between">
                <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">1. Total Omzet</span>
                <span class="text-[9px] px-1.5 py-0.2 bg-slate-800 text-slate-300 rounded">Kotor</span>
              </div>
              <span class="text-base font-black tracking-tight block mt-1 tabular-nums">
                {formatRupiah(totalOmzetLunas)}
              </span>
              <p class="text-[9px] text-slate-400 mt-0.5 leading-tight">
                Semua uang masuk kotor dari pembeli (Tunai: {formatRupiah(totalTunai)} · QRIS: {formatRupiah(totalQris)})
              </p>
            </div>

            {/* 2. MODAL / HPP BAHAN */}
            <div class="bg-amber-50/80 border border-amber-200/90 rounded-xl p-3">
              <div class="flex items-center justify-between">
                <span class="text-[10px] font-bold uppercase tracking-wider text-amber-800">2. Modal (HPP)</span>
                <span class="text-[9px] px-1.5 py-0.2 bg-amber-100 text-amber-900 rounded font-bold">Bahan</span>
              </div>
              <span class="text-base font-black text-amber-950 block mt-1 tabular-nums">
                -{formatRupiah(totalHppSemua)}
              </span>
              <p class="text-[9px] text-amber-700 mt-0.5 leading-tight">
                Total modal pokok bahan baku/porsi menu terjual
              </p>
            </div>

            {/* 3. LABA KOTOR */}
            <div class="bg-blue-50/80 border border-blue-200/90 rounded-xl p-3">
              <div class="flex items-center justify-between">
                <span class="text-[10px] font-bold uppercase tracking-wider text-blue-800">3. Laba Kotor</span>
                <span class="text-[9px] px-1.5 py-0.2 bg-blue-100 text-blue-900 rounded font-bold">
                  {totalOmzetLunas > 0 ? Math.round((totalLabaKotor / totalOmzetLunas) * 100) : 0}%
                </span>
              </div>
              <span class="text-base font-black text-blue-950 block mt-1 tabular-nums">
                +{formatRupiah(totalLabaKotor)}
              </span>
              <p class="text-[9px] text-blue-700 mt-0.5 leading-tight">
                Omzet dikurangi Modal Pokok Bahan
              </p>
            </div>

            {/* 4. LABA BERSIH REALISTIS */}
            <div class="bg-emerald-50/90 border border-emerald-300 rounded-xl p-3 shadow-2xs">
              <div class="flex items-center justify-between">
                <span class="text-[10px] font-bold uppercase tracking-wider text-emerald-800">4. Laba Bersih</span>
                <span class="text-[9px] px-1.5 py-0.2 bg-emerald-200 text-emerald-900 rounded font-black">Netto</span>
              </div>
              <span class="text-base font-black text-emerald-950 block mt-1 tabular-nums">
                +{formatRupiah(Math.max(0, totalLabaKotor - totalPengeluaranOperasional))}
              </span>
              <p class="text-[9px] text-emerald-800 mt-0.5 leading-tight">
                Laba Kotor - Biaya Operasional ({formatRupiah(totalPengeluaranOperasional)})
              </p>
            </div>
          </div>

          {/* Keterangan Rumus Transparan untuk User/Owner */}
          <div class="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 flex flex-wrap items-center justify-between gap-2">
            <div>
              <strong class="text-slate-800 font-bold">Rumus Laba Bersih: </strong>
              <span>Laba Kotor ({formatRupiah(totalLabaKotor)}) - Pengeluaran ({formatRupiah(totalPengeluaranOperasional)}) = </span>
              <strong class="text-emerald-700 font-black">
                Laba Bersih (+{formatRupiah(Math.max(0, totalLabaKotor - totalPengeluaranOperasional))})
              </strong>
            </div>
            <a
              href="#/pengeluaran-admin"
              class="text-indigo-600 hover:text-indigo-800 font-bold underline"
            >
              Lihat Rincian Pengeluaran →
            </a>
          </div>
        </div>

        {/* List Transaksi */}
        {loading ? (
          <div class="py-16 text-center text-slate-400 text-xs">
            <div class="w-5 h-5 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin mx-auto mb-2" />
            Memuat transaksi admin...
          </div>
        ) : pesananTersaring.length === 0 ? (
          <div class="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 text-xs">
            Tidak ada transaksi yang cocok dengan filter atau tanggal ini.
          </div>
        ) : (
          <div class="space-y-2.5">
            {pesananTersaring.map((item) => {
              const { pesanan, items, nomorAntrean, totalLaba, marginPersen } = item;
              const totalItem = items.reduce((s, it) => s + it.qty, 0);
              const isBatal = pesanan.status === 'batal';

              return (
                <div
                  key={pesanan.id}
                  onClick={() => bukaDetail(item)}
                  class={`bg-white rounded-2xl border p-3.5 shadow-2xs cursor-pointer hover:border-slate-400 transition-all ${
                    isBatal ? 'border-rose-200 bg-rose-50/20 opacity-80' : 'border-slate-200'
                  }`}
                >
                  <div class="flex items-start justify-between gap-2">
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-2 flex-wrap">
                        <span class="text-sm font-black text-slate-900">{nomorAntrean}</span>
                        {pesanan.kode_transaksi && (
                          <span class="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            {pesanan.kode_transaksi}
                          </span>
                        )}
                        <span
                          class={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                            isBatal
                              ? 'bg-rose-100 text-rose-800'
                              : pesanan.metode === 'qris'
                              ? 'bg-indigo-100 text-indigo-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {isBatal ? 'BATAL' : pesanan.metode.toUpperCase()}
                        </span>
                      </div>

                      <p class="text-[11px] text-slate-500 mt-1">
                        {totalItem} item ({items.map((it) => `${it.qty}x ${it.nama_produk}`).join(', ')})
                      </p>

                      <div class="flex items-center gap-2 text-[10px] text-slate-500 mt-1 flex-wrap">
                        <span>{formatWaktu(pesanan.waktu)}</span>
                        {!isBatal && (
                          <span class="text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            Laba Bersih: +{formatRupiah(totalLaba)} (Margin {marginPersen}%)
                          </span>
                        )}
                        {pesanan.catatan && <span>· "{pesanan.catatan}"</span>}
                        {isBatal && pesanan.alasan_batal && (
                          <span class="text-rose-600 font-bold">· Alasan: {pesanan.alasan_batal}</span>
                        )}
                      </div>
                    </div>

                    <div class="text-right shrink-0">
                      <span
                        class={`text-sm font-black tabular-nums block ${
                          isBatal ? 'text-slate-400 line-through' : 'text-slate-900'
                        }`}
                      >
                        {formatRupiah(pesanan.total)}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          bukaDetail(item);
                          setModeEdit(true);
                        }}
                        class="mt-1 text-[10px] font-bold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded-md border border-amber-200 transition-colors"
                      >
                        ✎ Edit Transaksi
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── MODAL DETAIL & EDIT TRANSAKSI OLEH ADMIN ── */}
      {pesananDipilih && !modalBatal && (
        <div class="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div class="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-5 max-h-[90vh] overflow-y-auto shadow-2xl space-y-4">
            {/* Header Modal */}
            <div class="flex items-start justify-between pb-2 border-b border-slate-100">
              <div>
                <div class="flex items-center gap-2">
                  <span class="text-[10px] font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded uppercase">
                    Admin Kontrol
                  </span>
                  <span class="text-xs font-bold text-slate-500 font-mono">
                    {pesananDipilih.pesanan.kode_transaksi || pesananDipilih.pesanan.id.slice(0, 8)}
                  </span>
                </div>
                <h3 class="text-base font-black text-slate-900 mt-1">
                  Antrean: {pesananDipilih.nomorAntrean}
                </h3>
              </div>

              <div class="flex items-center gap-1.5">
                {!modeEdit ? (
                  <button
                    type="button"
                    onClick={() => setModeEdit(true)}
                    class="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    ✎ Edit
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setModeEdit(false)}
                    class="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Batal Edit
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setPesananDipilih(null)}
                  class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer"
                >
                  <IconTutup size={14} />
                </button>
              </div>
            </div>

            {/* KARTU RINCIAN OMZET, MODAL HPP, DAN LABA BERSIH TRANSAKSI INI */}
            <div class="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2 text-xs">
              <span class="text-[10px] font-black uppercase text-slate-500 tracking-wider block">
                Rincian Margin & Laba Transaksi Ini:
              </span>
              <div class="grid grid-cols-3 gap-2 text-center">
                <div class="p-2 bg-white rounded-xl border border-slate-200">
                  <span class="text-[9px] font-bold text-slate-400 block uppercase">1. Omzet Nota</span>
                  <strong class="text-xs font-black text-slate-900 block mt-0.5 tabular-nums">
                    {formatRupiah(pesananDipilih.pesanan.total)}
                  </strong>
                </div>

                <div class="p-2 bg-amber-50 rounded-xl border border-amber-200">
                  <span class="text-[9px] font-bold text-amber-800 block uppercase">2. Modal (HPP)</span>
                  <strong class="text-xs font-black text-amber-950 block mt-0.5 tabular-nums">
                    -{formatRupiah(pesananDipilih.totalHpp)}
                  </strong>
                </div>

                <div class="p-2 bg-emerald-100/70 rounded-xl border border-emerald-300">
                  <span class="text-[9px] font-black text-emerald-800 block uppercase">3. Laba Bersih</span>
                  <strong class="text-xs font-black text-emerald-950 block mt-0.5 tabular-nums">
                    +{formatRupiah(pesananDipilih.totalLaba)}
                  </strong>
                  <span class="text-[9px] font-bold text-emerald-700 block">
                    Margin {pesananDipilih.marginPersen}%
                  </span>
                </div>
              </div>
            </div>

            {/* FORM EDIT MODE vs VIEW MODE */}
            {!modeEdit ? (
              /* ── TAMPILAN DETAIL (VIEW) ── */
              <div class="space-y-3.5">
                <div class="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-2xl">
                  <div>
                    <span class="text-[10px] text-slate-400 block uppercase">Waktu Pembelian</span>
                    <strong class="text-slate-800">{formatTanggalWaktu(pesananDipilih.pesanan.waktu)}</strong>
                  </div>
                  <div>
                    <span class="text-[10px] text-slate-400 block uppercase">Metode & Status</span>
                    <strong class="text-slate-800 uppercase">
                      {pesananDipilih.pesanan.metode} · {pesananDipilih.pesanan.status}
                    </strong>
                  </div>
                  {pesananDipilih.pesanan.catatan && (
                    <div class="col-span-2 pt-1 border-t border-slate-200">
                      <span class="text-[10px] text-slate-400 block uppercase">Catatan Pesanan</span>
                      <p class="text-slate-800 font-medium">{pesananDipilih.pesanan.catatan}</p>
                    </div>
                  )}
                </div>

                {/* Item List */}
                <div class="border-t border-slate-100 pt-2 space-y-2 text-xs">
                  <span class="text-[10px] font-black uppercase text-slate-400 block">Item Menu</span>
                  {pesananDipilih.items.map((it) => {
                    const totalTambahan = it.tambahan.reduce((s, t) => s + t.harga * t.qty, 0);
                    const subtotal = (it.harga_satuan + totalTambahan) * it.qty;
                    return (
                      <div key={it.id} class="flex justify-between items-start">
                        <div>
                          <span class="font-bold text-slate-900">{it.qty}x {it.nama_produk}</span>
                          {it.tambahan.map((t) => (
                            <span key={t.nama} class="block text-[10px] text-slate-500 pl-3">
                              + {t.nama} ({formatRupiah(t.harga)})
                            </span>
                          ))}
                        </div>
                        <span class="font-bold tabular-nums text-slate-900">{formatRupiah(subtotal)}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Total */}
                <div class="border-t border-slate-100 pt-2.5 space-y-1 text-xs">
                  <div class="flex justify-between text-slate-600">
                    <span>Total Tagihan:</span>
                    <strong class="text-sm font-black text-slate-900 tabular-nums">
                      {formatRupiah(pesananDipilih.pesanan.total)}
                    </strong>
                  </div>
                  <div class="flex justify-between text-slate-500">
                    <span>Uang Diterima:</span>
                    <span class="tabular-nums">{formatRupiah(pesananDipilih.pesanan.bayar)}</span>
                  </div>
                  <div class="flex justify-between text-emerald-700 font-bold">
                    <span>Kembalian:</span>
                    <span class="tabular-nums">{formatRupiah(pesananDipilih.pesanan.kembalian)}</span>
                  </div>
                </div>

                {pesananDipilih.pesanan.status === 'batal' && (
                  <div class="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                    <strong>Pesanan Dibatalkan</strong>
                    <p class="mt-0.5">Alasan: {pesananDipilih.pesanan.alasan_batal || '-'}</p>
                  </div>
                )}

                {/* Tombol Aksi */}
                <div class="grid grid-cols-2 gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleCetak}
                    class="py-2.5 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <IconPrinter size={15} />
                    <span>Cetak Struk</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleBagikan}
                    class="py-2.5 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <IconShare size={15} />
                    <span>Bagikan Nota</span>
                  </button>
                </div>

                {/* Tombol Batalkan / Hapus untuk Admin */}
                <div class="space-y-2 pt-1 border-t border-slate-100">
                  {pesananDipilih.pesanan.status === 'selesai' && (
                    <button
                      type="button"
                      onClick={() => setModalBatal(true)}
                      class="w-full py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold rounded-xl text-xs transition-colors cursor-pointer border border-amber-200"
                    >
                      Batalkan Transaksi Ini (Tandai Status Batal)
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setKonfirmasiHapusTeks('');
                      setModalHapus(true);
                    }}
                    class="w-full py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-xs transition-colors cursor-pointer border border-rose-200 flex items-center justify-center gap-1.5"
                  >
                    <span>🗑️ Hapus Transaksi Ini Secara Permanen</span>
                  </button>
                </div>
              </div>
            ) : (
              /* ── FORM EDIT TRANSAKSI OLEH ADMIN ── */
              <form onSubmit={handleSimpanEditAdmin} class="space-y-4">
                <div class="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-3 text-xs text-amber-950">
                  <strong class="block mb-0.5">Mode Koreksi Data Admin:</strong>
                  Ubah metode pembayaran (mis. dari Tunai ke QRIS atau sebaliknya), kuantitas menu, status, atau catatan. Perubahan akan otomatis disinkronkan ke cloud.
                </div>

                {/* 1. Ubah Metode Pembayaran */}
                <div>
                  <label class="block text-xs font-bold text-slate-800 mb-1.5">
                    1. Metode Pembayaran:
                  </label>
                  <div class="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setEditMetode('tunai')}
                      class={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        editMetode === 'tunai'
                          ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      💵 TUNAI (Cash)
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditMetode('qris')}
                      class={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        editMetode === 'qris'
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      📱 QRIS Dinamis
                    </button>
                  </div>
                </div>

                {/* 2. Ubah Status Transaksi */}
                <div>
                  <label class="block text-xs font-bold text-slate-800 mb-1.5">
                    2. Status Transaksi:
                  </label>
                  <div class="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setEditStatus('selesai')}
                      class={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        editStatus === 'selesai'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      ✓ LUNAS (Selesai)
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditStatus('batal')}
                      class={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        editStatus === 'batal'
                          ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      ✕ DIBATALKAN
                    </button>
                  </div>
                  {editStatus === 'batal' && (
                    <input
                      type="text"
                      placeholder="Masukkan alasan pembatalan..."
                      value={editAlasanBatal}
                      onInput={(e) => setEditAlasanBatal((e.target as HTMLInputElement).value)}
                      class="w-full mt-2 px-3 py-2 bg-slate-50 border border-rose-200 rounded-xl text-xs text-rose-900 focus:outline-hidden"
                    />
                  )}
                </div>

                {/* 3. Koreksi Kuantitas Item Menu */}
                <div>
                  <label class="block text-xs font-bold text-slate-800 mb-1.5">
                    3. Kuantitas Menu Pesanan:
                  </label>
                  <div class="space-y-2 border border-slate-200 rounded-2xl p-2.5 bg-slate-50/50">
                    {editItems.map((it, idx) => {
                      const totTambahan = it.tambahan.reduce((s, x) => s + x.harga * x.qty, 0);
                      const subtotal = (it.harga_satuan + totTambahan) * it.qty;
                      return (
                        <div key={it.id} class="flex items-center justify-between p-2 bg-white rounded-xl border border-slate-100 text-xs">
                          <div class="min-w-0 flex-1 pr-2">
                            <span class="font-bold text-slate-900 block truncate">{it.nama_produk}</span>
                            <span class="text-[10px] text-slate-400 font-mono">{formatRupiah(it.harga_satuan)}</span>
                          </div>

                          <div class="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => ubahQtyEditItem(idx, -1)}
                              class="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold cursor-pointer"
                            >
                              -
                            </button>
                            <span class="font-bold font-mono w-5 text-center text-xs">{it.qty}</span>
                            <button
                              type="button"
                              onClick={() => ubahQtyEditItem(idx, 1)}
                              class="w-6 h-6 rounded-lg bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center font-bold cursor-pointer"
                            >
                              +
                            </button>
                            <span class="font-bold font-mono text-slate-900 w-24 text-right tabular-nums">
                              {formatRupiah(subtotal)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 4. Total Kalkulasi Baru & Uang Diterima */}
                <div class="p-3 bg-slate-100 rounded-2xl space-y-2 text-xs">
                  <div class="flex justify-between items-center font-bold text-slate-700">
                    <span>Total Tagihan Baru:</span>
                    <strong class="text-base font-black text-slate-900 tabular-nums font-mono">
                      {formatRupiah(hitungTotalEdit())}
                    </strong>
                  </div>

                  {editMetode === 'tunai' && (
                    <div>
                      <label class="block text-[11px] font-bold text-slate-600 mb-1">
                        Uang Tunai Fisik Diterima Kasir:
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={1000}
                        value={editBayar}
                        onInput={(e) => setEditBayar(Number((e.target as HTMLInputElement).value) || 0)}
                        class="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold font-mono text-slate-900 text-sm tabular-nums"
                      />
                      <div class="flex justify-between text-[11px] font-semibold text-emerald-800 mt-1">
                        <span>Kembalian:</span>
                        <span class="font-bold">{formatRupiah(Math.max(0, editBayar - hitungTotalEdit()))}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 5. Catatan Tambahan */}
                <div>
                  <label class="block text-[11px] font-bold text-slate-700 mb-1">
                    Catatan Transaksi:
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Koreksi pembayaran dari QRIS ke Tunai"
                    value={editCatatan}
                    onInput={(e) => setEditCatatan((e.target as HTMLInputElement).value)}
                    class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden"
                  />
                </div>

                {/* Tombol Simpan Perubahan */}
                <button
                  type="submit"
                  class="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black tracking-wide transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  <IconCheck size={16} color="#22c55e" />
                  <span>Simpan Perubahan Transaksi Ini</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL KONFIRMASI BATAL CEPAT ── */}
      {modalBatal && pesananDipilih && (
        <div class="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center z-60 p-4">
          <div class="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl space-y-3">
            <h3 class="text-sm font-black text-slate-900">
              Batalkan Pesanan {pesananDipilih.nomorAntrean}?
            </h3>
            <p class="text-xs text-slate-500">
              Masukkan alasan resmi pembatalan pesanan untuk pencatatan log audit toko:
            </p>

            {errorBatal && (
              <div class="p-2 bg-rose-50 text-rose-700 text-xs rounded-xl font-bold">
                {errorBatal}
              </div>
            )}

            <form onSubmit={handleBatalkanCepat} class="space-y-3">
              <textarea
                required
                rows={3}
                placeholder="Contoh: Pelanggan membatalkan pesanan sebelum dibuat"
                value={alasanBatalCepat}
                onInput={(e) => setAlasanBatalCepat((e.target as HTMLTextAreaElement).value)}
                class="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-slate-900"
                autoFocus
              />

              <div class="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setModalBatal(false);
                    setErrorBatal('');
                  }}
                  class="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 cursor-pointer"
                >
                  Kembali
                </button>
                <button
                  type="submit"
                  class="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
                >
                  Konfirmasi Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ── MODAL KONFIRMASI HAPUS PERMANEN OLEH ADMIN ── */}
      {modalHapus && pesananDipilih && (
        <div class="fixed inset-0 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center z-70 p-4">
          <div class="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl space-y-3.5 border border-rose-100 animate-in fade-in zoom-in-95">
            <div class="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto text-lg">
              ⚠️
            </div>

            <div class="text-center">
              <h3 class="text-sm font-black text-slate-900">
                Hapus Transaksi Permanen?
              </h3>
              <p class="text-xs text-slate-500 mt-1 leading-relaxed">
                Anda akan menghapus nota <strong>{pesananDipilih.nomorAntrean}</strong> ({pesananDipilih.pesanan.kode_transaksi || pesananDipilih.pesanan.id.slice(0, 8)}) senilai <strong>{formatRupiah(pesananDipilih.pesanan.total)}</strong>. Data ini akan dihapus dari riwayat toko dan cloud Supabase.
              </p>
            </div>

            <div class="bg-rose-50 border border-rose-200/80 rounded-xl p-2.5 text-[11px] text-rose-900">
              *Tindakan ini tidak dapat dibatalkan. Gunakan jika transaksi salah input fatal, double nota, atau data uji coba.
            </div>

            <div class="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setModalHapus(false)}
                class="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleHapusPermanen}
                class="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black tracking-wide shadow-md cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>Ya, Hapus Permanen</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
