import { useState, useEffect } from 'preact/hooks';
import { type PengeluaranItem, type OutletItem } from '../../data/db.js';
import {
  muatPengeluaran,
  simpanPengeluaran,
  hapusPengeluaran,
  KATEGORI_PENGELUARAN,
} from '../../data/pengeluaran.js';
import { formatRupiah } from '../../util/rupiah.js';
import { getTanggalLokal } from '../../data/outbox.js';
import { muatSemuaOutlet } from '../../data/outlet.js';
import { formatTanggalPanjang, formatWaktu } from '../../util/tanggal.js';
import { IconCheck, IconTutup, IconPlus } from '../../komponen/Icon.js';

export function LayarPengeluaranAdmin() {
  const [daftarPengeluaran, setDaftarPengeluaran] = useState<PengeluaranItem[]>([]);
  const [tanggal, setTanggal] = useState<string>(getTanggalLokal());
  const [outletPilih, setOutletPilih] = useState<string>('semua');
  const [kategoriFilter, setKategoriFilter] = useState<string>('semua');
  const [metodeFilter, setMetodeFilter] = useState<'semua' | 'tunai' | 'transfer'>('semua');
  const [cari, setCari] = useState('');
  const [loading, setLoading] = useState(true);
  const [pesanNotif, setPesanNotif] = useState('');
  const [daftarOutlet, setDaftarOutlet] = useState<OutletItem[]>([]);

  // Form Input Modal Pengeluaran Admin
  const [bukaForm, setBukaForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formTanggal, setFormTanggal] = useState<string>(getTanggalLokal());
  const [formOutletId, setFormOutletId] = useState<string>('');
  const [kategori, setKategori] = useState<string>(KATEGORI_PENGELUARAN[0]);
  const [keterangan, setKeterangan] = useState('');
  const [nominal, setNominal] = useState<number>(0);
  const [metode, setMetode] = useState<'tunai' | 'transfer'>('tunai');

  const notifikasi = (teks: string) => {
    setPesanNotif(teks);
    setTimeout(() => setPesanNotif(''), 3500);
  };

  useEffect(() => {
    muatSemuaOutlet().then(setDaftarOutlet).catch(() => {});
  }, []);

  const muat = async () => {
    setLoading(true);
    try {
      const data = await muatPengeluaran(tanggal, outletPilih);
      setDaftarPengeluaran(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    muat();
  }, [tanggal, outletPilih]);

  const bukaTambahBaru = () => {
    setEditId(null);
    setFormTanggal(tanggal);
    setFormOutletId(outletPilih !== 'semua' ? outletPilih : (daftarOutlet[0]?.id || ''));
    setKategori(KATEGORI_PENGELUARAN[0]);
    setKeterangan('');
    setNominal(0);
    setMetode('tunai');
    setBukaForm(true);
  };

  const bukaEdit = (item: PengeluaranItem) => {
    setEditId(item.id);
    setFormTanggal(item.tanggal);
    setFormOutletId(item.outlet_id || (daftarOutlet[0]?.id || ''));
    setKategori(item.kategori);
    setKeterangan(item.keterangan);
    setNominal(item.nominal);
    setMetode(item.metode);
    setBukaForm(true);
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (nominal <= 0) {
      alert('Nominal pengeluaran harus lebih besar dari 0');
      return;
    }
    if (!keterangan.trim()) {
      alert('Keterangan pengeluaran wajib diisi');
      return;
    }

    const ot = daftarOutlet.find((o) => o.id === formOutletId);

    try {
      await simpanPengeluaran({
        id: editId || undefined,
        tanggal: formTanggal,
        kategori,
        keterangan,
        nominal,
        metode,
        outlet_id: formOutletId || null,
        outlet_nama: ot?.nama || 'Cabang Utama',
      });

      notifikasi(`Catatan pengeluaran ${formatRupiah(nominal)} berhasil disimpan.`);
      setBukaForm(false);
      await muat();
    } catch (err: any) {
      alert('Gagal menyimpan pengeluaran: ' + err.message);
    }
  };

  const handleHapus = async (id: string, ket: string) => {
    if (confirm(`Hapus permanen pengeluaran "${ket}"?`)) {
      await hapusPengeluaran(id);
      notifikasi('Pengeluaran berhasil dihapus permanen oleh Admin.');
      await muat();
    }
  };

  // Filter di client
  const tersaring = daftarPengeluaran.filter((p) => {
    if (kategoriFilter !== 'semua' && p.kategori !== kategoriFilter) return false;
    if (metodeFilter !== 'semua' && p.metode !== metodeFilter) return false;
    if (cari.trim()) {
      const k = cari.toLowerCase();
      return (
        p.keterangan.toLowerCase().includes(k) ||
        p.kategori.toLowerCase().includes(k) ||
        (p.kasir_nama || '').toLowerCase().includes(k)
      );
    }
    return true;
  });

  const totalPengeluaran = tersaring.reduce((s, p) => s + (p.nominal || 0), 0);
  const totalTunai = tersaring.filter((p) => p.metode === 'tunai').reduce((s, p) => s + p.nominal, 0);
  const totalTransfer = tersaring.filter((p) => p.metode === 'transfer').reduce((s, p) => s + p.nominal, 0);

  return (
    <div class="min-h-screen bg-slate-50 pb-28 text-slate-900">
      {/* Toast Notifikasi */}
      {pesanNotif && (
        <div class="fixed top-14 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-4 py-2.5 rounded-full text-xs font-semibold z-50 shadow-xl flex items-center gap-2">
          <IconCheck size={14} color="#22c55e" />
          <span>{pesanNotif}</span>
        </div>
      )}

      {/* Header Sticky Admin */}
      <div class="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-2xs">
        <div class="max-w-4xl mx-auto px-4 py-3.5">
          <div class="flex items-center justify-between gap-3">
            <div>
              <div class="flex items-center gap-2">
                <span class="px-2 py-0.5 rounded-md bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider">
                  ADMIN
                </span>
                <h1 class="text-base font-black text-slate-900 tracking-tight leading-tight">
                  Pengeluaran Toko (Admin)
                </h1>
              </div>
              <p class="text-[11px] text-slate-500 mt-0.5">
                Kelola, audit, dan rekap seluruh biaya operasional cabang toko
              </p>
            </div>

            <button
              type="button"
              onClick={bukaTambahBaru}
              class="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
            >
              <IconPlus size={14} />
              <span>+ Catat Biaya</span>
            </button>
          </div>

          {/* Baris Filter: Tanggal + Outlet */}
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
            <div>
              <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                Tanggal Biaya:
              </label>
              <input
                type="date"
                value={tanggal}
                onChange={(e) => setTanggal((e.target as HTMLInputElement).value)}
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

          {/* Baris Filter: Kategori, Metode, Cari */}
          <div class="flex flex-wrap items-center gap-2 mt-2.5">
            <select
              value={kategoriFilter}
              onChange={(e) => setKategoriFilter((e.target as HTMLSelectElement).value)}
              class="px-2.5 py-1.5 bg-slate-100 rounded-xl text-xs font-bold text-slate-700 border-none focus:outline-hidden"
            >
              <option value="semua">Semua Kategori Biaya</option>
              {KATEGORI_PENGELUARAN.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>

            <div class="flex bg-slate-100 p-0.5 rounded-xl text-[11px] font-bold">
              {(['semua', 'tunai', 'transfer'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMetodeFilter(m)}
                  class={`px-2.5 py-1 rounded-lg transition-all cursor-pointer capitalize ${
                    metodeFilter === m ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
                  }`}
                >
                  {m === 'semua' ? 'Semua Metode' : m}
                </button>
              ))}
            </div>

            <div class="flex-1 min-w-[170px]">
              <input
                type="search"
                placeholder="Cari keterangan biaya..."
                value={cari}
                onInput={(e) => setCari((e.target as HTMLInputElement).value)}
                class="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-slate-900"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Konten Halaman */}
      <div class="max-w-4xl mx-auto px-4 py-4 space-y-3.5">
        {/* Ringkasan Finansial Pengeluaran */}
        <div class="grid grid-cols-3 gap-2 text-center">
          <div class="bg-rose-50 border border-rose-200/90 rounded-2xl p-3 shadow-2xs">
            <span class="text-[10px] font-bold uppercase text-rose-800 block">Total Pengeluaran</span>
            <span class="text-sm sm:text-base font-black text-rose-950 block mt-0.5 tabular-nums">
              {formatRupiah(totalPengeluaran)}
            </span>
            <span class="text-[9px] text-rose-600 block mt-0.5">{tersaring.length} item pengeluaran</span>
          </div>

          <div class="bg-white border border-slate-200 rounded-2xl p-3 shadow-2xs">
            <span class="text-[10px] font-bold uppercase text-slate-500 block">Tunai (Kas Laci)</span>
            <span class="text-xs sm:text-sm font-black text-slate-900 block mt-0.5 tabular-nums">
              {formatRupiah(totalTunai)}
            </span>
            <span class="text-[9px] text-slate-400 block mt-0.5">Memotong uang fisik laci</span>
          </div>

          <div class="bg-white border border-slate-200 rounded-2xl p-3 shadow-2xs">
            <span class="text-[10px] font-bold uppercase text-slate-500 block">Transfer / Rekening</span>
            <span class="text-xs sm:text-sm font-black text-slate-900 block mt-0.5 tabular-nums">
              {formatRupiah(totalTransfer)}
            </span>
            <span class="text-[9px] text-slate-400 block mt-0.5">Non-tunai rekening</span>
          </div>
        </div>

        {/* List Pengeluaran */}
        {loading ? (
          <div class="py-16 text-center text-slate-400 text-xs">
            <div class="w-5 h-5 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin mx-auto mb-2" />
            Memuat pengeluaran admin...
          </div>
        ) : tersaring.length === 0 ? (
          <div class="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 text-xs shadow-2xs">
            Tidak ada pengeluaran pada tanggal/filter ini.
          </div>
        ) : (
          <div class="space-y-2">
            {tersaring.map((p) => (
              <div
                key={p.id}
                class="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-2xs flex items-center justify-between gap-3"
              >
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-[10px] font-black px-2 py-0.5 rounded-md bg-rose-100 text-rose-800">
                      {p.kategori}
                    </span>
                    <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 uppercase">
                      {p.metode}
                    </span>
                    {p.outlet_nama && (
                      <span class="text-[10px] text-slate-500 font-medium">
                        · {p.outlet_nama}
                      </span>
                    )}
                  </div>

                  <h3 class="text-xs font-black text-slate-900 mt-1 leading-snug">
                    {p.keterangan}
                  </h3>

                  <p class="text-[10px] text-slate-400 mt-0.5">
                    {formatWaktu(p.waktu)} · Dicatat oleh: {p.kasir_nama || 'Petugas'}
                  </p>
                </div>

                <div class="text-right shrink-0">
                  <span class="text-sm font-black text-rose-700 block tabular-nums">
                    -{formatRupiah(p.nominal)}
                  </span>
                  <div class="flex items-center gap-2 mt-1 justify-end">
                    <button
                      type="button"
                      onClick={() => bukaEdit(p)}
                      class="text-[10px] text-amber-700 hover:underline font-bold cursor-pointer"
                    >
                      Edit
                    </button>
                    <span class="text-slate-300 text-[10px]">|</span>
                    <button
                      type="button"
                      onClick={() => handleHapus(p.id, p.keterangan)}
                      class="text-[10px] text-rose-600 hover:underline font-bold cursor-pointer"
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Form Tambah/Edit Pengeluaran Admin */}
      {bukaForm && (
        <div class="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div class="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 max-h-[90vh] overflow-y-auto shadow-2xl space-y-3.5">
            <div class="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 class="text-sm font-black text-slate-900">
                {editId ? 'Edit Catatan Pengeluaran (Admin)' : 'Catat Pengeluaran Toko (Admin)'}
              </h3>
              <button
                type="button"
                onClick={() => setBukaForm(false)}
                class="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 cursor-pointer"
              >
                <IconTutup size={14} />
              </button>
            </div>

            <form onSubmit={handleSubmit} class="space-y-3 text-xs">
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="block text-[11px] font-bold text-slate-700 mb-1">
                    Tanggal:
                  </label>
                  <input
                    type="date"
                    required
                    value={formTanggal}
                    onChange={(e) => setFormTanggal((e.target as HTMLInputElement).value)}
                    class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
                  />
                </div>

                <div>
                  <label class="block text-[11px] font-bold text-slate-700 mb-1">
                    Cabang Toko:
                  </label>
                  <select
                    value={formOutletId}
                    onChange={(e) => setFormOutletId((e.target as HTMLSelectElement).value)}
                    class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
                  >
                    {daftarOutlet.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.nama}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label class="block text-[11px] font-bold text-slate-700 mb-1">
                  Kategori Biaya:
                </label>
                <select
                  value={kategori}
                  onChange={(e) => setKategori((e.target as HTMLSelectElement).value)}
                  class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-hidden"
                >
                  {KATEGORI_PENGELUARAN.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label class="block text-[11px] font-bold text-slate-700 mb-1">
                  Nominal Pengeluaran:
                </label>
                <div class="relative">
                  <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">Rp</span>
                  <input
                    type="number"
                    min={1000}
                    step={1000}
                    required
                    placeholder="Contoh: 50000"
                    value={nominal || ''}
                    onInput={(e) => setNominal(Number((e.target as HTMLInputElement).value) || 0)}
                    class="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-extrabold text-slate-900 tabular-nums focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label class="block text-[11px] font-bold text-slate-700 mb-1">
                  Metode Pembayaran Biaya:
                </label>
                <div class="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMetode('tunai')}
                    class={`py-2 px-3 rounded-xl font-bold border transition-all cursor-pointer ${
                      metode === 'tunai'
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    💵 Tunai (Kas Laci)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMetode('transfer')}
                    class={`py-2 px-3 rounded-xl font-bold border transition-all cursor-pointer ${
                      metode === 'transfer'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    💳 Transfer / Rekening
                  </button>
                </div>
              </div>

              <div>
                <label class="block text-[11px] font-bold text-slate-700 mb-1">
                  Keterangan / Keperluan:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Beli bumbu dapur, gas lpg, plastik bungkus"
                  value={keterangan}
                  onInput={(e) => setKeterangan((e.target as HTMLInputElement).value)}
                  class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-hidden"
                />
              </div>

              <button
                type="submit"
                class="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition-all shadow-md mt-2 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <IconCheck size={16} color="#22c55e" />
                <span>{editId ? 'Simpan Perubahan' : 'Catat Pengeluaran'}</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
