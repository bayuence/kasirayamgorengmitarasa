import { useState, useEffect } from 'preact/hooks';
import { type PengeluaranItem } from '../../data/db.js';
import {
  muatPengeluaran,
  simpanPengeluaran,
  hapusPengeluaran,
  KATEGORI_PENGELUARAN,
} from '../../data/pengeluaran.js';
import { formatRupiah } from '../../util/rupiah.js';
import { getTanggalLokal } from '../../data/outbox.js';
import { outletAktifSignal } from '../../data/outlet.js';
import { sessionSignal } from '../../state/sesi.js';
import { formatTanggalPanjang, formatWaktu } from '../../util/tanggal.js';
import { IconCheck, IconTutup, IconPlus } from '../../komponen/Icon.js';

export function LayarPengeluaran() {
  const [daftarPengeluaran, setDaftarPengeluaran] = useState<PengeluaranItem[]>([]);
  const [tanggal, setTanggal] = useState<string>(getTanggalLokal());
  const [loading, setLoading] = useState(true);
  const [pesanNotif, setPesanNotif] = useState('');

  // Form Input Modal Pengeluaran
  const [bukaForm, setBukaForm] = useState(false);
  const [kategori, setKategori] = useState<string>(KATEGORI_PENGELUARAN[0]);
  const [keterangan, setKeterangan] = useState('');
  const [nominal, setNominal] = useState<number>(0);
  const [metode, setMetode] = useState<'tunai' | 'transfer'>('tunai');

  const outlet = outletAktifSignal.value;

  const notifikasi = (teks: string) => {
    setPesanNotif(teks);
    setTimeout(() => setPesanNotif(''), 3500);
  };

  const muat = async () => {
    setLoading(true);
    try {
      const data = await muatPengeluaran(tanggal, outlet?.id || null);
      setDaftarPengeluaran(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    muat();
  }, [tanggal, outlet?.id]);

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

    try {
      await simpanPengeluaran({
        tanggal,
        kategori,
        keterangan,
        nominal,
        metode,
        outlet_id: outlet?.id || null,
        outlet_nama: outlet?.nama || 'Cabang Utama',
      });

      notifikasi(`Pengeluaran ${formatRupiah(nominal)} berhasil dicatat!`);
      setBukaForm(false);
      setKeterangan('');
      setNominal(0);
      await muat();
    } catch (err: any) {
      alert('Gagal mencatat pengeluaran: ' + err.message);
    }
  };

  const handleHapus = async (id: string, ket: string) => {
    if (confirm(`Hapus catatan pengeluaran "${ket}"?`)) {
      await hapusPengeluaran(id);
      notifikasi('Catatan pengeluaran berhasil dihapus.');
      await muat();
    }
  };

  const totalPengeluaran = daftarPengeluaran.reduce((s, p) => s + (p.nominal || 0), 0);
  const totalTunai = daftarPengeluaran.filter((p) => p.metode === 'tunai').reduce((s, p) => s + p.nominal, 0);
  const totalTransfer = daftarPengeluaran.filter((p) => p.metode === 'transfer').reduce((s, p) => s + p.nominal, 0);

  return (
    <div class="min-h-screen bg-slate-50 pb-28 text-slate-900">
      {/* Toast Notifikasi */}
      {pesanNotif && (
        <div class="fixed top-14 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-4 py-2.5 rounded-full text-xs font-semibold z-50 shadow-xl flex items-center gap-2">
          <IconCheck size={14} color="#22c55e" />
          <span>{pesanNotif}</span>
        </div>
      )}

      {/* Header Sticky */}
      <div class="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-2xs">
        <div class="max-w-2xl mx-auto px-4 py-3.5">
          <div class="flex items-center justify-between gap-2">
            <div>
              <span class="text-[10px] font-black text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded uppercase">
                Operasional Harian
              </span>
              <h1 class="text-base font-black text-slate-900 tracking-tight leading-tight mt-1">
                Pengeluaran Toko
              </h1>
              <p class="text-[11px] text-slate-500 truncate max-w-[220px]">
                {outlet?.nama || 'Semua Cabang'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setBukaForm(true)}
              class="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
            >
              <IconPlus size={14} />
              <span>Catat Pengeluaran</span>
            </button>
          </div>

          {/* Navigator Tanggal */}
          <div class="mt-3 flex items-center gap-2">
            <input
              type="date"
              value={tanggal}
              max={getTanggalLokal()}
              onChange={(e) => setTanggal((e.target as HTMLInputElement).value)}
              class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-slate-900 cursor-pointer"
            />
            {tanggal !== getTanggalLokal() && (
              <button
                type="button"
                onClick={() => setTanggal(getTanggalLokal())}
                class="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer"
              >
                Hari Ini
              </button>
            )}
          </div>
          <span class="text-[11px] font-bold text-slate-500 block text-center mt-1.5">
            {formatTanggalPanjang(tanggal)}
          </span>
        </div>
      </div>

      {/* Konten Halaman */}
      <div class="max-w-2xl mx-auto px-4 py-4 space-y-3.5">
        {/* Ringkasan Pengeluaran Hari Ini */}
        <div class="grid grid-cols-3 gap-2 text-center">
          <div class="bg-rose-50 border border-rose-200/90 rounded-2xl p-3 shadow-2xs">
            <span class="text-[10px] font-bold uppercase text-rose-800 block">Total Pengeluaran</span>
            <span class="text-sm sm:text-base font-black text-rose-950 block mt-0.5 tabular-nums">
              {formatRupiah(totalPengeluaran)}
            </span>
            <span class="text-[9px] text-rose-600 block mt-0.5">{daftarPengeluaran.length} transaksi</span>
          </div>

          <div class="bg-white border border-slate-200 rounded-2xl p-3 shadow-2xs">
            <span class="text-[10px] font-bold uppercase text-slate-500 block">Kas Tunai Laci</span>
            <span class="text-xs sm:text-sm font-black text-slate-900 block mt-0.5 tabular-nums">
              {formatRupiah(totalTunai)}
            </span>
            <span class="text-[9px] text-slate-400 block mt-0.5">Potong uang laci</span>
          </div>

          <div class="bg-white border border-slate-200 rounded-2xl p-3 shadow-2xs">
            <span class="text-[10px] font-bold uppercase text-slate-500 block">Transfer / Non-Tunai</span>
            <span class="text-xs sm:text-sm font-black text-slate-900 block mt-0.5 tabular-nums">
              {formatRupiah(totalTransfer)}
            </span>
            <span class="text-[9px] text-slate-400 block mt-0.5">Via rekening/QRIS</span>
          </div>
        </div>

        {/* List Riwayat Pengeluaran */}
        {loading ? (
          <div class="py-16 text-center text-slate-400 text-xs">
            <div class="w-5 h-5 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin mx-auto mb-2" />
            Memuat pengeluaran...
          </div>
        ) : daftarPengeluaran.length === 0 ? (
          <div class="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 text-xs shadow-2xs">
            Belum ada pengeluaran yang dicatat untuk tanggal ini.
          </div>
        ) : (
          <div class="space-y-2">
            {daftarPengeluaran.map((p) => (
              <div
                key={p.id}
                class="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-2xs flex items-center justify-between gap-3"
              >
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-rose-100 text-rose-800">
                      {p.kategori}
                    </span>
                    <span class="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 uppercase">
                      {p.metode}
                    </span>
                  </div>

                  <h3 class="text-xs font-black text-slate-900 mt-1 leading-snug">
                    {p.keterangan}
                  </h3>

                  <p class="text-[10px] text-slate-400 mt-0.5">
                    {formatWaktu(p.waktu)} · Dicatat oleh: {p.kasir_nama || 'Kasir'}
                  </p>
                </div>

                <div class="text-right shrink-0">
                  <span class="text-sm font-black text-rose-700 block tabular-nums">
                    -{formatRupiah(p.nominal)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleHapus(p.id, p.keterangan)}
                    class="text-[10px] text-slate-400 hover:text-rose-700 mt-1 block ml-auto font-bold cursor-pointer"
                  >
                    Hapus
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── MODAL FORM CATAT PENGELUARAN ── */}
      {bukaForm && (
        <div class="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div class="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 max-h-[90vh] overflow-y-auto shadow-2xl space-y-3.5">
            <div class="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 class="text-sm font-black text-slate-900">
                Catat Pengeluaran Toko
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
                    placeholder="Contoh: 25000"
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
                    💳 Transfer / Non-Tunai
                  </button>
                </div>
                <p class="text-[10px] text-slate-400 mt-1">
                  *Pilih Tunai jika diambil langsung dari laci kasir, atau Transfer jika ditransfer langsung.
                </p>
              </div>

              <div>
                <label class="block text-[11px] font-bold text-slate-700 mb-1">
                  Rincian / Keterangan Keperluan:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Beli minyak goreng 2 liter & isi gas 3kg"
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
                <span>Simpan Pengeluaran</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
