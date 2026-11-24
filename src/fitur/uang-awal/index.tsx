import { useState, useEffect } from 'preact/hooks';
import { getLocalDB, type UangAwalItem, type OutboxItem } from '../../data/db.js';
import { formatRupiah } from '../../util/rupiah.js';
import { sessionSignal } from '../../state/sesi.js';
import { pendingOutboxCountSignal } from '../../state/sinkron.js';
import { prosesOutbox } from '../../data/sync.js';
import { getSupabase } from '../../data/supabase.js';
import { IconUangAwal } from '../../komponen/Ikon.js';
import { IconCheck, IconPlus, IconMinus, IconTutup } from '../../komponen/Icon.js';
import {
  formatTanggalPanjang,
  formatTanggalAngka,
  formatWaktu,
  formatWaktuDetik,
} from '../../util/tanggal.js';

// Daftar pecahan uang rupiah yang umum disiapkan tim keuangan untuk kembalian
const PECAHAN_DEFAULT = [
  { nominal: 100000, label: 'Rp 100.000', tipe: 'lembar' },
  { nominal: 50000,  label: 'Rp 50.000',  tipe: 'lembar' },
  { nominal: 20000,  label: 'Rp 20.000',  tipe: 'lembar' },
  { nominal: 10000,  label: 'Rp 10.000',  tipe: 'lembar' },
  { nominal: 5000,   label: 'Rp 5.000',   tipe: 'lembar' },
  { nominal: 2000,   label: 'Rp 2.000',   tipe: 'lembar' },
  { nominal: 1000,   label: 'Rp 1.000',   tipe: 'koin/lembar' },
  { nominal: 500,    label: 'Rp 500',     tipe: 'koin' },
];

function getHariTanggalIndo(dateStr: string): string {
  if (!dateStr) return '';
  return formatTanggalPanjang(dateStr);
}

function formatWaktuLengkap(isoString?: string | null): string {
  if (!isoString) return '-';
  return `${formatTanggalPanjang(isoString)} pukul ${formatWaktuDetik(isoString)}`;
}

function formatJamDetik(isoString?: string | null): string {
  if (!isoString) return '-';
  return formatWaktuDetik(isoString);
}

export function LayarUangAwal() {
  const [uangAwalAktif, setUangAwalAktif] = useState<UangAwalItem | null>(null);
  const [riwayatUangAwal, setRiwayatUangAwal] = useState<UangAwalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pesanSukses, setPesanSukses] = useState('');

  // ── State Form Buka Uang Awal Toko ──
  const [tanggalOperasional, setTanggalOperasional] = useState<string>(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [jamRealtime, setJamRealtime] = useState<string>('');
  const [kasAwalInput, setKasAwalInput] = useState<number>(200000);
  const [sumberDana, setSumberDana] = useState<string>('Tim Keuangan');
  const [catatanAwal, setCatatanAwal] = useState<string>('');
  const [modeKalkulator, setModeKalkulator] = useState<boolean>(false);
  const [lembarPecahan, setLembarPecahan] = useState<Record<string, number>>({
    '100000': 0,
    '50000': 2,
    '20000': 3,
    '10000': 2,
    '5000': 2,
    '2000': 5,
    '1000': 0,
    '500': 0,
  });

  // ── State Tutup Kasir / Akhir Toko ──
  const [kasAkhirInput, setKasAkhirInput] = useState<number>(0);
  const [catatanTutup, setCatatanTutup] = useState<string>('');
  const [totalTunai, setTotalTunai] = useState<number>(0);
  const [totalQris, setTotalQris] = useState<number>(0);
  const [jumlahPesanan, setJumlahPesanan] = useState<number>(0);
  const [detailRiwayatBuka, setDetailRiwayatBuka] = useState<string | null>(null);

  // Live timer jam:menit:detik
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setJamRealtime(
        now.toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }) + ' WIB',
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const notifikasi = (teks: string) => {
    setPesanSukses(teks);
    setTimeout(() => setPesanSukses(''), 3500);
  };

  // Muat data shift lokal & sinkronkan dari Supabase
  const muatDataUangAwal = async () => {
    setLoading(true);
    const db = await getLocalDB();

    // 1. Tarik dari Supabase jika online agar data riwayat tidak hilang saat deploy / ganti HP
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const supabase = await getSupabase();
        const { data: remoteShifts, error } = await supabase
          .from('uang_awal')
          .select('*')
          .order('buka_pada', { ascending: false })
          .limit(30);

        if (!error && remoteShifts && remoteShifts.length > 0) {
          const tx = db.transaction('uang_awal', 'readwrite');
          for (const s of remoteShifts) {
            await tx.objectStore('uang_awal').put(s as UangAwalItem);
          }
          await tx.done;
        }
      } catch (e) {
        console.warn('Gagal sinkron riwayat shift dari Supabase:', e);
      }
    }

    // 2. Cek status uang modal / shift aktif
    const metaAktif = await db.get('meta', 'uang_awal_aktif_id');
    let aktif: UangAwalItem | null = null;

    if (metaAktif && typeof metaAktif.val === 'string') {
      const item = await db.get('uang_awal', metaAktif.val);
      if (item && !item.tutup_pada) {
        aktif = item;
      }
    }

    setUangAwalAktif(aktif);

    if (aktif) {
      // Hitung total penjualan tunai & QRIS sesi ini
      const semuaPesanan = await db.getAll('pesanan');
      const pesananShiftIni = semuaPesanan.filter(
        (p) => (p.uang_awal_id || p.shift_id) === aktif?.id && p.status === 'selesai',
      );

      let tunai = 0;
      let qris = 0;
      for (const p of pesananShiftIni) {
        if (p.metode === 'tunai') tunai += p.total;
        else if (p.metode === 'qris') qris += p.total;
      }

      setTotalTunai(tunai);
      setTotalQris(qris);
      setJumlahPesanan(pesananShiftIni.length);
      setKasAkhirInput(aktif.kas_awal + tunai);
    }

    // 3. Muat seluruh riwayat uang awal yang sudah ditutup
    const semuaShift = await db.getAll('uang_awal');
    const closed = semuaShift
      .filter((s) => Boolean(s.tutup_pada))
      .sort((a, b) => new Date(b.buka_pada).getTime() - new Date(a.buka_pada).getTime());
    setRiwayatUangAwal(closed);

    setLoading(false);
  };

  useEffect(() => {
    muatDataUangAwal();
  }, []);

  // Handler ubah jumlah lembar pecahan uang
  const ubahLembar = (nom: number, delta: number) => {
    const key = String(nom);
    const curr = lembarPecahan[key] || 0;
    const next = Math.max(0, curr + delta);
    const updated = { ...lembarPecahan, [key]: next };
    setLembarPecahan(updated);

    // Hitung total dari semua lembaran
    let total = 0;
    for (const [nStr, qty] of Object.entries(updated)) {
      total += Number(nStr) * qty;
    }
    setKasAwalInput(total);
  };

  // Simpan Uang Modal Awal Toko & Buka Kasir
  const handleBukaUangAwal = async (e: Event) => {
    e.preventDefault();
    if (kasAwalInput < 0) {
      alert('Modal uang awal tidak boleh minus.');
      return;
    }

    const db = await getLocalDB();
    const shiftId = crypto.randomUUID();
    const waktuISO = new Date().toISOString();
    const kasirId = sessionSignal.value?.id || 'kasir-lokal';
    const kasirNama = sessionSignal.value?.nama || 'Kasir';

    const dataBaru: UangAwalItem = {
      id: shiftId,
      kasir_id: kasirId,
      kasir_nama: kasirNama,
      tanggal: tanggalOperasional,
      buka_pada: waktuISO,
      tutup_pada: null,
      kas_awal: kasAwalInput,
      kas_akhir: null,
      selisih: null,
      total_tunai: 0,
      total_qris: 0,
      jumlah_pesanan: 0,
      catatan: catatanAwal.trim() || undefined,
      sumber_dana: sumberDana.trim() || 'Tim Keuangan',
      rincian_pecahan: modeKalkulator ? { ...lembarPecahan } : null,
    };

    const outboxItem: OutboxItem = {
      id: crypto.randomUUID(),
      tabel: 'uang_awal',
      data: dataBaru,
      waktu: waktuISO,
      status: 'pending',
      percobaan: 0,
    };

    const tx = db.transaction(['uang_awal', 'meta', 'outbox'], 'readwrite');
    await tx.objectStore('uang_awal').put(dataBaru);
    await tx.objectStore('meta').put({ key: 'uang_awal_aktif_id', val: shiftId });
    await tx.objectStore('outbox').put(outboxItem);
    await tx.done;

    pendingOutboxCountSignal.value = await db.count('outbox');
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const supabase = await getSupabase();
        await supabase.from('uang_awal').upsert(dataBaru);
      } catch {}
      prosesOutbox().catch(() => {});
    }

    notifikasi(`Uang awal toko Rp ${kasAwalInput.toLocaleString('id-ID')} berhasil disimpan untuk tanggal ${getHariTanggalIndo(tanggalOperasional)}!`);
    await muatDataUangAwal();
  };

  // Tutup Kasir & Simpan Rekapitulasi Lengkap
  const handleTutupKasir = async (e: Event) => {
    e.preventDefault();
    if (!uangAwalAktif) return;

    const konfirmasi = confirm(
      `Tutup kasir sekarang?\nEstimasi uang fisik di laci: ${formatRupiah(uangAwalAktif.kas_awal + totalTunai)}\nUang dihitung: ${formatRupiah(kasAkhirInput)}`
    );
    if (!konfirmasi) return;

    const db = await getLocalDB();
    const waktuTutup = new Date().toISOString();
    const estimasiKas = uangAwalAktif.kas_awal + totalTunai;
    const selisih = kasAkhirInput - estimasiKas;

    const updatedShift: UangAwalItem = {
      ...uangAwalAktif,
      tutup_pada: waktuTutup,
      kas_akhir: kasAkhirInput,
      selisih,
      total_tunai: totalTunai,
      total_qris: totalQris,
      jumlah_pesanan: jumlahPesanan,
      catatan: catatanTutup.trim() ? `${uangAwalAktif.catatan ? uangAwalAktif.catatan + ' | ' : ''}Tutup: ${catatanTutup.trim()}` : uangAwalAktif.catatan,
    };

    const outboxItem: OutboxItem = {
      id: crypto.randomUUID(),
      tabel: 'uang_awal',
      data: updatedShift,
      waktu: waktuTutup,
      status: 'pending',
      percobaan: 0,
    };

    const tx = db.transaction(['uang_awal', 'meta', 'outbox'], 'readwrite');
    await tx.objectStore('uang_awal').put(updatedShift);
    await tx.objectStore('meta').delete('uang_awal_aktif_id');
    await tx.objectStore('outbox').put(outboxItem);
    await tx.done;

    pendingOutboxCountSignal.value = await db.count('outbox');
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const supabase = await getSupabase();
        await supabase.from('uang_awal').upsert(updatedShift);
      } catch {}
      prosesOutbox().catch(() => {});
    }

    notifikasi('Operasional kasir berhasil ditutup dan rekap harian telah tersimpan!');
    await muatDataUangAwal();
  };

  if (loading) {
    return (
      <div class="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-xs font-semibold text-slate-500">
        <div class="flex items-center gap-2">
          <div class="w-4 h-4 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin" />
          <span>Memuat data uang awal & kasir...</span>
        </div>
      </div>
    );
  }

  return (
    <div class="min-h-screen bg-slate-50 pb-24 text-slate-900">
      {/* Toast Notifikasi */}
      {pesanSukses && (
        <div class="fixed top-14 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-4 py-2.5 rounded-full text-xs font-semibold z-50 shadow-xl flex items-center gap-2 animate-bounce">
          <IconCheck size={14} color="#22c55e" />
          <span>{pesanSukses}</span>
        </div>
      )}

      {/* Top Header */}
      <div class="bg-white border-b border-slate-200 px-4 py-3.5 sticky top-0 z-30 shadow-2xs">
        <div class="max-w-xl mx-auto flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center shrink-0">
              <IconUangAwal size={18} color="#b45309" />
            </div>
            <div>
              <h1 class="text-sm font-extrabold text-slate-900 leading-tight">Uang Awal Toko</h1>
              <p class="text-[11px] text-slate-500 leading-tight">
                Pencatatan modal kas kecil / uang kembalian per tanggal
              </p>
            </div>
          </div>

          <div class="text-right">
            <span class="inline-block px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[10px] font-mono font-bold text-slate-600">
              {jamRealtime || 'Waktu Realtime'}
            </span>
          </div>
        </div>
      </div>

      <div class="max-w-xl mx-auto p-4 space-y-4">
        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* KONDISI 1: BELUM ADA SESI UANG AWAL AKTIF (FORM INPUT AWAL)     */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {!uangAwalAktif ? (
          <div class="space-y-4">
            {/* Kartu Informasi & Panduan */}
            <div class="bg-amber-50 border border-amber-200/80 rounded-2xl p-4 text-xs text-amber-950 leading-relaxed shadow-2xs">
              <div class="flex items-start gap-2.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" class="shrink-0 mt-0.5"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                <div>
                  <strong class="font-bold block mb-1">Catatan Modal Uang Kembalian Kasir:</strong>
                  Uang awal ini adalah modal kas yang diserahkan tim keuangan (biasanya dalam pecahan uang kecil seperti Rp 2.000, Rp 5.000, Rp 10.000, dst.) untuk kembalian pelanggan. Uang ini <strong>bukan omzet</strong> dan akan otomatis dipisahkan dari rekap penjualan bersih toko.
                </div>
              </div>
            </div>

            {/* Form Input Uang Modal Awal */}
            <form onSubmit={handleBukaUangAwal} class="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs space-y-4">
              {/* 1. Pemilihan Tanggal Operasional */}
              <div>
                <label class="block text-xs font-bold text-slate-800 mb-1.5">
                  1. Tanggal Operasional Toko:
                </label>
                <div class="flex items-center gap-2">
                  <input
                    type="date"
                    required
                    value={tanggalOperasional}
                    onChange={(e) => setTanggalOperasional((e.target as HTMLInputElement).value)}
                    class="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-hidden focus:border-slate-900 focus:ring-1 focus:ring-slate-900 cursor-pointer"
                  />
                  <div class="px-3 py-2 bg-slate-100 rounded-xl text-[11px] font-semibold text-slate-600 shrink-0">
                    {getHariTanggalIndo(tanggalOperasional)}
                  </div>
                </div>
                <p class="text-[10px] text-slate-400 mt-1">
                  *Pilih tanggal operasional uang modal ini akan dipakai (default hari ini).
                </p>
              </div>

              {/* 2. Jam & Detik Input Real-time */}
              <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Waktu Penyerahan / Input:</span>
                  <span class="text-xs font-extrabold text-slate-800">
                    Tercatat detik realtime saat disimpan
                  </span>
                </div>
                <div class="text-right">
                  <span class="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 font-mono font-black text-xs">
                    {jamRealtime}
                  </span>
                </div>
              </div>

              {/* 3. Sumber Dana & Kasir Penerima */}
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-[11px] font-bold text-slate-700 mb-1">
                    Sumber / Diserahkan Oleh:
                  </label>
                  <select
                    value={sumberDana}
                    onChange={(e) => setSumberDana((e.target as HTMLSelectElement).value)}
                    class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden"
                  >
                    <option value="Tim Keuangan">Tim Keuangan</option>
                    <option value="Owner / Manajemen">Owner / Manajemen</option>
                    <option value="Sisa Laci Kemarin">Sisa Laci Kemarin</option>
                    <option value="Kasir Sebelumnya">Kasir Sebelumnya</option>
                  </select>
                </div>
                <div>
                  <label class="block text-[11px] font-bold text-slate-700 mb-1">
                    Petugas Kasir Penerima:
                  </label>
                  <div class="px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 truncate">
                    {sessionSignal.value?.nama || 'Kasir Bertugas'}
                  </div>
                </div>
              </div>

              {/* 4. Input Nominal Utama Modal Awal */}
              <div class="pt-2 border-t border-slate-100">
                <div class="flex items-center justify-between mb-1.5">
                  <label class="text-xs font-bold text-slate-900">
                    Total Modal Uang Awal Toko:
                  </label>
                  <button
                    type="button"
                    onClick={() => setModeKalkulator(!modeKalkulator)}
                    class="text-[11px] font-bold text-amber-700 hover:text-amber-800 hover:underline cursor-pointer border-none bg-transparent"
                  >
                    {modeKalkulator ? '✕ Tutup Rincian Pecahan' : '＋ Rincikan Lembaran Pecahan'}
                  </button>
                </div>

                <div class="relative">
                  <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-extrabold text-slate-400">
                    Rp
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    required
                    value={kasAwalInput}
                    onInput={(e) => setKasAwalInput(Number((e.target as HTMLInputElement).value) || 0)}
                    class="w-full pl-10 pr-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-base font-extrabold text-slate-900 focus:outline-hidden focus:border-slate-900 focus:ring-1 focus:ring-slate-900 tabular-nums"
                  />
                </div>

                {/* Tombol Pilihan Nominal Cepat */}
                <div class="grid grid-cols-4 gap-1.5 mt-2.5">
                  {[0, 50000, 100000, 200000].map((nom) => (
                    <button
                      key={nom}
                      type="button"
                      onClick={() => {
                        setKasAwalInput(nom);
                      }}
                      class={`py-2 px-1 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                        kasAwalInput === nom
                          ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                      }`}
                    >
                      {nom === 0 ? 'Rp 0' : formatRupiah(nom)}
                    </button>
                  ))}
                </div>
              </div>

              {/* 5. Kalkulator Lembar Uang Pecahan (Opsional) */}
              {modeKalkulator && (
                <div class="p-3.5 bg-amber-50/50 rounded-xl border border-amber-200 space-y-2.5">
                  <div class="flex items-center justify-between pb-1 border-b border-amber-200/60">
                    <span class="text-[11px] font-bold text-amber-950">
                      Rincian Lembaran Uang dari Tim Keuangan:
                    </span>
                    <span class="text-[11px] font-mono font-bold text-amber-900">
                      Subtotal: {formatRupiah(kasAwalInput)}
                    </span>
                  </div>

                  <div class="grid grid-cols-2 gap-2">
                    {PECAHAN_DEFAULT.map((pec) => {
                      const qty = lembarPecahan[String(pec.nominal)] || 0;
                      return (
                        <div
                          key={pec.nominal}
                          class="flex items-center justify-between p-2 bg-white rounded-lg border border-amber-100 text-xs"
                        >
                          <div>
                            <span class="font-bold text-slate-800 block text-[11px] leading-tight">
                              {pec.label}
                            </span>
                            <span class="text-[9px] text-slate-400">
                              {qty > 0 ? formatRupiah(pec.nominal * qty) : pec.tipe}
                            </span>
                          </div>

                          <div class="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => ubahLembar(pec.nominal, -1)}
                              disabled={qty <= 0}
                              class="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 disabled:opacity-30 text-slate-700 flex items-center justify-center font-bold cursor-pointer"
                            >
                              -
                            </button>
                            <span class="w-6 text-center font-mono font-bold text-xs tabular-nums">
                              {qty}
                            </span>
                            <button
                              type="button"
                              onClick={() => ubahLembar(pec.nominal, 1)}
                              class="w-6 h-6 rounded-md bg-amber-600 hover:bg-amber-700 text-white flex items-center justify-center font-bold cursor-pointer"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 6. Catatan Tambahan */}
              <div>
                <label class="block text-[11px] font-bold text-slate-700 mb-1">
                  Catatan Tambahan (Opsional):
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Pecahan 2rb & 5rb lebih banyak untuk kembalian"
                  value={catatanAwal}
                  onInput={(e) => setCatatanAwal((e.target as HTMLInputElement).value)}
                  class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden"
                />
              </div>

              {/* Tombol Simpan & Buka Kasir */}
              <button
                type="submit"
                class="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-extrabold tracking-wide transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <IconCheck size={16} color="#22c55e" />
                <span>Simpan Uang Awal & Buka Operasional Kasir</span>
              </button>
            </form>
          </div>
        ) : (
          /* ═══════════════════════════════════════════════════════════════ */
          /* KONDISI 2: KASIR SEDANG AKTIF / UANG AWAL BERJALAN              */
          /* ═══════════════════════════════════════════════════════════════ */
          <div class="space-y-4">
            {/* Status Sesi Berjalan */}
            <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3">
              <div class="flex items-center justify-between pb-3 border-b border-slate-100">
                <div class="flex items-center gap-2">
                  <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                  <span class="text-xs font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    Kasir Aktif Berjalan
                  </span>
                </div>
                <span class="text-[11px] font-semibold text-slate-500">
                  {getHariTanggalIndo(uangAwalAktif.tanggal || uangAwalAktif.buka_pada)}
                </span>
              </div>

              <div class="grid grid-cols-2 gap-2 text-xs">
                <div class="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <span class="text-[10px] text-slate-400 font-bold block uppercase">Waktu Buka / Jam Masuk:</span>
                  <strong class="text-slate-800 text-xs block font-mono mt-0.5">
                    {formatJamDetik(uangAwalAktif.buka_pada)}
                  </strong>
                  <span class="text-[10px] text-slate-500">
                    {formatTanggalAngka(uangAwalAktif.buka_pada)}
                  </span>
                </div>

                <div class="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <span class="text-[10px] text-slate-400 font-bold block uppercase">Petugas Kasir:</span>
                  <strong class="text-slate-800 text-xs block truncate mt-0.5">
                    {uangAwalAktif.kasir_nama || 'Kasir Bertugas'}
                  </strong>
                  <span class="text-[10px] text-amber-700 font-medium">
                    Sumber: {uangAwalAktif.sumber_dana || 'Tim Keuangan'}
                  </span>
                </div>
              </div>

              {/* Rincian Pecahan jika ada */}
              {uangAwalAktif.rincian_pecahan && Object.values(uangAwalAktif.rincian_pecahan).some((v) => v > 0) && (
                <div class="p-2.5 bg-amber-50/60 rounded-xl border border-amber-200/60 text-[11px] text-amber-950">
                  <span class="font-bold block mb-1">Rincian Lembaran Uang Awal:</span>
                  <div class="flex flex-wrap gap-1.5">
                    {Object.entries(uangAwalAktif.rincian_pecahan)
                      .filter(([_, qty]) => qty > 0)
                      .map(([nom, qty]) => (
                        <span key={nom} class="px-2 py-0.5 bg-white border border-amber-200 rounded-md text-[10px] font-semibold font-mono">
                          {qty}x {formatRupiah(Number(nom))}
                        </span>
                      ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── KARTU REKAPITULASI DETAIL KEUANGAN (SESUAI REQUEST USER) ── */}
            <div class="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs space-y-3.5">
              <h3 class="text-xs font-black uppercase tracking-wider text-slate-700 pb-2 border-b border-slate-100 flex items-center justify-between">
                <span>Rekap Keuangan Transaksi Kasir</span>
                <span class="text-[10px] font-bold text-slate-500 font-mono">
                  {jumlahPesanan} Transaksi Lunas
                </span>
              </h3>

              <div class="space-y-2 text-xs">
                {/* 1. Modal Uang Awal */}
                <div class="flex items-center justify-between p-2.5 bg-amber-50/80 rounded-xl border border-amber-200/70">
                  <div>
                    <span class="font-bold text-amber-950 block">1. Modal Uang Awal Toko</span>
                    <span class="text-[10px] text-amber-700">Wajib dikembalikan ke kas/keuangan laci</span>
                  </div>
                  <strong class="text-sm font-extrabold text-amber-900 tabular-nums font-mono">
                    {formatRupiah(uangAwalAktif.kas_awal)}
                  </strong>
                </div>

                {/* 2. Pendapatan Tunai */}
                <div class="flex items-center justify-between p-2.5 bg-emerald-50/80 rounded-xl border border-emerald-200/70">
                  <div>
                    <span class="font-bold text-emerald-950 block">2. Pendapatan Bersih Tunai (+)</span>
                    <span class="text-[10px] text-emerald-700">Uang tunai fisik pembeli yang masuk ke laci</span>
                  </div>
                  <strong class="text-sm font-extrabold text-emerald-800 tabular-nums font-mono">
                    +{formatRupiah(totalTunai)}
                  </strong>
                </div>

                {/* 3. Pendapatan QRIS */}
                <div class="flex items-center justify-between p-2.5 bg-indigo-50/80 rounded-xl border border-indigo-200/70">
                  <div>
                    <span class="font-bold text-indigo-950 block">3. Pendapatan QRIS Dinamis</span>
                    <span class="text-[10px] text-indigo-700">Non-tunai, langsung masuk rekening toko</span>
                  </div>
                  <strong class="text-sm font-extrabold text-indigo-800 tabular-nums font-mono">
                    +{formatRupiah(totalQris)}
                  </strong>
                </div>

                {/* Total Omzet */}
                <div class="flex items-center justify-between pt-1 px-1 text-[11px] text-slate-500">
                  <span>Total Seluruh Omzet Penjualan (Tunai + QRIS):</span>
                  <span class="font-bold text-slate-800 tabular-nums">
                    {formatRupiah(totalTunai + totalQris)}
                  </span>
                </div>

                {/* TOTAL UANG FISIK LACI */}
                <div class="pt-2 border-t border-slate-100 flex items-center justify-between p-3 bg-slate-900 text-white rounded-xl shadow-xs">
                  <div>
                    <span class="text-xs font-bold block">Total Uang Fisik Seharusnya di Laci:</span>
                    <span class="text-[10px] text-slate-300">Modal Awal ({formatRupiah(uangAwalAktif.kas_awal)}) + Tunai ({formatRupiah(totalTunai)})</span>
                  </div>
                  <strong class="text-base font-black tabular-nums font-mono text-emerald-400">
                    {formatRupiah(uangAwalAktif.kas_awal + totalTunai)}
                  </strong>
                </div>
              </div>

              {/* Uang Setoran ke Keuangan */}
              <div class="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs">
                <span class="text-slate-500 text-[11px]">Uang Murni yang Disetor ke Tim Keuangan: </span>
                <strong class="text-slate-900 font-extrabold font-mono text-xs">
                  {formatRupiah(totalTunai)}
                </strong>
                <span class="text-[10px] text-slate-400 block mt-0.5">
                  (Modal awal {formatRupiah(uangAwalAktif.kas_awal)} tetap tersimpan di laci untuk modal besok)
                </span>
              </div>
            </div>

            {/* Form Tutup Kasir / Akhir Hari */}
            <div class="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs space-y-3.5">
              <h3 class="text-xs font-bold text-slate-900">
                Tutup Kasir & Hitung Fisik Uang Akhir:
              </h3>

              <form onSubmit={handleTutupKasir} class="space-y-3">
                <div>
                  <label class="block text-[11px] font-bold text-slate-700 mb-1">
                    Hitung Uang Fisik Aktual di Laci (Uang Awal + Tunai):
                  </label>
                  <div class="relative">
                    <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">Rp</span>
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      required
                      value={kasAkhirInput}
                      onInput={(e) => setKasAkhirInput(Number((e.target as HTMLInputElement).value) || 0)}
                      class="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-extrabold text-slate-900 tabular-nums focus:outline-hidden"
                    />
                  </div>
                </div>

                {/* Status Selisih */}
                {(() => {
                  const estimasi = uangAwalAktif.kas_awal + totalTunai;
                  const selisih = kasAkhirInput - estimasi;
                  return (
                    <div
                      class={`p-3 rounded-xl border flex items-center justify-between text-xs font-bold ${
                        selisih === 0
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : selisih < 0
                          ? 'bg-rose-50 border-rose-200 text-rose-800'
                          : 'bg-blue-50 border-blue-200 text-blue-800'
                      }`}
                    >
                      <span>Status Selisih Kas:</span>
                      <span class="font-mono text-sm">
                        {selisih === 0
                          ? '✓ Uang Pas (Sesuai)'
                          : selisih > 0
                          ? `Lebih: +${formatRupiah(selisih)}`
                          : `Kurang: -${formatRupiah(Math.abs(selisih))}`}
                      </span>
                    </div>
                  );
                })()}

                <div>
                  <label class="block text-[11px] font-bold text-slate-700 mb-1">
                    Catatan Penutupan Kasir (Opsional):
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Selisih uang pas, sudah diserahkan ke tim keuangan"
                    value={catatanTutup}
                    onInput={(e) => setCatatanTutup((e.target as HTMLInputElement).value)}
                    class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden"
                  />
                </div>

                <button
                  type="submit"
                  class="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-extrabold tracking-wide transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
                >
                  <IconCheck size={16} color="#ffffff" />
                  <span>Tutup Kasir & Simpan Rekap Harian</span>
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* BAGIAN RIWAYAT UANG AWAL & TUTUP KASIR TOKO                     */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <div class="pt-4 border-t border-slate-200">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-xs font-extrabold uppercase tracking-wider text-slate-800">
              Riwayat Uang Awal & Rekap Kasir ({riwayatUangAwal.length})
            </h3>
            <button
              type="button"
              onClick={muatDataUangAwal}
              class="text-[11px] font-bold text-slate-600 hover:text-slate-900 cursor-pointer border-none bg-transparent"
            >
              🔄 Refresh
            </button>
          </div>

          {riwayatUangAwal.length === 0 ? (
            <div class="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-400">
              Belum ada riwayat uang awal atau kasir yang ditutup.
            </div>
          ) : (
            <div class="space-y-3">
              {riwayatUangAwal.map((s) => {
                const isDetail = detailRiwayatBuka === s.id;
                const estimasi = (s.kas_awal || 0) + (s.total_tunai || 0);
                const selisih = (s.kas_akhir || 0) - estimasi;

                return (
                  <div key={s.id} class="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-2.5">
                    <div class="flex items-start justify-between gap-2 pb-2 border-b border-slate-100">
                      <div>
                        <span class="text-xs font-bold text-slate-900 block">
                          {getHariTanggalIndo(s.tanggal || s.buka_pada)}
                        </span>
                        <span class="text-[10px] text-slate-500 font-mono block">
                          Buka: {formatJamDetik(s.buka_pada)} &bull; Tutup: {formatJamDetik(s.tutup_pada)}
                        </span>
                      </div>
                      <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 shrink-0">
                        {s.kasir_nama || 'Kasir'}
                      </span>
                    </div>

                    <div class="grid grid-cols-3 gap-2 text-center text-xs py-1">
                      <div class="p-2 bg-amber-50/70 rounded-xl border border-amber-100">
                        <span class="text-[9px] text-amber-800 font-bold block uppercase">Modal Awal</span>
                        <strong class="font-mono text-[11px] text-amber-950">
                          {formatRupiah(s.kas_awal)}
                        </strong>
                      </div>
                      <div class="p-2 bg-emerald-50/70 rounded-xl border border-emerald-100">
                        <span class="text-[9px] text-emerald-800 font-bold block uppercase">Tunai Masuk</span>
                        <strong class="font-mono text-[11px] text-emerald-950">
                          +{formatRupiah(s.total_tunai || 0)}
                        </strong>
                      </div>
                      <div class="p-2 bg-indigo-50/70 rounded-xl border border-indigo-100">
                        <span class="text-[9px] text-indigo-800 font-bold block uppercase">QRIS Masuk</span>
                        <strong class="font-mono text-[11px] text-indigo-950">
                          +{formatRupiah(s.total_qris || 0)}
                        </strong>
                      </div>
                    </div>

                    <div class="flex items-center justify-between text-xs pt-1 text-slate-600">
                      <div>
                        <span class="text-[10px] text-slate-400 block">Fisik Kas Akhir:</span>
                        <strong class="font-mono text-slate-900 text-xs">
                          {formatRupiah(s.kas_akhir || 0)}
                        </strong>
                      </div>

                      <div class="text-right">
                        <span class="text-[10px] text-slate-400 block">Status Selisih:</span>
                        <span
                          class={`font-bold font-mono text-[11px] ${
                            selisih === 0
                              ? 'text-emerald-700'
                              : selisih < 0
                              ? 'text-rose-700'
                              : 'text-blue-700'
                          }`}
                        >
                          {selisih === 0
                            ? 'Uang Pas'
                            : selisih > 0
                            ? `+${formatRupiah(selisih)}`
                            : `-${formatRupiah(Math.abs(selisih))}`}
                        </span>
                      </div>
                    </div>

                    {/* Tombol Lihat Detail / Tutup */}
                    <div class="pt-1 text-right">
                      <button
                        type="button"
                        onClick={() => setDetailRiwayatBuka(isDetail ? null : s.id)}
                        class="text-[11px] font-bold text-amber-700 hover:underline cursor-pointer border-none bg-transparent"
                      >
                        {isDetail ? 'Sembunyikan Rincian ▲' : 'Lihat Waktu Detail & Rincian ▼'}
                      </button>
                    </div>

                    {isDetail && (
                      <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] space-y-2 mt-2">
                        <div>
                          <span class="text-slate-400 block text-[10px]">Waktu Buka Lengkap:</span>
                          <span class="font-medium text-slate-800">{formatWaktuLengkap(s.buka_pada)}</span>
                        </div>
                        <div>
                          <span class="text-slate-400 block text-[10px]">Waktu Tutup Lengkap:</span>
                          <span class="font-medium text-slate-800">{formatWaktuLengkap(s.tutup_pada)}</span>
                        </div>
                        <div>
                          <span class="text-slate-400 block text-[10px]">Sumber Modal:</span>
                          <span class="font-medium text-slate-800">{s.sumber_dana || 'Tim Keuangan'}</span>
                        </div>
                        {s.catatan && (
                          <div>
                            <span class="text-slate-400 block text-[10px]">Catatan:</span>
                            <span class="font-medium text-slate-800">{s.catatan}</span>
                          </div>
                        )}
                        {s.rincian_pecahan && Object.values(s.rincian_pecahan).some((q) => q > 0) && (
                          <div>
                            <span class="text-slate-400 block text-[10px] mb-1">Rincian Lembaran Modal:</span>
                            <div class="flex flex-wrap gap-1">
                              {Object.entries(s.rincian_pecahan)
                                .filter(([_, q]) => q > 0)
                                .map(([n, q]) => (
                                  <span key={n} class="px-2 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono">
                                    {q} lembar {formatRupiah(Number(n))}
                                  </span>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export const LayarShift = LayarUangAwal;
