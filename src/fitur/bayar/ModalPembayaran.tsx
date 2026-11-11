import { useState, useEffect } from 'preact/hooks';
import { formatRupiah } from '../../util/rupiah.js';
import {
  totalHargaSignal,
  totalQtySignal,
  itemKeranjangSignal,
  jenisPesananSignal,
  catatanPesananSignal,
  resetKeranjang,
} from '../../state/keranjang.js';
import { sessionSignal } from '../../state/sesi.js';
import { simpanTransaksiBaru, type HasilTransaksi } from '../../data/outbox.js';
import { formatTeksStruk, bagikanStruk } from '../../util/struk.js';
import {
  konfigurasiTunaiSignal,
  muatQrisOutlet,
  type KonfigurasiQrisOutlet,
} from '../../data/pembayaran.js';
import { outletAktifSignal } from '../../data/outlet.js';
import { generateQrisDinamis, generateQrCodeDataUrl } from '../../util/qris.js';
import {
  IconTutup,
  IconPanahKiri,
  IconCheck,
  IconPrinter,
  IconShare,
  IconDompet,
} from '../../komponen/Icon.js';

interface ModalPembayaranProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ModalPembayaran({ isOpen, onClose }: ModalPembayaranProps) {
  if (!isOpen) return null;

  const total = totalHargaSignal.value;
  const totalQty = totalQtySignal.value;
  const items = itemKeranjangSignal.value;
  const jenis = jenisPesananSignal.value;
  const catatan = catatanPesananSignal.value;

  const [metode, setMetode] = useState<'tunai' | 'qris'>('tunai');
  const [uangDiterima, setUangDiterima] = useState<number>(total);
  const [inputKustom, setInputKustom] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [hasilTransaksi, setHasilTransaksi] = useState<HasilTransaksi | null>(null);
  const [notifSalin, setNotifSalin] = useState<string>('');

  // ── Data QRIS Toko & Generator QR Dinamis ──
  const [qrisOutlet, setQrisOutlet] = useState<KonfigurasiQrisOutlet | null>(null);
  const [dynamicQrUrl, setDynamicQrUrl] = useState<string>('');
  const [loadingDynamicQr, setLoadingDynamicQr] = useState<boolean>(false);

  useEffect(() => {
    const outletId = outletAktifSignal.value?.id;
    const qris = muatQrisOutlet(outletId);
    setQrisOutlet(qris);

    if (qris && total > 0 && metode === 'qris') {
      setLoadingDynamicQr(true);
      try {
        const payload = generateQrisDinamis(qris.qrisPayload, total);
        generateQrCodeDataUrl(payload)
          .then(setDynamicQrUrl)
          .catch(() => setDynamicQrUrl(''))
          .finally(() => setLoadingDynamicQr(false));
      } catch {
        setDynamicQrUrl('');
        setLoadingDynamicQr(false);
      }
    }
  }, [outletAktifSignal.value?.id, total, metode]);

  // Saat modal terbuka, inisialisasi uang pas otomatis jika uangDiterima < total
  useEffect(() => {
    if (uangDiterima < total) {
      setUangDiterima(total);
      setInputKustom('');
    }
  }, [total]);

  // Hitung kembalian dan kekurangan
  const nominalBayar = metode === 'tunai' ? uangDiterima : total;
  const kembalian = Math.max(0, nominalBayar - total);
  const kekurangan = Math.max(0, total - nominalBayar);

  // Buat opsi pecahan nominal dari pengaturan kebiasaan kasir
  const cfgTunai = konfigurasiTunaiSignal.value;
  const nominalSaran: number[] = (() => {
    const list = new Set<number>();
    if (cfgTunai.tampilkanUangPas) {
      list.add(total); // Uang pas
    }
    for (const nom of cfgTunai.pecahanCepat) {
      list.add(nom);
    }
    return Array.from(list).sort((a, b) => a - b);
  })();

  const handlePilihNominal = (nom: number) => {
    setUangDiterima(nom);
    setInputKustom(nom === total ? '' : String(nom));
  };

  const handleInputKustom = (val: string) => {
    setInputKustom(val);
    const parsed = parseInt(val.replace(/\D/g, ''), 10);
    setUangDiterima(isNaN(parsed) ? 0 : parsed);
  };

  const handleSelesaikanPesanan = async () => {
    if (metode === 'tunai' && nominalBayar < total) {
      return;
    }

    setLoading(true);

    try {
      const payloadItems = items.map((i) => ({
        produkId: i.produkId,
        namaProduk: `${i.varian} - ${i.paket}`,
        qty: i.qty,
        hargaSatuan: i.harga,
        tambahan: i.tambahan,
      }));

      const res = await simpanTransaksiBaru({
        jenis,
        metode,
        total,
        bayar: nominalBayar,
        kembalian,
        catatan: catatan || undefined,
        items: payloadItems,
      });

      setHasilTransaksi(res);
    } catch (err: any) {
      alert(`Gagal menyimpan transaksi: ${err.message || 'Terjadi kesalahan sistem'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCetak = () => {
    window.print();
  };

  const handleBagikan = async () => {
    if (!hasilTransaksi) return;
    const namaKasir = sessionSignal.value?.nama || 'Kasir';
    const teks = formatTeksStruk(
      hasilTransaksi.pesanan,
      hasilTransaksi.itemPesanan,
      namaKasir,
    );

    const cara = await bagikanStruk(teks, hasilTransaksi.nomorAntreanFormatted);
    if (cara === 'clipboard') {
      setNotifSalin('Teks struk berhasil disalin ke clipboard');
      setTimeout(() => setNotifSalin(''), 3000);
    }
  };

  const handlePesananBaru = () => {
    resetKeranjang();
    setHasilTransaksi(null);
    onClose();
  };

  return (
    <div
      class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs transition-opacity p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        class="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[88vh] overflow-hidden animate-in slide-in-from-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle Sheet Bar (Mobile) */}
        <div class="w-10 h-1 bg-slate-300 rounded-full mx-auto mt-2.5 mb-1.5 sm:hidden shrink-0" />

        {/* ── TAMPILAN 1: HASIL STRUK SUKSES ── */}
        {hasilTransaksi ? (
          <div class="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col justify-between no-scrollbar">
            <div>
              <div class="text-center py-2">
                <div class="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-2">
                  <IconCheck size={24} color="#16a34a" />
                </div>
                <h1 class="text-4xl font-black text-slate-900 tracking-tight leading-none my-1 tabular-nums">
                  {hasilTransaksi.nomorAntreanFormatted}
                </h1>
                <p class="text-xs text-slate-500 font-medium">
                  Nomor Antrean • {new Date(hasilTransaksi.pesanan.waktu).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>

              {notifSalin && (
                <div class="bg-slate-900 text-white text-xs px-3 py-1.5 rounded-lg text-center my-2 font-medium">
                  {notifSalin}
                </div>
              )}

              {/* Rincian Transaksi Singkat */}
              <div class="bg-slate-50 border border-slate-200 rounded-xl p-3 my-3 text-xs">
                <div class="space-y-1.5 pb-2.5 border-b border-slate-200">
                  {hasilTransaksi.itemPesanan.map((it) => {
                    const totalTambahan = it.tambahan.reduce((sum, t) => sum + t.harga * t.qty, 0);
                    const subtotal = (it.harga_satuan + totalTambahan) * it.qty;
                    return (
                      <div key={it.id} class="flex justify-between items-start gap-2">
                        <div class="flex-1">
                          <span class="font-bold text-slate-900">{it.qty}x {it.nama_produk}</span>
                          {it.tambahan.map((t) => (
                            <span key={t.nama} class="block text-[10px] text-slate-500">+ {t.nama}</span>
                          ))}
                        </div>
                        <span class="font-semibold text-slate-900 tabular-nums">{formatRupiah(subtotal)}</span>
                      </div>
                    );
                  })}
                </div>

                <div class="pt-2 space-y-1">
                  <div class="flex justify-between">
                    <span class="text-slate-500">Total:</span>
                    <strong class="font-bold text-slate-900 tabular-nums">{formatRupiah(hasilTransaksi.pesanan.total)}</strong>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-slate-500">Metode:</span>
                    <span class="font-semibold text-slate-800 uppercase">{hasilTransaksi.pesanan.metode}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-slate-500">Bayar:</span>
                    <span class="font-semibold text-slate-800 tabular-nums">{formatRupiah(hasilTransaksi.pesanan.bayar)}</span>
                  </div>
                  <div class="flex justify-between pt-1 border-t border-slate-200 font-bold text-emerald-700">
                    <span>Kembalian:</span>
                    <span class="tabular-nums">{formatRupiah(hasilTransaksi.pesanan.kembalian)}</span>
                  </div>
                </div>
              </div>

              {/* Tombol Cetak & Bagikan */}
              <div class="grid grid-cols-2 gap-2 my-2">
                <button
                  type="button"
                  onClick={handleCetak}
                  class="py-2.5 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <IconPrinter size={15} color="#334155" />
                  <span>Cetak (58mm)</span>
                </button>
                <button
                  type="button"
                  onClick={handleBagikan}
                  class="py-2.5 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <IconShare size={15} color="#334155" />
                  <span>Bagikan Struk</span>
                </button>
              </div>
            </div>

            {/* Tombol Pesanan Baru */}
            <div class="pt-2">
              <button
                type="button"
                onClick={handlePesananBaru}
                class="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-extrabold tracking-wide cursor-pointer transition-all shadow-md"
              >
                Selesai / Pesanan Baru ›
              </button>
            </div>

            {/* Template Cetak Fisik Thermal 58 mm */}
            <div class="struk-print-area" style={{ display: 'none' }}>
              <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                <strong style={{ fontSize: '13px' }}>MITARASA</strong>
                <div>Ayam Goreng Tradisional</div>
              </div>
              <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '4px 0', margin: '4px 0' }}>
                <div>No. Antrean: <strong>{hasilTransaksi.nomorAntreanFormatted}</strong></div>
                <div>Tgl: {new Date(hasilTransaksi.pesanan.waktu).toLocaleString('id-ID')}</div>
                <div>Kasir: {sessionSignal.value?.nama || 'Kasir'}</div>
              </div>
              <div style={{ margin: '4px 0' }}>
                {hasilTransaksi.itemPesanan.map((it) => (
                  <div key={it.id} style={{ marginBottom: '4px' }}>
                    <div>{it.qty}x {it.nama_produk}</div>
                    {it.tambahan.map((t) => (
                      <div key={t.nama} style={{ paddingLeft: '8px', fontSize: '10px' }}>
                        + {t.nama} ({formatRupiah(t.harga)})
                      </div>
                    ))}
                    <div style={{ textAlign: 'right' }}>
                      {formatRupiah((it.harga_satuan + it.tambahan.reduce((s, x) => s + x.harga * x.qty, 0)) * it.qty)}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ borderTop: '1px dashed #000', paddingTop: '4px', margin: '4px 0' }}>
                <div>Total: <strong>{formatRupiah(hasilTransaksi.pesanan.total)}</strong></div>
                <div>Bayar ({hasilTransaksi.pesanan.metode.toUpperCase()}): {formatRupiah(hasilTransaksi.pesanan.bayar)}</div>
                <div>Kembalian: {formatRupiah(hasilTransaksi.pesanan.kembalian)}</div>
                {hasilTransaksi.pesanan.catatan && <div>Catatan: {hasilTransaksi.pesanan.catatan}</div>}
              </div>
              <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '10px' }}>
                <div>Terima Kasih!</div>
                <div>Selamat Menikmati Hidangan</div>
              </div>
            </div>
          </div>
        ) : (
          /* ── TAMPILAN 2: FORM PEMBAYARAN POP-UP FLEKSIBEL ── */
          <div class="flex flex-col flex-1 overflow-hidden">
            {/* Header Pop-up dengan Tombol Tutup & Tambah Menu */}
            <div class="p-3.5 sm:p-4 border-b border-slate-100 flex items-center justify-between gap-3 shrink-0">
              <div class="flex items-center gap-2.5 min-w-0">
                <div class="w-8 h-8 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center shrink-0">
                  <IconDompet size={17} color="#0f172a" />
                </div>
                <div class="min-w-0">
                  <h3 class="text-sm font-bold text-slate-900 leading-tight">Konfirmasi Pembayaran</h3>
                  <p class="text-[11px] text-slate-500 truncate leading-tight">
                    {totalQty} item pesanan • {formatRupiah(total)}
                  </p>
                </div>
              </div>

              <div class="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={onClose}
                  class="flex items-center gap-1 text-[11px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200/60 rounded-lg px-2.5 py-1.5 transition-colors cursor-pointer"
                  title="Kembali ke kasir untuk menambah menu"
                >
                  <IconPanahKiri size={12} color="#2563eb" />
                  <span>Tambah Menu</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  class="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer border-none"
                  aria-label="Tutup"
                >
                  <IconTutup size={13} color="#475569" />
                </button>
              </div>
            </div>

            {/* Isi Form Pembayaran (Scrollable jika layar pendek) */}
            <div class="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-3 no-scrollbar">
              {/* Kartu Ringkasan Total */}
              <div class="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-3">
                <div>
                  <span class="text-[11px] text-slate-500 block font-medium">Total Tagihan:</span>
                  <strong class="text-xl sm:text-2xl font-black text-slate-900 tabular-nums block leading-tight">
                    {formatRupiah(total)}
                  </strong>
                  <span class="text-[10px] text-slate-600 mt-0.5 block font-medium">
                    {items.length} jenis paket
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  class="text-[10.5px] font-bold text-blue-600 hover:underline shrink-0 bg-white border border-blue-100 rounded-lg px-2 py-1 shadow-2xs cursor-pointer"
                >
                  Ubah Item
                </button>
              </div>

              {/* Segmented Control: Tunai vs QRIS */}
              <div>
                <label class="block text-[11px] font-bold text-slate-700 mb-1.5">
                  Metode Pembayaran:
                </label>
                <div class="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setMetode('tunai')}
                    class={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      metode === 'tunai'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Tunai (Cash)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMetode('qris')}
                    class={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      metode === 'qris'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    QRIS
                  </button>
                </div>
              </div>

              {/* Bagian Tunai */}
              {metode === 'tunai' ? (
                <div class="space-y-3">
                  <div>
                    <label class="block text-[11px] font-bold text-slate-700 mb-1.5">
                      Pilihan Nominal Uang Diterima:
                    </label>

                    {/* Tombol Saran Cepat */}
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-2">
                      {nominalSaran.map((nom) => {
                        const isSelected = uangDiterima === nom;
                        return (
                          <button
                            key={nom}
                            type="button"
                            onClick={() => handlePilihNominal(nom)}
                            class={`py-2 px-1.5 rounded-lg border text-[11px] font-bold transition-all cursor-pointer tabular-nums text-center ${
                              isSelected
                                ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {nom === total ? 'Uang Pas' : formatRupiah(nom)}
                          </button>
                        );
                      })}
                    </div>

                    {/* Input Nominal Kustom */}
                    <div class="relative">
                      <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                        Rp
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="Atau ketik nominal lain..."
                        value={inputKustom}
                        onInput={(e) => handleInputKustom((e.target as HTMLInputElement).value)}
                        class="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all tabular-nums"
                      />
                    </div>
                  </div>

                  {/* Kotak Info Kembalian / Kekurangan */}
                  <div
                    class={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                      kekurangan > 0
                        ? 'bg-rose-50 border-rose-200 text-rose-900'
                        : 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                    }`}
                  >
                    <div>
                      <span class="text-[10.5px] font-bold block uppercase tracking-wider">
                        {kekurangan > 0 ? 'Uang Kurang:' : '✓ Kembalian:'}
                      </span>
                      <span class="text-[10px] opacity-80 block">
                        {kekurangan > 0
                          ? 'Nominal belum mencukupi'
                          : `Diterima: ${formatRupiah(nominalBayar)}`}
                      </span>
                    </div>
                    <strong class="text-base sm:text-lg font-black tabular-nums">
                      {kekurangan > 0 ? formatRupiah(kekurangan) : formatRupiah(kembalian)}
                    </strong>
                  </div>
                </div>
              ) : (
                /* Bagian QRIS Dinamis */
                qrisOutlet ? (
                  <div class="bg-white border border-slate-200 rounded-2xl p-4 text-center shadow-2xs space-y-2">
                    <div class="inline-block p-2 bg-white rounded-xl shadow-xs border border-slate-200">
                      {loadingDynamicQr ? (
                        <div class="w-48 h-48 flex items-center justify-center text-xs text-slate-400">
                          <div class="animate-spin w-5 h-5 border-2 border-slate-300 border-t-slate-900 rounded-full mr-2" />
                          <span>Menyiapkan QRIS Dinamis...</span>
                        </div>
                      ) : dynamicQrUrl ? (
                        <img
                          src={dynamicQrUrl}
                          alt="QRIS Dinamis"
                          class="w-48 h-48 mx-auto"
                        />
                      ) : (
                        <div class="w-48 h-48 flex items-center justify-center text-xs text-rose-500">
                          Gagal memuat QRIS
                        </div>
                      )}
                    </div>

                    <div class="space-y-0.5">
                      <span class="inline-block text-[9.5px] font-extrabold bg-emerald-600 text-white px-2 py-0.5 rounded-full uppercase tracking-wider">
                        ✓ QRIS Dinamis Otomatis
                      </span>
                      <h4 class="text-xs font-bold text-slate-900">
                        {qrisOutlet.merchantName || qrisOutlet.outletNama}
                      </h4>
                      <p class="text-sm font-black text-slate-900 tabular-nums">
                        Total Tagihan: {formatRupiah(total)}
                      </p>
                      <p class="text-[10px] text-slate-500 max-w-xs mx-auto">
                        Pelanggan tinggal scan dengan m-Banking / e-Wallet (BCA, Mandiri, BRI, GoPay, ShopeePay, Dana). <strong>Nominal tagihan langsung pas otomatis!</strong>
                      </p>
                    </div>
                  </div>
                ) : (
                  /* Cabang Ini Belum Ada QRIS Statis */
                  <div class="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-4 text-center space-y-2">
                    <div class="w-9 h-9 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto">
                      <IconDompet size={18} color="#b45309" />
                    </div>
                    <h4 class="text-xs font-bold text-amber-900">
                      QRIS Belum Didaftarkan untuk Cabang Ini
                    </h4>
                    <p class="text-[11px] text-amber-800 max-w-xs mx-auto leading-relaxed">
                      Upload foto QRIS statis outlet Anda di menu admin agar kasir bisa langsung menghasilkan QRIS dinamis otomatis.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        window.location.hash = '#/metode-pembayaran';
                      }}
                      class="inline-block py-1.5 px-3 bg-amber-900 text-white text-[11px] font-bold rounded-lg cursor-pointer hover:bg-amber-800 transition-colors shadow-2xs"
                    >
                      Buka Atur Metode Pembayaran ›
                    </button>
                  </div>
                )
              )}
            </div>

            {/* Bilah Tombol Aksi Bawah Pop-Up */}
            <div class="p-3 sm:p-4 bg-white border-t border-slate-100 flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                class="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors cursor-pointer shrink-0"
              >
                ← Tambah Menu
              </button>

              <button
                type="button"
                onClick={handleSelesaikanPesanan}
                disabled={loading || (metode === 'tunai' && nominalBayar < total)}
                class={`flex-1 py-2.5 px-4 rounded-xl text-xs font-extrabold text-white transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm ${
                  loading || (metode === 'tunai' && nominalBayar < total)
                    ? 'bg-slate-300 cursor-not-allowed opacity-75'
                    : 'bg-slate-900 hover:bg-slate-800'
                }`}
              >
                {loading
                  ? 'Menyimpan...'
                  : metode === 'tunai'
                  ? `Selesaikan Tunai (${formatRupiah(total)})`
                  : `Tandai Lunas QRIS (${formatRupiah(total)})`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

