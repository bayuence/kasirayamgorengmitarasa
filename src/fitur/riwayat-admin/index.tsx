import { useState, useEffect } from 'preact/hooks';
import { getLocalDB, type PesananItem, type ItemPesananDetail, type OutletItem } from '../../data/db.js';
import { getTanggalLokal, formatNomorAntrean, batalkanPesananLokal } from '../../data/outbox.js';
import { formatRupiah } from '../../util/rupiah.js';
import { formatTeksStruk, bagikanStruk } from '../../util/struk.js';
import { sessionSignal } from '../../state/sesi.js';
import { muatSemuaOutlet, outletAktifSignal } from '../../data/outlet.js';
import {
  formatTanggalPanjang,
  formatTanggalAngka,
  formatWaktu,
  formatTanggalWaktu,
  formatStrukWaktu,
} from '../../util/tanggal.js';
import {
  IconCari,
  IconToko,
  IconCheck,
  IconTutup,
  IconPrinter,
  IconShare,
} from '../../komponen/Icon.js';

interface PesananDenganItem {
  pesanan: PesananItem;
  items: ItemPesananDetail[];
  nomorAntrean: string;
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

  const [pesananDipilih, setPesananDipilih] = useState<PesananDenganItem | null>(null);
  const [modalBatal, setModalBatal] = useState(false);
  const [alasanBatal, setAlasanBatal] = useState('');
  const [errorBatal, setErrorBatal] = useState('');
  const [notifSalin, setNotifSalin] = useState('');

  // Muat daftar outlet untuk filter admin
  useEffect(() => {
    muatSemuaOutlet().then(setDaftarOutlet).catch(() => {});
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

    // Filter berdasarkan Outlet (jika dipilih)
    if (outletPilih !== 'semua') {
      pesananData = pesananData.filter((p) => p.outlet_id === outletPilih);
    }

    // Filter status
    if (statusFilter !== 'semua') {
      pesananData = pesananData.filter((p) => p.status === statusFilter);
    }

    // Filter metode
    if (metodeFilter !== 'semua') {
      pesananData = pesananData.filter((p) => p.metode === metodeFilter);
    }

    // Urutkan terbaru lebih dulu
    pesananData.sort((a, b) => new Date(b.waktu).getTime() - new Date(a.waktu).getTime());

    const hasil: PesananDenganItem[] = [];
    for (const p of pesananData) {
      const items = await db.getAllFromIndex('item_pesanan', 'by-pesanan', p.id);
      hasil.push({
        pesanan: p,
        items,
        nomorAntrean: formatNomorAntrean(p.kode_perangkat, p.nomor),
      });
    }

    setDaftarPesanan(hasil);
    setLoading(false);
  };

  useEffect(() => {
    muatDataPesanan();
  }, [tanggalPilih, outletPilih, statusFilter, metodeFilter]);

  const handleBatalkan = async (e: Event) => {
    e.preventDefault();
    if (!alasanBatal.trim()) {
      setErrorBatal('Alasan pembatalan wajib diisi');
      return;
    }

    if (!pesananDipilih) return;

    try {
      await batalkanPesananLokal(pesananDipilih.pesanan.id, alasanBatal.trim());
      setModalBatal(false);
      setAlasanBatal('');
      setErrorBatal('');
      setPesananDipilih(null);
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
      setNotifSalin('Teks struk berhasil disalin');
      setTimeout(() => setNotifSalin(''), 3000);
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

  const totalBatal = pesananTersaring.filter((p) => p.pesanan.status === 'batal').length;
  const totalLunas = pesananTersaring.filter((p) => p.pesanan.status === 'selesai').length;

  return (
    <div class="min-h-screen bg-slate-50 pb-28 text-slate-900">
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
                  Riwayat Transaksi (Admin)
                </h1>
              </div>
              <p class="text-[11px] text-slate-500 mt-0.5">
                Audit & kelola seluruh transaksi kasir, filter per toko & tanggal
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
              <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                Tanggal Transaksi:
              </label>
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
                  {m === 'semua' ? 'Semua Metode' : m}
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
        {/* Ringkasan Singkat Filter Ini */}
        <div class="grid grid-cols-3 gap-2 text-center">
          <div class="bg-white rounded-2xl border border-slate-200 p-3 shadow-2xs">
            <span class="text-[10px] font-bold uppercase text-slate-400 block">Total Omzet Lunas</span>
            <span class="text-xs sm:text-sm font-black text-slate-900 tabular-nums">
              {formatRupiah(totalOmzetLunas)}
            </span>
          </div>
          <div class="bg-white rounded-2xl border border-slate-200 p-3 shadow-2xs">
            <span class="text-[10px] font-bold uppercase text-emerald-600 block">Transaksi Lunas</span>
            <span class="text-xs sm:text-sm font-black text-emerald-700 tabular-nums">
              {totalLunas} Nota
            </span>
          </div>
          <div class="bg-white rounded-2xl border border-slate-200 p-3 shadow-2xs">
            <span class="text-[10px] font-bold uppercase text-rose-500 block">Dibatalkan</span>
            <span class="text-xs sm:text-sm font-black text-rose-700 tabular-nums">
              {totalBatal} Nota
            </span>
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
          <div class="space-y-2">
            {pesananTersaring.map(({ pesanan, items, nomorAntrean }) => {
              const totalItem = items.reduce((s, it) => s + it.qty, 0);
              const isBatal = pesanan.status === 'batal';

              return (
                <div
                  key={pesanan.id}
                  onClick={() => setPesananDipilih({ pesanan, items, nomorAntrean })}
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

                      <div class="flex items-center gap-2 text-[10px] text-slate-400 mt-1">
                        <span>{formatWaktu(pesanan.waktu)}</span>
                        {pesanan.catatan && <span>· Catatan: "{pesanan.catatan}"</span>}
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
                      <span class="text-[10px] font-semibold text-slate-400 uppercase">
                        {pesanan.status}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── MODAL DETAIL TRANSAKSI ADMIN ── */}
      {pesananDipilih && !modalBatal && (
        <div class="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div class="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 max-h-[85vh] overflow-y-auto shadow-2xl space-y-4">
            <div class="flex items-start justify-between">
              <div>
                <span class="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                  Detail Transaksi (Admin)
                </span>
                <h3 class="text-base font-black text-slate-900">
                  Antrean: {pesananDipilih.nomorAntrean}
                </h3>
                {pesananDipilih.pesanan.kode_transaksi && (
                  <p class="text-xs font-mono text-slate-500">{pesananDipilih.pesanan.kode_transaksi}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setPesananDipilih(null)}
                class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer"
              >
                <IconTutup size={14} />
              </button>
            </div>

            {notifSalin && (
              <div class="p-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl text-center font-bold">
                {notifSalin}
              </div>
            )}

            {/* Info Status */}
            <div class="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-2xl">
              <div>
                <span class="text-[10px] text-slate-400 block uppercase">Waktu</span>
                <strong class="text-slate-800">{formatTanggalWaktu(pesananDipilih.pesanan.waktu)}</strong>
              </div>
              <div>
                <span class="text-[10px] text-slate-400 block uppercase">Status & Metode</span>
                <strong class="text-slate-800 uppercase">
                  {pesananDipilih.pesanan.status} · {pesananDipilih.pesanan.metode}
                </strong>
              </div>
            </div>

            {/* Item Pesanan */}
            <div class="border-t border-slate-100 pt-3 space-y-2 text-xs">
              <span class="text-[10px] font-black uppercase text-slate-400 block">Rincian Menu</span>
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
            <div class="border-t border-slate-100 pt-3 space-y-1 text-xs">
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

            {/* Alasan batal jika ada */}
            {pesananDipilih.pesanan.status === 'batal' && (
              <div class="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                <strong>Pesanan Dibatalkan</strong>
                <p class="mt-0.5">Alasan: {pesananDipilih.pesanan.alasan_batal || '-'}</p>
              </div>
            )}

            {/* Aksi */}
            <div class="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={handleCetak}
                class="py-2.5 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <IconPrinter size={15} />
                <span>Cetak Ulang</span>
              </button>
              <button
                type="button"
                onClick={handleBagikan}
                class="py-2.5 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <IconShare size={15} />
                <span>Bagikan</span>
              </button>
            </div>

            {/* Tombol Batalkan untuk Admin jika belum dibatalkan */}
            {pesananDipilih.pesanan.status === 'selesai' && (
              <button
                type="button"
                onClick={() => setModalBatal(true)}
                class="w-full py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-xs transition-colors cursor-pointer border border-rose-200"
              >
                Batalkan Pesanan Ini (Otoritas Admin)
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL KONFIRMASI BATAL ── */}
      {modalBatal && pesananDipilih && (
        <div class="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center z-60 p-4">
          <div class="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl space-y-3">
            <h3 class="text-sm font-black text-slate-900">
              Batalkan Pesanan {pesananDipilih.nomorAntrean}?
            </h3>
            <p class="text-xs text-slate-500">
              Sebagai Admin, masukkan alasan resmi pembatalan pesanan untuk log audit:
            </p>

            {errorBatal && (
              <div class="p-2 bg-rose-50 text-rose-700 text-xs rounded-xl font-bold">
                {errorBatal}
              </div>
            )}

            <form onSubmit={handleBatalkan} class="space-y-3">
              <textarea
                required
                rows={3}
                placeholder="Contoh: Kesalahan input menu / permintaan refund pelanggan"
                value={alasanBatal}
                onInput={(e) => setAlasanBatal((e.target as HTMLTextAreaElement).value)}
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
    </div>
  );
}
