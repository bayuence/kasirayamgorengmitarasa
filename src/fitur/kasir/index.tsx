import { useState, useEffect } from 'preact/hooks';
import { muatMenuLokal } from '../../data/menu.js';
import { muatSemuaOutlet, pilihOutletAktif, outletAktifSignal } from '../../data/outlet.js';
import type { ProdukItem, TambahanItem, KategoriItem, OutletItem } from '../../data/db.js';
import { formatRupiah } from '../../util/rupiah.js';
import {
  itemKeranjangSignal,
  totalHargaSignal,
  totalQtySignal,
  jenisPesananSignal,
  catatanPesananSignal,
  hapusItem,
  itemTerakhirDihapusSignal,
  batalkanHapusItem,
  bersihkanUndo,
} from '../../state/keranjang.js';
import {
  IconToko,
  IconCari,
  IconTutup,
  IconPlus,
  IconMinus,
  IconCheck,
  IconChevronDown,
  IconLokasi,
  IconCatatan,
  IconPiringSendok,
  IconMinumanPlaceholder,
} from '../../komponen/Icon.js';

export function LayarKasir() {
  const [produkList, setProdukList] = useState<ProdukItem[]>([]);
  const [tambahanList, setTambahanList] = useState<TambahanItem[]>([]);
  const [kategoriList, setKategoriList] = useState<KategoriItem[]>([]);
  const [kategoriAktif, setKategoriAktif] = useState<string>('Semua');
  const [loading, setLoading] = useState(true);
  const [bukaCatatan, setBukaCatatan] = useState(false);
  const [bukaRincian, setBukaRincian] = useState(false);

  // Pop-up Ganti Cabang
  const [bukaModalCabang, setBukaModalCabang] = useState(false);
  const [daftarOutlet, setDaftarOutlet] = useState<OutletItem[]>([]);

  // Pop-up Tambahan / Topping untuk item terpilih
  const [bukaToppingProdukId, setBukaToppingProdukId] = useState<string | null>(null);

  // Pencarian Cepat
  const [cariTeks, setCariTeks] = useState('');
  const [pesanSukses, setPesanSukses] = useState('');

  useEffect(() => {
    muatSemuaOutlet().then(setDaftarOutlet).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    muatMenuLokal(outletAktifSignal.value?.id).then(({ produk, tambahan, kategori }) => {
      setProdukList(produk);
      setTambahanList(tambahan);
      setKategoriList(kategori || []);
      setLoading(false);
    });
  }, [outletAktifSignal.value?.id]);

  // Timer otomatis membersihkan notifikasi undo setelah 5 detik
  useEffect(() => {
    if (itemTerakhirDihapusSignal.value) {
      const timer = setTimeout(() => {
        bersihkanUndo();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [itemTerakhirDihapusSignal.value]);

  const notifikasi = (teks: string) => {
    setPesanSukses(teks);
    setTimeout(() => setPesanSukses(''), 2500);
  };

  const handlePilihCabang = (o: OutletItem) => {
    pilihOutletAktif(o);
    setBukaModalCabang(false);
    notifikasi(`Cabang aktif: ${o.nama}`);
  };

  const matchesKategori = (p: ProdukItem, katNama: string) => {
    const k = p.kategori || p.varian || '';
    if (k.toLowerCase() === katNama.toLowerCase()) return true;
    if (katNama === 'Paket Ayam') {
      return !k || k === 'Original' || k === 'Spicy' || k.toLowerCase().includes('ayam') || p.paket?.toLowerCase().includes('paket');
    }
    if (katNama === 'Minuman') {
      return k.toLowerCase().includes('minum') || p.paket?.toLowerCase().includes('teh') || p.paket?.toLowerCase().includes('jeruk') || p.paket?.toLowerCase().includes('kopi');
    }
    if (katNama === 'Tambahan & Sambal') {
      return k.toLowerCase().includes('tambahan') || k.toLowerCase().includes('sambal') || k.toLowerCase().includes('sambel') || p.paket?.toLowerCase().includes('kremes');
    }
    if (katNama === 'Ala Carte / Satuan') {
      return k.toLowerCase().includes('ala carte') || k.toLowerCase().includes('satuan');
    }
    return false;
  };

  const produkTersaring = produkList.filter((p) => {
    const cocokKategori = kategoriAktif === 'Semua' || matchesKategori(p, kategoriAktif);
    if (!cocokKategori) return false;

    if (!cariTeks.trim()) return true;
    const q = cariTeks.toLowerCase();
    const nama = (p.paket || '').toLowerCase();
    const isi = (p.isi || '').toLowerCase();
    const kat = (p.kategori || p.varian || '').toLowerCase();
    return nama.includes(q) || isi.includes(q) || kat.includes(q);
  });

  const getQty = (produkId: string) => {
    const item = itemKeranjangSignal.value.find((i) => i.produkId === produkId);
    return item ? item.qty : 0;
  };

  const getItemKeranjang = (produkId: string) => {
    return itemKeranjangSignal.value.find((i) => i.produkId === produkId);
  };

  const handleTambah = (p: ProdukItem) => {
    bersihkanUndo();
    const existing = itemKeranjangSignal.value.find((i) => i.produkId === p.id);
    if (existing) {
      itemKeranjangSignal.value = itemKeranjangSignal.value.map((i) =>
        i.produkId === p.id ? { ...i, qty: i.qty + 1 } : i,
      );
    } else {
      itemKeranjangSignal.value = [
        ...itemKeranjangSignal.value,
        {
          produkId: p.id,
          varian: p.varian,
          paket: p.paket,
          harga: p.harga,
          qty: 1,
          tambahan: [],
        },
      ];
    }
  };

  const handleKurang = (produkId: string) => {
    const existing = itemKeranjangSignal.value.find((i) => i.produkId === produkId);
    if (!existing) return;

    if (existing.qty > 1) {
      itemKeranjangSignal.value = itemKeranjangSignal.value.map((i) =>
        i.produkId === produkId ? { ...i, qty: i.qty - 1 } : i,
      );
    } else {
      hapusItem(produkId);
    }
  };

  const toggleTambahan = (produkId: string, t: TambahanItem) => {
    const item = itemKeranjangSignal.value.find((i) => i.produkId === produkId);
    if (!item) return;

    const ada = item.tambahan.some((tb) => tb.nama === t.nama);
    const tambahanBaru = ada
      ? item.tambahan.filter((tb) => tb.nama !== t.nama)
      : [...item.tambahan, { nama: t.nama, harga: t.harga, qty: 1 }];

    itemKeranjangSignal.value = itemKeranjangSignal.value.map((i) =>
      i.produkId === produkId ? { ...i, tambahan: tambahanBaru } : i,
    );
  };

  // Thumbnail visual menu clean (Zoom-out uncropped & modern)
  const renderThumbnail = (p: ProdukItem) => {
    if (p.gambar && (p.gambar.startsWith('data:') || p.gambar.startsWith('http'))) {
      return (
        <div class="w-full h-full flex items-center justify-center bg-white p-2">
          <img
            src={p.gambar}
            alt={p.paket}
            class="max-w-full max-h-full object-contain"
            loading="lazy"
          />
        </div>
      );
    }

    const teks = `${p.kategori || ''} ${p.varian || ''} ${p.paket || ''}`.toLowerCase();
    const isMinuman = teks.includes('minum') || teks.includes('teh') || teks.includes('jeruk') || teks.includes('kopi');

    return (
      <div class="w-full h-full flex items-center justify-center bg-slate-50 text-slate-400">
        {isMinuman ? (
          <IconMinumanPlaceholder size={22} color="#94a3b8" />
        ) : (
          <IconPiringSendok size={22} color="#94a3b8" />
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div class="py-20 text-center text-slate-500 text-sm font-medium">
        <div class="inline-block animate-spin w-7 h-7 border-2 border-slate-300 border-t-slate-900 rounded-full mb-3" />
        <p>Memuat katalog menu...</p>
      </div>
    );
  }

  // Topping item aktif saat modal topping dibuka
  const produkToppingAktif = bukaToppingProdukId ? produkList.find((p) => p.id === bukaToppingProdukId) : null;
  const cartItemToppingAktif = bukaToppingProdukId ? getItemKeranjang(bukaToppingProdukId) : null;

  return (
    <div class="w-full max-w-full pb-36 bg-slate-50 min-h-screen">
      {/* ── Toast Notifikasi Cepat ── */}
      {pesanSukses && (
        <div class="fixed top-14 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-4 py-2 rounded-full text-xs font-semibold z-50 shadow-lg flex items-center gap-2">
          <IconCheck size={14} color="#22c55e" />
          <span>{pesanSukses}</span>
        </div>
      )}

      {/* ── 1. Header Bilah Cabang Toko (Sleek Minimal Bar) ── */}
      <div class="bg-white border-b border-slate-200 px-3 py-2 flex items-center justify-between gap-2 shadow-xs sticky top-0 z-30">
        <button
          type="button"
          onClick={() => setBukaModalCabang(true)}
          class="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1.5 text-left flex-1 min-w-0 transition-colors"
        >
          <div class="text-slate-700 shrink-0">
            <IconToko size={14} color="#334155" />
          </div>
          <div class="min-w-0 flex-1 overflow-hidden">
            <div class="flex items-center gap-1.5">
              {outletAktifSignal.value?.kode && (
                <span class="text-[9.5px] font-extrabold bg-slate-900 text-white px-1.5 py-0.5 rounded tracking-wider shrink-0 uppercase">
                  {outletAktifSignal.value.kode}
                </span>
              )}
              <span class="text-[11.5px] font-bold text-slate-900 truncate">
                {outletAktifSignal.value?.nama || 'Pilih Cabang Kasir'}
              </span>
            </div>
          </div>
          <IconChevronDown size={12} color="#64748b" className="shrink-0" />
        </button>

        <button
          type="button"
          onClick={() => setBukaModalCabang(true)}
          class="text-[11px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200/60 rounded-lg px-2 py-1.5 shrink-0 transition-colors flex items-center gap-1"
        >
          <span>Ganti</span>
          <IconChevronDown size={10} color="currentColor" />
        </button>
      </div>

      {/* ── 2. Search Bar & Horizontal Category Scroll ── */}
      <div class="bg-white border-b border-slate-200 pt-2 pb-1.5">
        {/* Kolom Pencarian Cepat */}
        <div class="px-3 mb-2">
          <div class="relative w-full">
            <div class="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none flex items-center justify-center">
              <IconCari size={13} color="#94a3b8" />
            </div>
            <input
              type="text"
              placeholder="Cari menu atau paket..."
              value={cariTeks}
              onInput={(e) => setCariTeks((e.target as HTMLInputElement).value)}
              style={{ paddingLeft: '30px', paddingRight: '28px' }}
              class="w-full py-1.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-lg text-[11.5px] font-medium text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all box-border"
            />
            {cariTeks && (
              <button
                type="button"
                onClick={() => setCariTeks('')}
                class="absolute right-2 top-1/2 -translate-y-1/2 bg-slate-200 hover:bg-slate-300 rounded-full w-4.5 h-4.5 flex items-center justify-center text-slate-600 transition-colors cursor-pointer"
                aria-label="Hapus pencarian"
              >
                <IconTutup size={9} color="#475569" />
              </button>
            )}
          </div>
        </div>

        {/* Tab Filter Kategori (Smooth Horizontal Swipeable Capsule Bar) */}
        <div
          class="flex gap-1.5 overflow-x-auto px-3 pb-1 no-scrollbar w-full max-w-full"
          style={{
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            touchAction: 'pan-x',
          }}
        >
          <button
            type="button"
            onClick={() => setKategoriAktif('Semua')}
            style={{
              flexShrink: 0,
              minWidth: 'auto',
              whiteSpace: 'nowrap',
              borderRadius: '9999px',
              padding: '4px 11px',
              fontSize: '11px',
              fontWeight: 700,
              border: kategoriAktif === 'Semua' ? 'none' : '1px solid #e2e8f0',
              backgroundColor: kategoriAktif === 'Semua' ? '#0f172a' : '#f1f5f9',
              color: kategoriAktif === 'Semua' ? '#ffffff' : '#475569',
              boxShadow: kategoriAktif === 'Semua' ? '0 1px 2px rgba(15,23,42,0.15)' : 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Semua ({produkList.length})
          </button>
          {kategoriList.map((k) => {
            const isAktif = kategoriAktif === k.nama;
            const count = produkList.filter((p) => matchesKategori(p, k.nama)).length;
            return (
              <button
                key={k.id}
                type="button"
                onClick={() => setKategoriAktif(k.nama)}
                style={{
                  flexShrink: 0,
                  minWidth: 'auto',
                  whiteSpace: 'nowrap',
                  borderRadius: '9999px',
                  padding: '4px 11px',
                  fontSize: '11px',
                  fontWeight: isAktif ? 700 : 600,
                  border: isAktif ? 'none' : '1px solid #e2e8f0',
                  backgroundColor: isAktif ? '#0f172a' : '#f1f5f9',
                  color: isAktif ? '#ffffff' : '#475569',
                  boxShadow: isAktif ? '0 1px 2px rgba(15,23,42,0.15)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {k.nama} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Notifikasi Undo Hapus Item ── */}
      {itemTerakhirDihapusSignal.value && (
        <div class="mx-3.5 mt-2.5 p-3 bg-white border border-slate-200 rounded-xl shadow-xs flex items-center justify-between text-xs">
          <span class="text-slate-600 font-medium">Item dihapus dari keranjang</span>
          <button
            type="button"
            onClick={batalkanHapusItem}
            class="text-blue-600 font-bold hover:underline cursor-pointer"
          >
            Urungkan
          </button>
        </div>
      )}

      {/* ── 3. Grid Menu 2 Kolom Kanan-Kiri (Ultra Compact & Modern) ── */}
      <div class="p-2.5">
        {produkTersaring.length === 0 ? (
          <div class="text-center py-14 px-4 bg-white rounded-2xl border border-dashed border-slate-300">
            <div class="w-10 h-10 mx-auto mb-2 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
              <IconCari size={18} color="#94a3b8" />
            </div>
            <p class="text-xs font-bold text-slate-800 mb-1">Menu Tidak Ditemukan</p>
            <p class="text-[11px] text-slate-500 max-w-xs mx-auto">
              Coba ganti kata kunci pencarian atau pilih tab kategori lain di atas.
            </p>
            {cariTeks && (
              <button
                type="button"
                onClick={() => setCariTeks('')}
                class="mt-2.5 text-[11px] font-semibold text-blue-600 hover:underline cursor-pointer"
              >
                Reset Pencarian
              </button>
            )}
          </div>
        ) : (
          <div class="grid grid-cols-2 gap-2">
            {produkTersaring.map((p) => {
              const qty = getQty(p.id);
              const cartItem = getItemKeranjang(p.id);

              return (
                <div
                  key={p.id}
                  class={`bg-white rounded-xl overflow-hidden border transition-all flex flex-col justify-between ${
                    qty > 0
                      ? 'border-slate-900 shadow-sm ring-1 ring-slate-900/15'
                      : 'border-slate-200 shadow-xs hover:border-slate-300'
                  }`}
                >
                  {/* Bagian Visual Gambar (Compact & Zoom-out fit) */}
                  <div class="relative w-full h-20 bg-slate-50 overflow-hidden shrink-0 border-b border-slate-100 flex items-center justify-center">
                    {renderThumbnail(p)}

                    {/* Badge Kategori Mengambang */}
                    <span class="absolute top-1.5 left-1.5 bg-slate-900/80 backdrop-blur-xs text-white text-[8px] font-bold px-1.5 py-0.5 rounded tracking-wide uppercase">
                      {p.kategori || p.varian || 'Menu'}
                    </span>

                    {/* Badge Qty Mengambang jika sudah dipesan */}
                    {qty > 0 && (
                      <span class="absolute top-1.5 right-1.5 bg-emerald-600 text-white text-[9px] font-extrabold w-4.5 h-4.5 rounded-full flex items-center justify-center shadow-xs tabular-nums">
                        {qty}
                      </span>
                    )}
                  </div>

                  {/* Konten Keterangan Menu */}
                  <div class="p-2 flex-1 flex flex-col justify-between">
                    <div>
                      <h4 class="text-[11px] font-bold text-slate-900 line-clamp-1 leading-tight">
                        {p.paket}
                      </h4>

                      {p.isi ? (
                        <p class="text-[9px] text-slate-500 line-clamp-1 mt-0.5 leading-tight">
                          {p.isi}
                        </p>
                      ) : (
                        <div class="h-2" />
                      )}

                      <div class="text-[11.5px] font-extrabold text-slate-900 mt-1 tabular-nums">
                        {formatRupiah(p.harga)}
                      </div>
                    </div>

                    {/* Tombol Aksi / Stepper di Bawah Kartu */}
                    <div class="mt-2 pt-1.5 border-t border-slate-100">
                      {qty === 0 ? (
                        <button
                          type="button"
                          onClick={() => handleTambah(p)}
                          style={{
                            width: '100%',
                            padding: '4px 6px',
                            backgroundColor: '#0f172a',
                            color: '#ffffff',
                            borderRadius: '7px',
                            fontSize: '10.5px',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '3px',
                            cursor: 'pointer',
                            border: 'none',
                            boxShadow: '0 1px 2px rgba(15,23,42,0.08)',
                          }}
                        >
                          <IconPlus size={11} color="#ffffff" />
                          <span>Tambah</span>
                        </button>
                      ) : (
                        <div>
                          <div
                            style={{
                              width: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              backgroundColor: '#0f172a',
                              color: '#ffffff',
                              borderRadius: '7px',
                              padding: '2px',
                              boxShadow: '0 1px 2px rgba(15,23,42,0.12)',
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => handleKurang(p.id)}
                              aria-label={`Kurangi ${p.paket}`}
                              style={{
                                width: '22px',
                                height: '22px',
                                borderRadius: '5px',
                                backgroundColor: '#1e293b',
                                color: '#ffffff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                border: 'none',
                                padding: 0,
                              }}
                            >
                              <IconMinus size={10} color="#ffffff" />
                            </button>
                            <span class="text-[10.5px] font-extrabold px-1 text-white tabular-nums">
                              {qty}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleTambah(p)}
                              aria-label={`Tambah ${p.paket}`}
                              style={{
                                width: '22px',
                                height: '22px',
                                borderRadius: '5px',
                                backgroundColor: '#1e293b',
                                color: '#ffffff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                border: 'none',
                                padding: 0,
                              }}
                            >
                              <IconPlus size={10} color="#ffffff" />
                            </button>
                          </div>

                          {/* Tombol Topping / Tambahan jika tersedia */}
                          {tambahanList.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setBukaToppingProdukId(p.id)}
                              style={{
                                width: '100%',
                                marginTop: '4px',
                                padding: '2px 4px',
                                borderRadius: '5px',
                                border: '1px solid #dbeafe',
                                backgroundColor: '#eff6ff',
                                color: '#1d4ed8',
                                fontSize: '9px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                textAlign: 'center',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {cartItem?.tambahan.length ? `✓ ${cartItem.tambahan.length} Tambahan` : '+ Tambahan'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Pop-Up Modal: Pilih Cabang Kasir (Modern Bottom Sheet) ── */}
      {bukaModalCabang && (
        <div class="sheet-backdrop" onClick={() => setBukaModalCabang(false)}>
          <div
            class="sheet no-scrollbar p-5 rounded-t-3xl max-w-md bg-white shadow-2xl flex flex-col max-h-[82vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div class="w-10 h-1 bg-slate-300 rounded-full mx-auto mb-3 shrink-0" />

            <div class="flex items-start justify-between mb-3 shrink-0">
              <div class="flex items-center gap-2.5">
                <div class="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
                  <IconToko size={18} color="#0f172a" />
                </div>
                <div>
                  <h3 class="text-base font-bold text-slate-900">Pilih Cabang Kasir</h3>
                  <p class="text-xs text-slate-500">Pilih lokasi outlet yang aktif melayani pesanan</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setBukaModalCabang(false)}
                class="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer border-none"
                aria-label="Tutup"
              >
                <IconTutup size={14} color="#475569" />
              </button>
            </div>

            <div class="flex-1 overflow-y-auto space-y-2 py-1 no-scrollbar">
              {daftarOutlet.length === 0 ? (
                <div class="text-center py-8 text-xs text-slate-500">
                  Belum ada cabang terdaftar di sistem.
                </div>
              ) : (
                daftarOutlet.map((o) => {
                  const isAktif = o.id === outletAktifSignal.value?.id;
                  return (
                    <div
                      key={o.id}
                      onClick={() => handlePilihCabang(o)}
                      class={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-3 ${
                        isAktif
                          ? 'border-slate-900 bg-slate-50 shadow-xs ring-1 ring-slate-900/10'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                      }`}
                    >
                      <div class="flex items-center gap-3 min-w-0">
                        <div
                          class={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                            isAktif ? 'border-slate-900 bg-slate-900' : 'border-slate-300 bg-white'
                          }`}
                        >
                          {isAktif && <div class="w-2 h-2 rounded-full bg-white" />}
                        </div>

                        <div class="min-w-0">
                          <div class="flex items-center gap-1.5 flex-wrap">
                            <span class="text-sm font-bold text-slate-900">{o.nama}</span>
                            {o.kode && (
                              <span class="text-[10px] font-bold bg-slate-900 text-white px-1.5 py-0.5 rounded tracking-wide uppercase">
                                {o.kode}
                              </span>
                            )}
                            {o.sumber === 'presensi' && (
                              <span class="text-[10px] font-semibold bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200">
                                Presensi
                              </span>
                            )}
                          </div>
                          {o.alamat && (
                            <p class="text-xs text-slate-500 flex items-center gap-1 mt-0.5 truncate">
                              <IconLokasi size={11} color="#94a3b8" />
                              <span class="truncate">{o.alamat}</span>
                            </p>
                          )}
                        </div>
                      </div>

                      {isAktif && (
                        <span class="shrink-0 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          Aktif
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div class="pt-3 mt-2 border-t border-slate-100 text-center shrink-0">
              <a
                href="#/outlet"
                onClick={() => setBukaModalCabang(false)}
                class="text-xs font-bold text-blue-600 hover:underline inline-flex items-center gap-1"
              >
                <span>Kelola atau Tambah Cabang Baru</span>
                <span class="text-sm">›</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ── Pop-Up Modal: Pilih Tambahan / Topping untuk Menu ── */}
      {bukaToppingProdukId && produkToppingAktif && (
        <div class="sheet-backdrop z-40" onClick={() => setBukaToppingProdukId(null)}>
          <div
            class="sheet no-scrollbar p-5 rounded-t-3xl max-w-md bg-white shadow-2xl flex flex-col max-h-[75vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div class="w-10 h-1 bg-slate-300 rounded-full mx-auto mb-3 shrink-0" />

            <div class="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 shrink-0">
              <div>
                <h3 class="text-sm font-bold text-slate-900">Pilihan Tambahan / Sambal</h3>
                <p class="text-xs text-slate-500 truncate max-w-xs">{produkToppingAktif.paket}</p>
              </div>
              <button
                type="button"
                onClick={() => setBukaToppingProdukId(null)}
                class="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 cursor-pointer border-none"
              >
                <IconTutup size={14} color="#475569" />
              </button>
            </div>

            <div class="flex-1 overflow-y-auto space-y-2 py-1 no-scrollbar">
              {tambahanList.map((t) => {
                const isSelected = cartItemToppingAktif?.tambahan.some((tb) => tb.nama === t.nama);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleTambahan(produkToppingAktif.id, t)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '12px',
                      border: isSelected ? '1.5px solid #0f172a' : '1px solid #e2e8f0',
                      backgroundColor: isSelected ? '#f8fafc' : '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                    }}
                  >
                    <div class="flex items-center gap-2">
                      <div
                        style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '4px',
                          backgroundColor: isSelected ? '#0f172a' : '#f1f5f9',
                          border: isSelected ? 'none' : '1px solid #cbd5e1',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {isSelected && <IconCheck size={11} color="#ffffff" />}
                      </div>
                      <span class="text-xs font-bold text-slate-900">{t.nama}</span>
                    </div>
                    <span class="text-xs font-extrabold text-slate-900 tabular-nums">
                      +{formatRupiah(t.harga)}
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setBukaToppingProdukId(null)}
              style={{
                marginTop: '12px',
                width: '100%',
                padding: '10px',
                backgroundColor: '#0f172a',
                color: '#ffffff',
                borderRadius: '12px',
                fontWeight: 700,
                fontSize: '12px',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Selesai Memilih
            </button>
          </div>
        </div>
      )}

      {/* ── Dialog Catatan Pesanan ── */}
      {bukaCatatan && (
        <div class="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div class="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2 text-slate-900">
                <IconCatatan size={16} color="#0f172a" />
                <h3 class="text-sm font-bold">Catatan Pesanan</h3>
              </div>
              <button
                type="button"
                onClick={() => setBukaCatatan(false)}
                class="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 border-none cursor-pointer"
              >
                <IconTutup size={12} color="#475569" />
              </button>
            </div>
            <p class="text-xs text-slate-500 mb-2">Tuliskan permintaan khusus pelanggan (misal: sambal dipisah, paha bawah):</p>
            <textarea
              rows={3}
              placeholder="Ketik catatan di sini..."
              value={catatanPesananSignal.value}
              onInput={(e) => {
                catatanPesananSignal.value = (e.target as HTMLTextAreaElement).value;
              }}
              class="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium text-slate-900 focus:outline-hidden focus:border-slate-900 focus:bg-white transition-all mb-3 box-border"
            />
            <button
              type="button"
              onClick={() => setBukaCatatan(false)}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: '#0f172a',
                color: '#ffffff',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Simpan Catatan
            </button>
          </div>
        </div>
      )}

      {/* ── Bottom Sheet Rincian Keranjang ── */}
      {bukaRincian && (
        <div class="sheet-backdrop z-45" onClick={() => setBukaRincian(false)}>
          <div
            class="sheet no-scrollbar p-5 rounded-t-3xl max-w-md bg-white shadow-2xl flex flex-col max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div class="w-10 h-1 bg-slate-300 rounded-full mx-auto mb-3 shrink-0" />

            <div class="flex items-center justify-between mb-3 pb-3 border-b border-slate-100 shrink-0">
              <div>
                <h3 class="text-base font-bold text-slate-900">Rincian Keranjang</h3>
                <span class="text-xs text-slate-500">
                  {totalQtySignal.value} Item Dipesan
                </span>
              </div>
              <button
                type="button"
                onClick={() => setBukaRincian(false)}
                class="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 border-none cursor-pointer"
              >
                <IconTutup size={14} color="#475569" />
              </button>
            </div>

            <div class="flex-1 overflow-y-auto space-y-2 py-1 no-scrollbar">
              {itemKeranjangSignal.value.map((item) => {
                const totalTambahan = item.tambahan.reduce((sum, t) => sum + t.harga * t.qty, 0);
                const subtotal = (item.harga + totalTambahan) * item.qty;

                return (
                  <div
                    key={item.produkId}
                    class="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <strong class="font-bold text-slate-900 block">
                        {item.qty}x {item.paket}
                      </strong>
                      {item.tambahan.length > 0 && (
                        <span class="text-[11px] text-slate-500 block mt-0.5">
                          + {item.tambahan.map((t) => t.nama).join(', ')}
                        </span>
                      )}
                    </div>
                    <div class="text-right shrink-0">
                      <div class="font-bold text-slate-900 tabular-nums">
                        {formatRupiah(subtotal)}
                      </div>
                      <button
                        type="button"
                        onClick={() => hapusItem(item.produkId)}
                        class="text-[11px] font-semibold text-rose-600 hover:underline mt-0.5 block border-none bg-transparent cursor-pointer"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div class="pt-3 mt-2 border-t border-slate-100 flex items-center justify-between shrink-0">
              <span class="text-xs font-semibold text-slate-600">Total Pembayaran:</span>
              <strong class="text-base font-extrabold text-slate-900 tabular-nums">
                {formatRupiah(totalHargaSignal.value)}
              </strong>
            </div>

            <button
              type="button"
              style={{
                marginTop: '12px',
                width: '100%',
                padding: '12px',
                backgroundColor: '#0f172a',
                color: '#ffffff',
                borderRadius: '12px',
                fontWeight: 700,
                fontSize: '13px',
                border: 'none',
                cursor: 'pointer',
              }}
              onClick={() => {
                setBukaRincian(false);
                window.location.hash = '#/bayar';
              }}
            >
              Lanjut ke Pembayaran ›
            </button>
          </div>
        </div>
      )}

      {/* ── Bilah Keranjang Melekat di Bawah (Floating Action Bar) ── */}
      {totalQtySignal.value > 0 && (
        <div class="bottom-bar">
          <div class="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setBukaRincian(true)}
              style={{
                textAlign: 'left',
                cursor: 'pointer',
                padding: 0,
                border: 'none',
                background: 'transparent',
              }}
            >
              <div class="text-xs font-extrabold text-slate-900">
                {totalQtySignal.value} Item
              </div>
              <span class="text-[11px] text-blue-600 underline font-semibold block">
                Lihat Rincian Keranjang
              </span>
            </button>

            <button
              type="button"
              onClick={() => setBukaCatatan(true)}
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: '#334155',
                backgroundColor: '#f1f5f9',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '5px 8px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer',
              }}
            >
              <IconCatatan size={12} color="#475569" />
              <span>{catatanPesananSignal.value ? 'Catatan ✓' : 'Catatan'}</span>
            </button>

            <span class="text-sm font-extrabold text-slate-900 tabular-nums">
              {formatRupiah(totalHargaSignal.value)}
            </span>
          </div>

          <button
            type="button"
            style={{
              width: '100%',
              marginTop: '10px',
              padding: '12px',
              backgroundColor: '#0f172a',
              color: '#ffffff',
              borderRadius: '12px',
              fontSize: '13px',
              fontWeight: 800,
              boxShadow: '0 2px 8px rgba(15,23,42,0.2)',
              cursor: 'pointer',
              border: 'none',
            }}
            onClick={() => {
              window.location.hash = '#/bayar';
            }}
          >
            Lanjut Bayar ›
          </button>
        </div>
      )}
    </div>
  );
}
