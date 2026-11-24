import { useState, useRef, useEffect } from 'preact/hooks';
import {
  getProfilOutlet,
  simpanProfilOutlet,
  outletAktifSignal,
  muatSemuaOutlet,
  pilihOutletAktif,
  type ProfilStrukOutlet,
} from '../../data/outlet.js';
import type { OutletItem } from '../../data/db.js';
import { formatRupiah } from '../../util/rupiah.js';
import { kompresGambar } from '../../util/gambar.js';
import {
  IconPrinter,
  IconCheck,
  IconPinLokasi,
  IconSimpan,
  IconGambar,
  IconWifi,
  IconTutup,
} from '../../komponen/Icon.js';

export function LayarPengaturanStruk() {
  const [daftarOutlet, setDaftarOutlet] = useState<OutletItem[]>([]);
  const [outletTerpilihId, setOutletTerpilihId] = useState<string>(() => {
    const hash = window.location.hash;
    const match = hash.match(/outlet=([^&]+)/);
    if (match && match[1]) return match[1];
    return outletAktifSignal.value?.id || '';
  });

  const [profil, setProfil] = useState<ProfilStrukOutlet>(() => getProfilOutlet(outletTerpilihId || undefined));
  const [pesanSukses, setPesanSukses] = useState('');
  const [loadingGambar, setLoadingGambar] = useState(false);
  const [bukaModalPilihCabang, setBukaModalPilihCabang] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    muatSemuaOutlet().then((list) => {
      setDaftarOutlet(list);
      if (!outletTerpilihId && list.length > 0) {
        const targetId = outletAktifSignal.value?.id || list[0].id;
        setOutletTerpilihId(targetId);
        setProfil(getProfilOutlet(targetId));
      }
    });
  }, []);

  // Perbarui data saat memilih outlet berbeda di pop up
  const handleGantiOutlet = (outlet: OutletItem) => {
    setOutletTerpilihId(outlet.id);
    pilihOutletAktif(outlet);
    const fresh = getProfilOutlet(outlet.id);
    setProfil(fresh);
    setBukaModalPilihCabang(false);
    window.location.hash = `#/struk?outlet=${outlet.id}`;
    notifikasi(`Beralih mengatur struk untuk cabang: ${outlet.nama}`);
  };

  const notifikasi = (teks: string) => {
    setPesanSukses(teks);
    setTimeout(() => setPesanSukses(''), 3500);
  };

  const handleSimpan = (e?: Event) => {
    if (e) e.preventDefault();
    simpanProfilOutlet(profil, outletTerpilihId);
    notifikasi('Format struk cabang ini berhasil disimpan!');
  };

  const handleUploadLogo = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    setLoadingGambar(true);

    try {
      const base64 = await kompresGambar(file, {
        maxDimensi: 320,
        kualitas: 0.8,
        format: 'image/jpeg',
      });

      if (base64) {
        const updated = { ...profil, logoUrl: base64, tampilkanLogo: true };
        setProfil(updated);
        simpanProfilOutlet(updated, outletTerpilihId);
        notifikasi('Logo restoran berhasil diunggah!');
      }
    } catch (err: any) {
      alert(`Gagal memproses gambar logo: ${err?.message || 'Format tidak didukung'}`);
    } finally {
      setLoadingGambar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleHapusLogo = () => {
    if (!confirm('Hapus logo restoran dari struk?')) return;
    const updated = { ...profil, logoUrl: '', tampilkanLogo: false };
    setProfil(updated);
    simpanProfilOutlet(updated, outletTerpilihId);
    notifikasi('Logo restoran telah dihapus');
  };

  const handleTesCetak = () => {
    simpanProfilOutlet(profil, outletTerpilihId);
    window.print();
  };

  const outletAktif = daftarOutlet.find((o) => o.id === outletTerpilihId) || outletAktifSignal.value;

  return (
    <div class="min-h-screen bg-slate-50 pb-24">
      {/* ── HEADER HALAMAN ── */}
      <div class="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div class="max-w-5xl mx-auto px-4 py-3 sm:py-4">
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <a
                href="#/kasir"
                class="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors text-decoration-none shrink-0"
                title="Kembali ke Layar Kasir"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="19" y1="12" x2="5" y2="12" />
                  <polyline points="12 19 5 12 12 5" />
                </svg>
              </a>
              <div>
                <h1 class="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-tight">
                  Format Struk & Identitas Toko
                </h1>
                <p class="text-[11px] text-slate-500 leading-tight">
                  Kustomisasi logo, informasi nota, dan layout printer thermal modern
                </p>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTesCetak}
                class="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all cursor-pointer shadow-2xs"
              >
                <IconPrinter size={15} color="#334155" />
                <span>Tes Cetak</span>
              </button>
              <button
                type="button"
                onClick={() => handleSimpan()}
                class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold transition-all cursor-pointer shadow-sm"
              >
                <IconSimpan size={14} color="#ffffff" />
                <span>Simpan</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="max-w-5xl mx-auto px-4 py-6">
        {/* Notifikasi Pesan Sukses */}
        {pesanSukses && (
          <div class="mb-5 p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2.5 text-xs text-emerald-800 font-bold shadow-2xs">
            <span class="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <IconCheck size={14} color="#047857" />
            </span>
            <span>{pesanSukses}</span>
          </div>
        )}

        {/* Banner Pemilih Cabang Struk dengan Tombol Pop Up */}
        <div class="mb-5 p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <IconPinLokasi size={20} color="#ffffff" />
            </div>
            <div>
              <div class="flex items-center gap-2">
                <span class="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Cabang Toko yang Sedang Diatur:
                </span>
                <span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  {outletAktif?.kode || 'CABANG'}
                </span>
              </div>
              <strong class="text-base font-black text-slate-900 block leading-snug">
                {outletAktif?.nama || 'Ayam Goreng Mitarasa'}
              </strong>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setBukaModalPilihCabang(true)}
              class="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs cursor-pointer transition-all shadow-2xs flex items-center gap-2"
            >
              <IconPinLokasi size={14} color="#ffffff" />
              <span>Ganti / Pilih Toko Lain</span>
            </button>
          </div>
        </div>

        {/* ── GRID KONTEN 2 KOLOM (FORM PENGATURAN & LIVE PREVIEW STRUK) ── */}
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ═════════════════════════════════════════════════════════════════════════ */}
          {/* KOLOM KIRI: FORMULIR IDENTITAS & FORMAT STRUK (7 Kolom di Desktop)      */}
          {/* ═════════════════════════════════════════════════════════════════════════ */}
          <form onSubmit={handleSimpan} class="lg:col-span-7 space-y-5">
            {/* 1. KARTU IDENTITAS RESTORAN & LOGO */}
            <div class="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs space-y-4">
              <div class="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h2 class="text-xs font-extrabold uppercase tracking-wider text-slate-900">
                    1. Logo & Identitas Cabang Toko
                  </h2>
                  <p class="text-[11px] text-slate-500">
                    Pengaturan identitas khusus cabang {outletAktif?.nama}
                  </p>
                </div>
              </div>

              {/* Upload Gambar Logo */}
              <div>
                <label class="block text-xs font-bold text-slate-800 mb-2">
                  Logo Restoran (Thermal Friendly):
                </label>
                <div class="flex items-center gap-4">
                  {/* Kotak Preview Logo */}
                  <div class="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0 relative group">
                    {profil.logoUrl ? (
                      <img
                        src={profil.logoUrl}
                        alt="Logo Resto"
                        class="w-full h-full object-contain p-1.5"
                      />
                    ) : (
                      <div class="text-center p-2">
                        <div class="flex justify-center mb-1 text-slate-400">
                          <IconGambar size={24} color="#94a3b8" />
                        </div>
                        <span class="text-[9px] font-bold text-slate-400 block uppercase">Belum Ada</span>
                      </div>
                    )}

                    {loadingGambar && (
                      <div class="absolute inset-0 bg-slate-900/60 flex items-center justify-center text-white text-[10px] font-bold">
                        Mengompres...
                      </div>
                    )}
                  </div>

                  {/* Tombol Aksi Logo */}
                  <div class="flex-1 space-y-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      class="hidden"
                      onChange={handleUploadLogo}
                    />

                    <div class="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={loadingGambar}
                        class="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer transition-colors"
                      >
                        {profil.logoUrl ? 'Ganti Logo' : '+ Unggah Logo Resto'}
                      </button>

                      {profil.logoUrl && (
                        <button
                          type="button"
                          onClick={handleHapusLogo}
                          class="px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold cursor-pointer transition-colors"
                        >
                          Hapus Logo
                        </button>
                      )}
                    </div>

                    <p class="text-[10px] text-slate-500 leading-relaxed">
                      Format PNG, JPG, atau WebP. Gambar otomatis dikompres agar kontras dan tajam saat dicetak printer thermal.
                    </p>

                    {profil.logoUrl && (
                      <label class="flex items-center gap-2 pt-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={profil.tampilkanLogo}
                          onChange={(e) => setProfil({ ...profil, tampilkanLogo: (e.target as HTMLInputElement).checked })}
                          class="w-4 h-4 rounded text-slate-900 focus:ring-0"
                        />
                        <span class="text-xs font-semibold text-slate-700 select-none">
                          Tampilkan logo di bagian atas struk
                        </span>
                      </label>
                    )}
                  </div>
                </div>
              </div>

              {/* Form Input Detail Restoran */}
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label class="block text-[11px] font-bold text-slate-700 mb-1">
                    Nama Toko / Cabang:
                  </label>
                  <input
                    type="text"
                    required
                    value={profil.namaToko}
                    onInput={(e) => setProfil({ ...profil, namaToko: (e.target as HTMLInputElement).value })}
                    placeholder="Contoh: Ayam Goreng Mitarasa"
                    class="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 bg-slate-50/50 focus:bg-white focus:outline-slate-900"
                  />
                </div>

                <div>
                  <label class="block text-[11px] font-bold text-slate-700 mb-1">
                    Slogan / Sub-header:
                  </label>
                  <input
                    type="text"
                    value={profil.slogan}
                    onInput={(e) => setProfil({ ...profil, slogan: (e.target as HTMLInputElement).value })}
                    placeholder="Contoh: Gurih Meresap Sampai ke Tulang"
                    class="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 bg-slate-50/50 focus:bg-white focus:outline-slate-900"
                  />
                </div>

                <div class="sm:col-span-2">
                  <label class="block text-[11px] font-bold text-slate-700 mb-1">
                    Alamat Lengkap Cabang Ini:
                  </label>
                  <input
                    type="text"
                    value={profil.alamat}
                    onInput={(e) => setProfil({ ...profil, alamat: (e.target as HTMLInputElement).value })}
                    placeholder="Contoh: Jl. Lodan Raya No. 12, Ancol, Jakarta Utara"
                    class="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 bg-slate-50/50 focus:bg-white focus:outline-slate-900"
                  />
                </div>

                <div>
                  <label class="block text-[11px] font-bold text-slate-700 mb-1">
                    No. WhatsApp / Telepon Kasir:
                  </label>
                  <input
                    type="text"
                    value={profil.telepon}
                    onInput={(e) => setProfil({ ...profil, telepon: (e.target as HTMLInputElement).value })}
                    placeholder="Contoh: 0812-3456-7890"
                    class="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 bg-slate-50/50 focus:bg-white focus:outline-slate-900"
                  />
                </div>

                <div>
                  <label class="block text-[11px] font-bold text-slate-700 mb-1">
                    Akun Media Sosial / Instagram:
                  </label>
                  <input
                    type="text"
                    value={profil.instagram}
                    onInput={(e) => setProfil({ ...profil, instagram: (e.target as HTMLInputElement).value })}
                    placeholder="Contoh: @ayamgorengmitarasa"
                    class="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 bg-slate-50/50 focus:bg-white focus:outline-slate-900"
                  />
                </div>

                <div class="sm:col-span-2">
                  <label class="block text-[11px] font-bold text-slate-700 mb-1">
                    Informasi Fasilitas / WiFi (Opsional):
                  </label>
                  <input
                    type="text"
                    value={profil.wifiInfo}
                    onInput={(e) => setProfil({ ...profil, wifiInfo: (e.target as HTMLInputElement).value })}
                    placeholder="Contoh: WiFi: Mitarasa-Guest (Pass: mitarasa354)"
                    class="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 bg-slate-50/50 focus:bg-white focus:outline-slate-900"
                  />
                </div>
              </div>
            </div>

            {/* 2. KARTU FORMAT PENCETAKAN & KERTAS */}
            <div class="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs space-y-4">
              <div class="border-b border-slate-100 pb-3">
                <h2 class="text-xs font-extrabold uppercase tracking-wider text-slate-900">
                  2. Format Cetak & Kertas Printer
                </h2>
                <p class="text-[11px] text-slate-500">
                  Pilih ukuran printer bluetooth portable atau printer desktop kasir
                </p>
              </div>

              {/* Ukuran Kertas Printer */}
              <div>
                <label class="block text-xs font-bold text-slate-800 mb-2">
                  Lebar Kertas Printer Thermal:
                </label>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label
                    class={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                      profil.ukuranKertas === '58mm'
                        ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="ukuranKertas"
                      value="58mm"
                      checked={profil.ukuranKertas === '58mm'}
                      onChange={() => setProfil({ ...profil, ukuranKertas: '58mm' })}
                      class="mt-0.5 text-slate-900 focus:ring-0"
                    />
                    <div>
                      <strong class="text-xs font-bold text-slate-900 block">
                        58 mm (Printer Bluetooth Portable)
                      </strong>
                      <span class="text-[11px] text-slate-500 block leading-tight mt-0.5">
                        Ukuran paling umum untuk printer mini kasir HP / Android.
                      </span>
                    </div>
                  </label>

                  <label
                    class={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                      profil.ukuranKertas === '80mm'
                        ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="ukuranKertas"
                      value="80mm"
                      checked={profil.ukuranKertas === '80mm'}
                      onChange={() => setProfil({ ...profil, ukuranKertas: '80mm' })}
                      class="mt-0.5 text-slate-900 focus:ring-0"
                    />
                    <div>
                      <strong class="text-xs font-bold text-slate-900 block">
                        80 mm (Printer Desktop Resto)
                      </strong>
                      <span class="text-[11px] text-slate-500 block leading-tight mt-0.5">
                        Lebar kertas standar restoran modern (auto-cutter / USB POS).
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Huruf Antrean & Opsi Tambahan */}
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label class="block text-[11px] font-bold text-slate-700 mb-1">
                    Huruf Awalan Antrean Kasir Ini:
                  </label>
                  <input
                    type="text"
                    maxLength={2}
                    value={profil.kodePerangkat}
                    onInput={(e) => setProfil({ ...profil, kodePerangkat: (e.target as HTMLInputElement).value.toUpperCase() })}
                    class="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-extrabold text-slate-900 uppercase bg-slate-50/50 focus:bg-white focus:outline-slate-900 tracking-wider"
                  />
                  <span class="text-[10px] text-slate-400 mt-1 block">
                    Misal: 'A' untuk antrean A-001, A-002, dst.
                  </span>
                </div>

                <div class="flex items-center pt-4">
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={profil.tampilkanAntreanBesar}
                      onChange={(e) => setProfil({ ...profil, tampilkanAntreanBesar: (e.target as HTMLInputElement).checked })}
                      class="w-4 h-4 rounded text-slate-900 focus:ring-0"
                    />
                    <span class="text-xs font-semibold text-slate-700 select-none">
                      Tampilkan Nomor Antrean Besar di Header
                    </span>
                  </label>
                </div>
              </div>

              {/* Pesan Footer / Penutup */}
              <div>
                <label class="block text-[11px] font-bold text-slate-700 mb-1">
                  Pesan Footer Struk (Catatan Penutup):
                </label>
                <textarea
                  rows={2}
                  value={profil.pesanFooter}
                  onInput={(e) => setProfil({ ...profil, pesanFooter: (e.target as HTMLTextAreaElement).value })}
                  placeholder="Contoh: Terima kasih atas kunjungan Anda! Selamat menikmati hidangan"
                  class="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 bg-slate-50/50 focus:bg-white focus:outline-slate-900 leading-relaxed font-sans"
                />
              </div>
            </div>

            {/* Tombol Simpan Formulir */}
            <div class="flex items-center gap-3 pt-1">
              <button
                type="submit"
                class="flex-1 py-3 px-5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-extrabold tracking-wide cursor-pointer transition-all shadow-md flex items-center justify-center gap-2"
              >
                <IconSimpan size={16} color="#ffffff" />
                <span>Simpan Format Struk Cabang Ini</span>
              </button>
              <button
                type="button"
                onClick={handleTesCetak}
                class="py-3 px-4 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
              >
                <IconPrinter size={15} color="#334155" />
                <span>Tes Cetak</span>
              </button>
            </div>
          </form>

          {/* ═════════════════════════════════════════════════════════════════════════ */}
          {/* KOLOM KANAN: LIVE PREVIEW FISIK STRUK RESTORAN MODERN (5 Kolom di Desktop)*/}
          {/* ═════════════════════════════════════════════════════════════════════════ */}
          <div class="lg:col-span-5 lg:sticky lg:top-20 space-y-3">
            <div class="flex items-center justify-between px-1">
              <span class="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
                <span>Live Preview Struk Kasir</span>
              </span>
              <span class="text-[10px] font-bold bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full uppercase">
                {profil.ukuranKertas}
              </span>
            </div>

            {/* Wadah Kertas Thermal Realistis */}
            <div class="bg-white rounded-2xl border border-slate-300/80 p-5 sm:p-6 shadow-md max-w-sm mx-auto font-mono text-slate-900 text-xs leading-tight relative overflow-hidden select-none">
              {/* Efek gerigi tepi atas kertas */}
              <div class="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200" />

              {/* 1. Header Restoran */}
              <div class="text-center space-y-1 mb-3">
                {profil.tampilkanLogo && profil.logoUrl && (
                  <div class="w-16 h-16 mx-auto mb-1 flex items-center justify-center">
                    <img
                      src={profil.logoUrl}
                      alt="Logo Struk"
                      class="max-w-full max-h-full object-contain filter grayscale contrast-150"
                    />
                  </div>
                )}
                <h3 class="text-sm font-black tracking-tight leading-tight uppercase font-sans">
                  {profil.namaToko || 'AYAM GORENG MITARASA'}
                </h3>
                {profil.slogan && (
                  <p class="text-[10px] text-slate-600 font-sans italic">
                    {profil.slogan}
                  </p>
                )}
                {profil.alamat && (
                  <p class="text-[10px] text-slate-500 font-sans leading-tight">
                    {profil.alamat}
                  </p>
                )}
                {profil.telepon && (
                  <p class="text-[10px] text-slate-500 font-sans">
                    Telp / WA: {profil.telepon}
                  </p>
                )}
              </div>

              {/* 2. Nomor Antrean Jumbo (Jika Aktif) */}
              {profil.tampilkanAntreanBesar && (
                <div class="my-2 py-2 border-y border-dashed border-slate-300 text-center">
                  <span class="text-[10px] font-sans font-bold text-slate-500 block uppercase tracking-wider">
                    Nomor Antrean
                  </span>
                  <strong class="text-3xl font-black font-sans tracking-tight block my-0.5">
                    {profil.kodePerangkat || 'A'}-001
                  </strong>
                </div>
              )}

              {/* 3. Info Transaksi */}
              <div class="text-[10px] space-y-0.5 py-1 text-slate-600">
                <div class="flex justify-between">
                  <span>No. Nota:</span>
                  <span class="font-bold text-slate-800">MITA2411261</span>
                </div>
                <div class="flex justify-between">
                  <span>Waktu:</span>
                  <span>{new Date().toLocaleDateString('id-ID')} 12:30 WIB</span>
                </div>
                <div class="flex justify-between">
                  <span>Kasir:</span>
                  <span>Kasir Bertugas</span>
                </div>
              </div>

              {/* 4. Garis Pembatas Putus-putus */}
              <div class="border-b border-dashed border-slate-400 my-2" />

              {/* 5. Daftar Item Contoh */}
              <div class="space-y-2 py-1 text-[11px]">
                <div>
                  <div class="flex justify-between items-start font-bold">
                    <span>2x Paket Ayam Rempah Komplit</span>
                    <span class="tabular-nums">{formatRupiah(50000)}</span>
                  </div>
                  <div class="text-[10px] text-slate-500 pl-3">
                    + Extra Kremes ({formatRupiah(5000)})
                  </div>
                  <div class="text-[10px] text-slate-500 pl-3">
                    + Sambal Korek Bawang
                  </div>
                </div>

                <div>
                  <div class="flex justify-between items-start font-bold">
                    <span>2x Es Teh Manis</span>
                    <span class="tabular-nums">{formatRupiah(10000)}</span>
                  </div>
                </div>
              </div>

              {/* 6. Garis Pembatas */}
              <div class="border-b border-dashed border-slate-400 my-2" />

              {/* 7. Total & Pembayaran */}
              <div class="space-y-1 text-[11px]">
                <div class="flex justify-between">
                  <span>Subtotal:</span>
                  <span class="tabular-nums">{formatRupiah(60000)}</span>
                </div>
                <div class="flex justify-between">
                  <span>Tambahan / Add-ons:</span>
                  <span class="tabular-nums">{formatRupiah(5000)}</span>
                </div>
                <div class="flex justify-between font-black text-sm pt-1 border-t border-dotted border-slate-300">
                  <span class="font-sans">TOTAL:</span>
                  <span class="tabular-nums">{formatRupiah(65000)}</span>
                </div>
                <div class="flex justify-between pt-1 text-[10px] text-slate-600">
                  <span>Metode:</span>
                  <strong class="font-bold text-slate-800 uppercase">QRIS DINAMIS</strong>
                </div>
                <div class="flex justify-between text-[10px] text-slate-600">
                  <span>Bayar:</span>
                  <span class="tabular-nums">{formatRupiah(65000)}</span>
                </div>
                <div class="flex justify-between text-[10px] text-slate-600">
                  <span>Kembalian:</span>
                  <span class="tabular-nums">Rp 0</span>
                </div>
              </div>

              {/* 8. Garis Pembatas Footer */}
              <div class="border-b border-dashed border-slate-400 my-2.5" />

              {/* 9. Pesan Footer & Kontak */}
              <div class="text-center space-y-1 text-[10px] text-slate-600 font-sans">
                {profil.pesanFooter && (
                  <p class="font-semibold text-slate-800 leading-tight">
                    {profil.pesanFooter}
                  </p>
                )}
                {profil.instagram && (
                  <p class="text-[9.5px] text-slate-500">
                    Follow Instagram: <strong>{profil.instagram}</strong>
                  </p>
                )}
                {profil.wifiInfo && (
                  <p class="text-[9.5px] text-slate-500 bg-slate-100 py-0.5 rounded flex items-center justify-center gap-1">
                    <IconWifi size={11} color="#64748b" />
                    <span>{profil.wifiInfo}</span>
                  </p>
                )}
                <p class="text-[9px] text-slate-400 pt-1">
                  *** Simpan struk ini sebagai bukti pembayaran ***
                </p>
              </div>

              {/* Efek gerigi tepi bawah kertas */}
              <div class="absolute bottom-0 left-0 right-0 h-1.5 bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200" />
            </div>

            {/* Tombol Cetak Langsung */}
            <div class="text-center pt-1">
              <button
                type="button"
                onClick={handleTesCetak}
                class="w-full py-2.5 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold transition-all cursor-pointer shadow-2xs flex items-center justify-center gap-2"
              >
                <IconPrinter size={15} color="#0f172a" />
                <span>Uji Cetak Thermal ({profil.ukuranKertas})</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── MODAL POP UP PILIH CABANG TOKO ── */}
      {bukaModalPilihCabang && (
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div class="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header Modal */}
            <div class="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 class="text-sm sm:text-base font-black text-slate-900 tracking-tight">
                  Pilih Cabang Toko
                </h3>
                <p class="text-[11px] text-slate-500">
                  Tentukan cabang mana yang ingin Anda atur format struknya
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBukaModalPilihCabang(false)}
                class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
              >
                <IconTutup size={14} color="#475569" />
              </button>
            </div>

            {/* Daftar Pilihan Cabang */}
            <div class="p-4 sm:p-5 space-y-2.5 max-h-[60vh] overflow-y-auto">
              {daftarOutlet.map((o) => {
                const terpilih = o.id === outletTerpilihId;
                const aktifKasir = o.id === outletAktifSignal.value?.id;
                return (
                  <div
                    key={o.id}
                    onClick={() => handleGantiOutlet(o)}
                    class={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      terpilih
                        ? 'border-slate-900 bg-slate-50 ring-2 ring-slate-900'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                  >
                    <div class="flex items-center gap-3 min-w-0">
                      <div class={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        terpilih ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'
                      }`}>
                        <IconPinLokasi size={16} color={terpilih ? '#ffffff' : '#334155'} />
                      </div>
                      <div class="min-w-0">
                        <div class="flex items-center gap-2">
                          <strong class="text-xs font-bold text-slate-900 block truncate">
                            {o.nama}
                          </strong>
                          {aktifKasir && (
                            <span class="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                              Kasir Aktif
                            </span>
                          )}
                        </div>
                        <p class="text-[10px] text-slate-500 truncate mt-0.5">
                          {o.alamat || 'Alamat cabang belum diatur'}
                        </p>
                      </div>
                    </div>

                    <div class="shrink-0">
                      {terpilih ? (
                        <span class="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center">
                          <IconCheck size={14} color="#ffffff" />
                        </span>
                      ) : (
                        <button
                          type="button"
                          class="px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-[11px] font-bold text-slate-700 hover:bg-slate-100"
                        >
                          Atur
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {daftarOutlet.length === 0 && (
                <div class="text-center py-6 text-slate-400 text-xs font-medium">
                  Belum ada daftar cabang toko.
                </div>
              )}
            </div>

            {/* Footer Modal */}
            <div class="p-3.5 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setBukaModalPilihCabang(false)}
                class="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold cursor-pointer transition-colors"
              >
                Batal / Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {/* ELEMEN STRUK KHUSUS CETAK FISIK (Window.Print)                          */}
      {/* ═════════════════════════════════════════════════════════════════════════ */}
      <div class={`struk-print-area ${profil.ukuranKertas === '80mm' ? 'kertas-80mm' : 'kertas-58mm'}`} style={{ display: 'none' }}>
        {/* Header Struk */}
        <div style={{ textAlign: 'center', marginBottom: '6px' }}>
          {profil.tampilkanLogo && profil.logoUrl && (
            <img
              src={profil.logoUrl}
              class="logo-struk"
              alt="Logo Resto"
              style={{ maxWidth: '36mm', maxHeight: '25mm', margin: '0 auto 4px auto', display: 'block' }}
            />
          )}
          <strong style={{ fontSize: '13px', display: 'block', textTransform: 'uppercase' }}>
            {profil.namaToko || 'AYAM GORENG MITARASA'}
          </strong>
          {profil.slogan && <div style={{ fontSize: '10px' }}>{profil.slogan}</div>}
          {profil.alamat && <div style={{ fontSize: '9px', marginTop: '2px' }}>{profil.alamat}</div>}
          {profil.telepon && <div style={{ fontSize: '9px' }}>Telp: {profil.telepon}</div>}
        </div>

        {/* Antrean Jumbo */}
        {profil.tampilkanAntreanBesar && (
          <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '6px 0', margin: '6px 0', textAlign: 'center' }}>
            <div style={{ fontSize: '10px' }}>NOMOR ANTREAN</div>
            <div style={{ fontSize: '26px', fontWeight: 'bold' }}>
              {profil.kodePerangkat || 'A'}-001
            </div>
          </div>
        )}

        {/* Info Transaksi */}
        <div style={{ fontSize: '10px', margin: '4px 0', lineHeight: 1.3 }}>
          <div>No. Nota : MITA2411261</div>
          <div>Tanggal  : {new Date().toLocaleDateString('id-ID')} {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB</div>
          <div>Kasir    : Kasir Bertugas</div>
        </div>

        {/* Daftar Menu */}
        <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '4px 0', margin: '4px 0' }}>
          <div style={{ marginBottom: '4px' }}>
            <div>2x Paket Ayam Rempah Komplit</div>
            <div style={{ paddingLeft: '8px', fontSize: '9px' }}>+ Extra Kremes (Rp 5.000)</div>
            <div style={{ textAlign: 'right' }}>Rp 55.000</div>
          </div>
          <div>
            <div>2x Es Teh Manis</div>
            <div style={{ textAlign: 'right' }}>Rp 10.000</div>
          </div>
        </div>

        {/* Total & Bayar */}
        <div style={{ margin: '4px 0', fontSize: '11px', lineHeight: 1.35 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <strong>TOTAL:</strong>
            <strong>Rp 65.000</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
            <span>Metode:</span>
            <span>QRIS DINAMIS</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
            <span>Bayar:</span>
            <span>Rp 65.000</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
            <span>Kembalian:</span>
            <span>Rp 0</span>
          </div>
        </div>

        {/* Footer */}
        <div style={{ borderTop: '1px dashed #000', paddingTop: '6px', marginTop: '6px', textAlign: 'center', fontSize: '10px', lineHeight: 1.3 }}>
          {profil.pesanFooter && <div>{profil.pesanFooter}</div>}
          {profil.instagram && <div>IG: {profil.instagram}</div>}
          {profil.wifiInfo && <div>{profil.wifiInfo}</div>}
          <div style={{ marginTop: '4px', fontSize: '9px' }}>Selamat Menikmati Hidangan!</div>
        </div>
      </div>
    </div>
  );
}
