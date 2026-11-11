import { useState, useEffect } from 'preact/hooks';
import { muatSemuaOutlet } from '../../data/outlet.js';
import type { OutletItem } from '../../data/db.js';
import {
  konfigurasiTunaiSignal,
  simpanKonfigurasiTunai,
  muatSemuaQrisOutlet,
  simpanQrisOutlet,
  hapusQrisOutlet,
  urutkanPecahanKasir,
  type KonfigurasiTunai,
  type KonfigurasiQrisOutlet,
} from '../../data/pembayaran.js';
import { formatRupiah } from '../../util/rupiah.js';
import {
  decodeQrisFromImage,
  parseQrisPayload,
  generateQrisDinamis,
  generateQrCodeDataUrl,
} from '../../util/qris.js';
import {
  IconPanahKiri,
  IconCheck,
  IconTutup,
  IconPlus,
  IconToko,
  IconDompet,
} from '../../komponen/Icon.js';

export function LayarPengaturanPembayaran() {
  const [tabAktif, setTabAktif] = useState<'tunai' | 'qris'>('tunai');
  const [pesanSukses, setPesanSukses] = useState('');
  const [pesanError, setPesanError] = useState('');

  // ── State Tab Tunai ──
  const [pecahanList, setPecahanList] = useState<number[]>(() => [
    ...konfigurasiTunaiSignal.value.pecahanCepat,
  ]);
  const [tampilkanUangPas, setTampilkanUangPas] = useState<boolean>(
    konfigurasiTunaiSignal.value.tampilkanUangPas,
  );
  const [inputPecahanBaru, setInputPecahanBaru] = useState('');

  // ── State Tab QRIS ──
  const [daftarOutlet, setDaftarOutlet] = useState<OutletItem[]>([]);
  const [outletTerpilihId, setOutletTerpilihId] = useState<string>('');
  const [petaQrisOutlet, setPetaQrisOutlet] = useState<Record<string, KonfigurasiQrisOutlet>>({});
  const [loadingQr, setLoadingQr] = useState(false);
  const [previewQrTerbaca, setPreviewQrTerbaca] = useState<{
    payload: string;
    merchantName?: string;
    merchantCity?: string;
    previewUrl: string;
  } | null>(null);
  const [modeInputManualQris, setModeInputManualQris] = useState(false);
  const [manualPayloadQris, setManualPayloadQris] = useState('');

  // Simulator QRIS Dinamis
  const [simulasiNominal, setSimulasiNominal] = useState<number>(33000);
  const [simulasiQrUrl, setSimulasiQrUrl] = useState<string>('');

  useEffect(() => {
    muatSemuaOutlet()
      .then((outlets) => {
        setDaftarOutlet(outlets);
        if (outlets.length > 0 && !outletTerpilihId) {
          setOutletTerpilihId(outlets[0].id);
        }
      })
      .catch(() => {});
    setPetaQrisOutlet(muatSemuaQrisOutlet());
  }, []);

  const notif = (teks: string, isErr = false) => {
    if (isErr) {
      setPesanError(teks);
      setTimeout(() => setPesanError(''), 4000);
    } else {
      setPesanSukses(teks);
      setTimeout(() => setPesanSukses(''), 3000);
    }
  };

  // ── Handler Tab Tunai ──
  const handleHapusPecahan = (nom: number) => {
    setPecahanList((prev) => prev.filter((p) => p !== nom));
  };

  const handleTambahPecahan = () => {
    const parsed = parseInt(inputPecahanBaru.replace(/\D/g, ''), 10);
    if (!parsed || parsed <= 0) {
      notif('Masukkan nominal pecahan yang valid', true);
      return;
    }
    if (pecahanList.includes(parsed)) {
      notif('Pecahan ini sudah ada di daftar', true);
      return;
    }
    setPecahanList((prev) => [...prev, parsed].sort((a, b) => a - b));
    setInputPecahanBaru('');
  };

  const handleSimpanTunai = () => {
    if (pecahanList.length === 0) {
      notif('Minimal harus ada 1 pecahan tunai', true);
      return;
    }
    simpanKonfigurasiTunai({
      pecahanCepat: pecahanList,
      tampilkanUangPas,
    });
    notif('Pengaturan pecahan tunai berhasil disimpan');
  };

  // ── Handler Tab QRIS ──
  const qrisOutletAktif = outletTerpilihId ? petaQrisOutlet[outletTerpilihId] || null : null;
  const outletTerpilih = daftarOutlet.find((o) => o.id === outletTerpilihId) || null;

  // Generate simulator jika ada QRIS aktif
  useEffect(() => {
    if (qrisOutletAktif && simulasiNominal > 0) {
      try {
        const dynamicPayload = generateQrisDinamis(qrisOutletAktif.qrisPayload, simulasiNominal);
        generateQrCodeDataUrl(dynamicPayload).then(setSimulasiQrUrl).catch(() => {});
      } catch {
        setSimulasiQrUrl('');
      }
    } else {
      setSimulasiQrUrl('');
    }
  }, [qrisOutletAktif?.qrisPayload, simulasiNominal]);

  const handleFileQrChange = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    setLoadingQr(true);
    setPreviewQrTerbaca(null);

    try {
      const hasil = await decodeQrisFromImage(file);
      setPreviewQrTerbaca(hasil);
      notif(`QRIS terdeteksi: ${hasil.merchantName || 'Merchant Terverifikasi'}`);
    } catch (err: any) {
      notif(err.message || 'Gagal membaca kode QR dari gambar', true);
    } finally {
      setLoadingQr(false);
      input.value = '';
    }
  };

  const handleSimpanManualQris = () => {
    if (!manualPayloadQris.trim()) {
      notif('Tempel atau ketik string payload QRIS terlebih dahulu', true);
      return;
    }
    const parsed = parseQrisPayload(manualPayloadQris.trim());
    if (!parsed.isValid) {
      notif('String QRIS tidak valid. Pastikan diawali dengan 000201...', true);
      return;
    }
    setPreviewQrTerbaca({
      payload: parsed.rawPayload,
      merchantName: parsed.merchantName,
      merchantCity: parsed.merchantCity,
      previewUrl: '',
    });
    setModeInputManualQris(false);
    setManualPayloadQris('');
  };

  const handleKonfirmasiSimpanQris = () => {
    if (!outletTerpilihId || !previewQrTerbaca) return;

    const outletNama = outletTerpilih?.nama || 'Toko Mitarasa';
    simpanQrisOutlet({
      outletId: outletTerpilihId,
      outletNama,
      qrisPayload: previewQrTerbaca.payload,
      merchantName: previewQrTerbaca.merchantName || outletNama,
      merchantCity: previewQrTerbaca.merchantCity || 'Indonesia',
      qrisImage: previewQrTerbaca.previewUrl || undefined,
      diubahPada: new Date().toISOString(),
    });

    setPetaQrisOutlet(muatSemuaQrisOutlet());
    setPreviewQrTerbaca(null);
    notif(`QRIS untuk cabang "${outletNama}" berhasil disimpan!`);
  };

  const handleHapusQris = (outletId: string) => {
    if (confirm('Hapus QRIS untuk cabang ini? Transaksi QRIS kasir akan kembali ke mode manual.')) {
      hapusQrisOutlet(outletId);
      setPetaQrisOutlet(muatSemuaQrisOutlet());
      notif('QRIS cabang berhasil dihapus');
    }
  };

  return (
    <div class="min-h-screen bg-slate-50 pb-20">
      {/* Toast Notifikasi */}
      {pesanSukses && (
        <div class="fixed top-14 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-4 py-2 rounded-full text-xs font-semibold z-50 shadow-lg flex items-center gap-2">
          <IconCheck size={14} color="#22c55e" />
          <span>{pesanSukses}</span>
        </div>
      )}
      {pesanError && (
        <div class="fixed top-14 left-1/2 -translate-x-1/2 bg-rose-600 text-white px-4 py-2 rounded-full text-xs font-semibold z-50 shadow-lg flex items-center gap-2">
          <IconTutup size={14} color="#ffffff" />
          <span>{pesanError}</span>
        </div>
      )}

      {/* ── Top Bar Header ── */}
      <div class="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-30 flex items-center justify-between shadow-2xs">
        <div class="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              window.location.hash = '#/kasir';
            }}
            class="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors cursor-pointer border-none"
            title="Kembali ke Kasir"
          >
            <IconPanahKiri size={16} color="#0f172a" />
          </button>
          <div>
            <h1 class="text-sm sm:text-base font-extrabold text-slate-900 leading-tight">
              Atur Metode Pembayaran
            </h1>
            <p class="text-[11px] text-slate-500 leading-tight">
              Kebiasaan uang tunai & QRIS dinamis per cabang toko
            </p>
          </div>
        </div>
      </div>

      <div class="max-w-2xl mx-auto p-4 sm:p-5">
        {/* ── Segmented Control Sub-Menu (Tunai vs QRIS) ── */}
        <div class="grid grid-cols-2 gap-1.5 p-1 bg-slate-200/80 rounded-2xl mb-5">
          <button
            type="button"
            onClick={() => setTabAktif('tunai')}
            class={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              tabAktif === 'tunai'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>1. Tunai (Pecahan Kasir)</span>
          </button>
          <button
            type="button"
            onClick={() => setTabAktif('qris')}
            class={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              tabAktif === 'qris'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>2. QRIS Dinamis Toko</span>
          </button>
        </div>

        {/* ═══════════════════════════════════════════════════ */}
        {/* ── SUB-MENU 1: TUNAI (KEBIASAAN UANG KASIR) ──     */}
        {/* ═══════════════════════════════════════════════════ */}
        {tabAktif === 'tunai' && (
          <div class="space-y-4">
            {/* Kartu Edukasi */}
            <div class="bg-blue-50/60 border border-blue-200/60 rounded-2xl p-4 text-xs text-blue-900 leading-relaxed">
              <strong class="font-bold block mb-1">Pengaturan Kebiasaan Uang Pembeli:</strong>
              Atur pecahan uang yang sering digunakan pelanggan di toko Anda. Tombol ini akan langsung muncul di pop-up pembayaran kasir sehingga kasir bisa langsung klik-klik cepat tanpa mengetik manual.
            </div>

            {/* Daftar Pecahan Aktif */}
            <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-4">
              <div>
                <label class="block text-xs font-bold text-slate-900 mb-1">
                  Daftar Pecahan Tunai Aktif:
                </label>
                <p class="text-[11px] text-slate-500 mb-3">
                  Pecahan di bawah ini yang akan muncul sebagai tombol pilihan di kasir.
                </p>

                <div class="flex flex-wrap gap-2">
                  {pecahanList.map((nom) => (
                    <div
                      key={nom}
                      class="flex items-center gap-1.5 bg-slate-100 border border-slate-300/80 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-900 shadow-2xs"
                    >
                      <span class="tabular-nums">{formatRupiah(nom)}</span>
                      <button
                        type="button"
                        onClick={() => handleHapusPecahan(nom)}
                        class="w-4 h-4 rounded-full bg-slate-200 hover:bg-rose-100 hover:text-rose-600 flex items-center justify-center transition-colors cursor-pointer border-none text-slate-600"
                        title="Hapus pecahan"
                      >
                        <IconTutup size={10} color="currentColor" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Form Tambah Pecahan Kustom */}
              <div class="pt-3 border-t border-slate-100 flex items-center gap-2">
                <div class="relative flex-1">
                  <span class="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    Rp
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Tambah pecahan baru (mis: 15000, 75000)..."
                    value={inputPecahanBaru}
                    onInput={(e) => setInputPecahanBaru((e.target as HTMLInputElement).value)}
                    class="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all tabular-nums"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleTambahPecahan}
                  class="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                >
                  <IconPlus size={14} color="#ffffff" />
                  <span>Tambah</span>
                </button>
              </div>

              {/* Opsi Uang Pas */}
              <div class="pt-3 border-t border-slate-100">
                <label class="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tampilkanUangPas}
                    onChange={(e) => setTampilkanUangPas((e.target as HTMLInputElement).checked)}
                    class="w-4 h-4 accent-slate-900 rounded cursor-pointer"
                  />
                  <span class="text-xs font-medium text-slate-800">
                    Selalu sediakan tombol otomatis <strong>"Uang Pas"</strong> sesuai total pesanan pelanggan
                  </span>
                </label>
              </div>
            </div>

            {/* Simulasi Tampilan di Kasir */}
            <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
              <label class="block text-xs font-bold text-slate-900 mb-1">
                Simulasi Tampilan di Kasir (Jika total pesanan Rp 33.000):
              </label>
              <div class="mt-2 p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-wrap gap-2">
                {tampilkanUangPas && (
                  <span class="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold">
                    Uang Pas (Rp 33.000)
                  </span>
                )}
                {urutkanPecahanKasir(pecahanList, 33000).map((nom) => (
                  <span
                    key={nom}
                    class="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-bold tabular-nums"
                  >
                    {formatRupiah(nom)}
                  </span>
                ))}
              </div>
            </div>

            {/* Tombol Simpan Tab Tunai */}
            <button
              type="button"
              onClick={handleSimpanTunai}
              class="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-extrabold tracking-wide cursor-pointer transition-all shadow-md flex items-center justify-center gap-2"
            >
              <IconCheck size={16} color="#22c55e" />
              <span>Simpan Pengaturan Tunai</span>
            </button>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════ */}
        {/* ── SUB-MENU 2: QRIS DINAMIS PER CABANG ──          */}
        {/* ═══════════════════════════════════════════════════ */}
        {tabAktif === 'qris' && (
          <div class="space-y-4">
            {/* Kartu Edukasi */}
            <div class="bg-indigo-50/70 border border-indigo-200/70 rounded-2xl p-4 text-xs text-indigo-950 leading-relaxed">
              <strong class="font-bold block mb-1">QRIS Statis Otomatis Jadi Dinamis:</strong>
              Upload gambar QRIS statis outlet Anda (dari BCA, BRI, Mandiri, ShopeePay, Dana, dll.). Sistem akan otomatis menyuntikkan nominal tagihan pesanan kasir, sehingga pembeli yang scan <strong>tidak perlu lagi mengetik uang manual</strong>.
            </div>

            {/* 1. Pilih Cabang Toko */}
            <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
              <label class="block text-xs font-bold text-slate-900 mb-1.5">
                Pilih Cabang / Toko yang Ingin Diatur:
              </label>
              <div class="relative">
                <select
                  value={outletTerpilihId}
                  onChange={(e) => setOutletTerpilihId((e.target as HTMLSelectElement).value)}
                  class="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-hidden focus:border-slate-900 focus:ring-1 focus:ring-slate-900 cursor-pointer"
                >
                  {daftarOutlet.map((o) => {
                    const adaQris = !!petaQrisOutlet[o.id];
                    return (
                      <option key={o.id} value={o.id}>
                        {o.nama} {adaQris ? '(QRIS Aktif)' : '(Belum ada QRIS)'}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {/* 2. Status QRIS Cabang Terpilih */}
            {qrisOutletAktif ? (
              <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-4">
                <div class="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                      <IconCheck size={20} color="#15803d" />
                    </div>
                    <div>
                      <div class="flex items-center gap-1.5">
                        <span class="text-[10px] font-extrabold bg-emerald-600 text-white px-1.5 py-0.5 rounded uppercase">
                          QRIS Siap Dinamis
                        </span>
                      </div>
                      <h3 class="text-sm font-bold text-slate-900 mt-1">
                        {qrisOutletAktif.merchantName || qrisOutletAktif.outletNama}
                      </h3>
                      <p class="text-[11px] text-slate-500">
                        Lokasi: {qrisOutletAktif.merchantCity || 'Indonesia'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleHapusQris(qrisOutletAktif.outletId)}
                    class="text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer shrink-0"
                  >
                    Hapus
                  </button>
                </div>

                {/* Uji Coba Simulator Dinamis */}
                <div class="bg-slate-50 rounded-xl border border-slate-200 p-3.5">
                  <div class="flex items-center justify-between gap-2 mb-2">
                    <span class="text-xs font-bold text-slate-900">
                      Tes Simulator QRIS Dinamis:
                    </span>
                    <div class="flex items-center gap-1 text-xs">
                      <span class="text-slate-500">Nominal:</span>
                      <input
                        type="number"
                        value={simulasiNominal}
                        onInput={(e) => setSimulasiNominal(Number((e.target as HTMLInputElement).value) || 0)}
                        class="w-24 px-2 py-1 bg-white border border-slate-200 rounded text-xs font-bold tabular-nums text-right"
                      />
                    </div>
                  </div>

                  {simulasiQrUrl ? (
                    <div class="text-center py-2">
                      <div class="inline-block p-2.5 bg-white rounded-xl shadow-xs border border-slate-200">
                        <img
                          src={simulasiQrUrl}
                          alt="Simulator QRIS Dinamis"
                          class="w-48 h-48 mx-auto"
                        />
                      </div>
                      <p class="text-[11px] text-slate-600 font-bold mt-2">
                        Scan dengan GoPay/BCA/Livin/BRImo/ShopeePay: Nominal otomatis{' '}
                        <span class="text-emerald-700">{formatRupiah(simulasiNominal)}</span>!
                      </p>
                    </div>
                  ) : (
                    <p class="text-xs text-slate-400 text-center py-4">Membuat simulator...</p>
                  )}
                </div>

                {/* Tombol Ganti / Upload Ulang */}
                <div class="pt-2">
                  <label class="block w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 text-center rounded-xl text-xs font-bold cursor-pointer transition-colors border border-slate-200">
                    <span>Ganti / Upload Ulang Foto QRIS</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileQrChange}
                      class="hidden"
                    />
                  </label>
                </div>
              </div>
            ) : (
              /* Belum Ada QRIS untuk Cabang Ini */
              <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
                <div class="text-center py-6 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                  <div class="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-3">
                    <IconDompet size={24} color="#64748b" />
                  </div>
                  <h3 class="text-xs font-bold text-slate-800 mb-1">
                    Upload Foto QRIS Statis untuk "{outletTerpilih?.nama || 'Cabang Ini'}"
                  </h3>
                  <p class="text-[11px] text-slate-500 max-w-sm mx-auto mb-4">
                    Gunakan foto barcode QRIS yang diberikan bank atau dompet digital Anda. Sistem akan mendeteksinya secara otomatis.
                  </p>

                  <label class="inline-flex items-center gap-2 py-2.5 px-5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-xs">
                    <IconPlus size={15} color="#ffffff" />
                    <span>Pilih Foto QRIS dari Galeri / Kamera</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileQrChange}
                      class="hidden"
                    />
                  </label>

                  {loadingQr && (
                    <div class="mt-3 text-xs text-slate-500 flex items-center justify-center gap-2 font-medium">
                      <div class="animate-spin w-4 h-4 border-2 border-slate-300 border-t-slate-900 rounded-full" />
                      <span>Sedang memindai kode QR dari gambar...</span>
                    </div>
                  )}
                </div>

                {/* Input Manual Alternatif */}
                <div class="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => setModeInputManualQris(!modeInputManualQris)}
                    class="text-xs font-semibold text-blue-600 hover:underline cursor-pointer border-none bg-transparent"
                  >
                    {modeInputManualQris ? 'Sembunyikan Input Manual' : 'Atau tempel string QRIS manual'}
                  </button>

                  {modeInputManualQris && (
                    <div class="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-left">
                      <label class="block text-[11px] font-bold text-slate-700 mb-1">
                        String Payload QRIS (Dimulai dengan 000201...):
                      </label>
                      <textarea
                        rows={3}
                        value={manualPayloadQris}
                        onInput={(e) => setManualPayloadQris((e.target as HTMLTextAreaElement).value)}
                        placeholder="000201010211..."
                        class="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:outline-hidden"
                      />
                      <button
                        type="button"
                        onClick={handleSimpanManualQris}
                        class="mt-2 py-1.5 px-3 bg-slate-900 text-white rounded-lg text-xs font-bold cursor-pointer"
                      >
                        Validasi & Gunakan
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Konfirmasi Setelah QRIS Berhasil Dibaca dari Foto / Manual */}
            {previewQrTerbaca && (
              <div class="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 shadow-sm space-y-3">
                <div class="flex items-center gap-2 text-emerald-800 font-bold text-xs">
                  <IconCheck size={16} color="#15803d" />
                  <span>Kode QRIS Berhasil Terbaca!</span>
                </div>

                <div class="bg-white p-3 rounded-xl border border-emerald-200 text-xs space-y-1">
                  <div>
                    <span class="text-slate-500">Merchant:</span>{' '}
                    <strong class="text-slate-900">{previewQrTerbaca.merchantName || outletTerpilih?.nama}</strong>
                  </div>
                  <div>
                    <span class="text-slate-500">Kota:</span>{' '}
                    <span class="text-slate-700">{previewQrTerbaca.merchantCity || 'Indonesia'}</span>
                  </div>
                  <div class="text-[10px] text-slate-400 font-mono truncate">
                    Payload: {previewQrTerbaca.payload.slice(0, 40)}...
                  </div>
                </div>

                <div class="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewQrTerbaca(null)}
                    class="py-2.5 px-3.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleKonfirmasiSimpanQris}
                    class="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold cursor-pointer transition-colors shadow-xs"
                  >
                    Simpan QRIS untuk "{outletTerpilih?.nama}" ›
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
