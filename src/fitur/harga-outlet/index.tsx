import { useState, useEffect } from 'preact/hooks';
import {
  muatProdukDenganHargaOutlet,
  muatSemuaKategori,
  hitungKeuntungan,
  sinkronkanMenuDariSupabase,
  type ProdukDenganHargaOutlet,
} from '../../data/menu.js';
import {
  muatSemuaOutlet,
  simpanHargaProdukPerOutlet,
  hapusHargaKhususProdukOutlet,
  outletAktifSignal,
} from '../../data/outlet.js';
import { formatRupiah } from '../../util/rupiah.js';
import type { OutletItem, KategoriItem } from '../../data/db.js';

export function LayarHargaOutlet() {
  const [daftarOutlet, setDaftarOutlet] = useState<OutletItem[]>([]);
  const [outletTerpilih, setOutletTerpilih] = useState<string>('');
  const [daftarKategori, setDaftarKategori] = useState<KategoriItem[]>([]);
  const [kategoriFilter, setKategoriFilter] = useState<string>('semua');
  const [produkList, setProdukList] = useState<ProdukDenganHargaOutlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [pesanSukses, setPesanSukses] = useState('');

  // Draft input nominal { [produkId]: string }
  const [draftHarga, setDraftHarga] = useState<Record<string, string>>({});
  // Draft ketersediaan outlet { [produkId]: boolean }
  const [draftAktif, setDraftAktif] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Jalankan background sync agar data kategori dan HPP terbaru dari server terunduh
    sinkronkanMenuDariSupabase().catch(() => {});

    Promise.all([muatSemuaOutlet(), muatSemuaKategori()]).then(([outlets, kategoris]) => {
      setDaftarOutlet(outlets);
      setDaftarKategori(kategoris);

      const hash = window.location.hash;
      const match = hash.match(/outlet=([^&]+)/);
      const urlOutletId = match ? match[1] : null;

      const targetId = urlOutletId || outletAktifSignal.value?.id || (outlets[0] ? outlets[0].id : '');
      setOutletTerpilih(targetId);

      if (targetId) {
        muatDataHarga(targetId);
      }
    });
  }, []);

  const muatDataHarga = async (outletId: string) => {
    setLoading(true);
    try {
      const data = await muatProdukDenganHargaOutlet(outletId);
      setProdukList(data);

      const draft: Record<string, string> = {};
      const aktifMap: Record<string, boolean> = {};
      for (const item of data) {
        draft[item.produk.id] = item.hargaKhusus !== null ? String(item.hargaKhusus) : '';
        aktifMap[item.produk.id] = item.aktifDiOutlet;
      }
      setDraftHarga(draft);
      setDraftAktif(aktifMap);
    } catch (e) {
      console.warn('Gagal muat harga outlet:', e);
    } finally {
      setLoading(false);
    }
  };

  const notifikasi = (teks: string) => {
    setPesanSukses(teks);
    setTimeout(() => setPesanSukses(''), 3000);
  };

  const handleChangeOutlet = (outletId: string) => {
    setOutletTerpilih(outletId);
    muatDataHarga(outletId);
  };

  const handleSimpanItem = async (produkId: string, namaProduk: string) => {
    if (!outletTerpilih) return;
    const nominalRaw = draftHarga[produkId];
    const isAktif = draftAktif[produkId] ?? true;

    if (!nominalRaw || nominalRaw.trim() === '') {
      if (!isAktif) {
        const item = produkList.find((p) => p.produk.id === produkId);
        if (item) {
          await simpanHargaProdukPerOutlet(outletTerpilih, produkId, item.produk.harga, false);
          notifikasi(`Menu "${namaProduk}" dinonaktifkan di cabang ini`);
        }
      } else {
        await hapusHargaKhususProdukOutlet(outletTerpilih, produkId);
        notifikasi(`Harga "${namaProduk}" kembali mengikuti harga pusat`);
      }
    } else {
      const nominal = Number(nominalRaw);
      if (isNaN(nominal) || nominal < 0) {
        alert('Masukkan nominal harga yang valid.');
        return;
      }
      await simpanHargaProdukPerOutlet(outletTerpilih, produkId, nominal, isAktif);
      notifikasi(`Harga "${namaProduk}" disimpan untuk cabang ini`);
    }

    await muatDataHarga(outletTerpilih);
  };

  const handleReset = async (produkId: string, namaProduk: string) => {
    if (!outletTerpilih) return;
    await hapusHargaKhususProdukOutlet(outletTerpilih, produkId);
    notifikasi(`Harga "${namaProduk}" dikembalikan sesuai harga pusat`);
    await muatDataHarga(outletTerpilih);
  };

  const outletObj = daftarOutlet.find((o) => o.id === outletTerpilih);

  // Helper pencocokan kategori yang toleran
  const matchesKategori = (produk: any, katNama: string) => {
    const k = produk.kategori || produk.varian || '';
    if (k.toLowerCase() === katNama.toLowerCase()) return true;
    if (katNama === 'Paket Ayam') {
      return !k || k === 'Original' || k === 'Spicy' || k.toLowerCase().includes('ayam') || produk.paket?.toLowerCase().includes('paket');
    }
    if (katNama === 'Minuman') {
      return k.toLowerCase().includes('minum') || produk.paket?.toLowerCase().includes('teh') || produk.paket?.toLowerCase().includes('jeruk');
    }
    if (katNama === 'Tambahan & Sambal') {
      return k.toLowerCase().includes('tambahan') || k.toLowerCase().includes('sambal') || produk.paket?.toLowerCase().includes('kremes');
    }
    return false;
  };

  // Filter daftar menu
  const listTersaring = produkList.filter(({ produk }) => {
    if (kategoriFilter === 'semua') return true;
    return matchesKategori(produk, kategoriFilter);
  });

  return (
    <div
      style={{
        padding: '12px 14px 90px',
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        overflowX: 'hidden',
      }}
    >
      {/* ── Top Bar Navigasi ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <a
          href="#/kasir"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            fontSize: '0.8125rem',
            fontWeight: 600,
            color: '#64748b',
            textDecoration: 'none',
            padding: '4px 0',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          <span>Kembali ke Kasir</span>
        </a>

        <a
          href="#/outlet"
          style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: '#2563eb',
            textDecoration: 'none',
          }}
        >
          Daftar Cabang ›
        </a>
      </div>

      {/* ── Header Halaman ── */}
      <div style={{ marginBottom: '14px' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 4px', color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1.25 }}>
          Atur Menu & Harga per Toko
        </h2>
        <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0 0 10px', lineHeight: 1.4 }}>
          Sesuaikan harga jual, modal HPP, margin, dan ketersediaan menu tiap cabang
        </p>

        {/* Tombol Akses Master Menu */}
        <a
          href="#/produk"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            fontSize: '0.75rem',
            fontWeight: 600,
            color: '#0f172a',
            textDecoration: 'none',
            boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>🏷️</span>
            <span>Buka Master Menu, Kategori & Foto</span>
          </div>
          <span style={{ color: '#64748b' }}>Kelola ›</span>
        </a>
      </div>

      {/* ── Alert Pesan Sukses ── */}
      {pesanSukses && (
        <div
          style={{
            padding: '9px 12px',
            background: '#f0fdf4',
            color: '#15803d',
            borderRadius: '8px',
            fontSize: '0.75rem',
            fontWeight: 600,
            marginBottom: '14px',
            border: '1px solid #bbf7d0',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>{pesanSukses}</span>
        </div>
      )}

      {daftarOutlet.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '30px 16px',
            background: '#ffffff',
            border: '1px dashed #cbd5e1',
            borderRadius: '12px',
          }}
        >
          <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>
            Belum ada cabang toko yang didaftarkan
          </p>
          <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0 0 14px', lineHeight: 1.4 }}>
            Daftarkan lokasi cabang toko terlebih dahulu sebelum mengatur perbedaan harga.
          </p>
          <a
            href="#/outlet"
            style={{
              display: 'inline-flex',
              padding: '8px 16px',
              background: '#0f172a',
              color: '#ffffff',
              borderRadius: '8px',
              fontSize: '0.75rem',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            + Daftarkan Cabang Baru
          </a>
        </div>
      ) : (
        <>
          {/* ── Kotak Pemilih Toko (Pintar & Terstruktur) ── */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '12px',
              marginBottom: '14px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              boxSizing: 'border-box',
              width: '100%',
              maxWidth: '100%',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                PILIH CABANG TOKO:
              </label>
              {outletObj?.kode && (
                <span style={{ fontSize: '0.625rem', fontWeight: 700, background: '#0f172a', color: '#ffffff', padding: '1px 6px', borderRadius: '4px' }}>
                  KODE: {outletObj.kode}
                </span>
              )}
            </div>

            <select
              value={outletTerpilih}
              onChange={(e) => handleChangeOutlet((e.target as HTMLSelectElement).value)}
              style={{
                width: '100%',
                maxWidth: '100%',
                padding: '10px',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                background: '#f8fafc',
                fontSize: '0.875rem',
                fontWeight: 700,
                color: '#0f172a',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            >
              {daftarOutlet.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nama} ({o.kode}) {o.sumber === 'presensi' ? '• Presensi' : ''} {o.id === outletAktifSignal.value?.id ? '★ Kasir Aktif' : ''}
                </option>
              ))}
            </select>

            <p style={{ fontSize: '0.6875rem', color: '#64748b', margin: '6px 0 0', lineHeight: 1.35 }}>
              💡 Kosongkan harga khusus jika ingin memakai <strong>Harga Dasar Pusat</strong>.
            </p>
          </div>

          {/* ── Filter Bar Kategori (Pills Horizontal Smooth) ── */}
          <div
            style={{
              display: 'flex',
              gap: '6px',
              overflowX: 'auto',
              paddingBottom: '8px',
              marginBottom: '12px',
              width: '100%',
              maxWidth: '100%',
              scrollbarWidth: 'none',
              boxSizing: 'border-box',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            <button
              type="button"
              onClick={() => setKategoriFilter('semua')}
              style={{
                padding: '6px 12px',
                borderRadius: '999px',
                border: '1px solid',
                borderColor: kategoriFilter === 'semua' ? '#0f172a' : '#cbd5e1',
                background: kategoriFilter === 'semua' ? '#0f172a' : '#ffffff',
                color: kategoriFilter === 'semua' ? '#ffffff' : '#475569',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                minHeight: '30px',
                flexShrink: 0,
              }}
            >
              Semua ({produkList.length})
            </button>
            {daftarKategori.map((k) => {
              const count = produkList.filter(({ produk }) => matchesKategori(produk, k.nama)).length;
              const isSelected = kategoriFilter === k.nama;
              return (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => setKategoriFilter(k.nama)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '999px',
                    border: '1px solid',
                    borderColor: isSelected ? '#0f172a' : '#cbd5e1',
                    background: isSelected ? '#0f172a' : '#ffffff',
                    color: isSelected ? '#ffffff' : '#475569',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    minHeight: '30px',
                    flexShrink: 0,
                  }}
                >
                  {k.nama} ({count})
                </button>
              );
            })}
          </div>

          {/* ── Daftar Menu Cabang ── */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8', fontSize: '0.8125rem' }}>
              Memuat menu cabang...
            </div>
          ) : listTersaring.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '30px 16px',
                background: '#ffffff',
                border: '1px dashed #cbd5e1',
                borderRadius: '12px',
              }}
            >
              <p style={{ fontSize: '0.8125rem', color: '#64748b', margin: 0 }}>
                Tidak ada menu pada kategori ini.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
              {listTersaring.map(({ produk, hargaKhusus, hppEfektif, hargaEfektif }) => {
                const nominalInput = draftHarga[produk.id] ?? '';
                const isAktifToko = draftAktif[produk.id] ?? true;
                const isCustom = hargaKhusus !== null;

                // Live calculation dari input
                const hargaPakai = nominalInput.trim() !== '' ? Number(nominalInput) : hargaEfektif;
                const liveCalc = hitungKeuntungan(hargaPakai, hppEfektif);

                return (
                  <div
                    key={produk.id}
                    style={{
                      background: '#ffffff',
                      border: isCustom ? '1.5px solid #93c5fd' : '1px solid #e2e8f0',
                      borderRadius: '12px',
                      padding: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      opacity: isAktifToko ? 1 : 0.65,
                      boxShadow: isCustom ? '0 2px 6px rgba(59,130,246,0.06)' : '0 1px 2px rgba(0,0,0,0.02)',
                      width: '100%',
                      maxWidth: '100%',
                      boxSizing: 'border-box',
                    }}
                  >
                    {/* Baris 1: Header Produk + Kategori Badge + Status */}
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', width: '100%' }}>
                      <div
                        style={{
                          width: '46px',
                          height: '46px',
                          borderRadius: '8px',
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          overflow: 'hidden',
                          flexShrink: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {produk.gambar ? (
                          <img src={produk.gambar} alt={produk.paket} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <span style={{ fontSize: '1.25rem' }}>🍗</span>
                        )}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap', marginBottom: '2px' }}>
                          <span
                            style={{
                              fontSize: '0.625rem',
                              fontWeight: 700,
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              padding: '1px 5px',
                              borderRadius: '3px',
                              border: '1px solid #dbeafe',
                            }}
                          >
                            {produk.kategori || produk.varian || 'Menu'}
                          </span>
                          <h4 style={{ fontSize: '0.875rem', fontWeight: 700, margin: 0, color: '#0f172a', lineHeight: 1.3 }}>
                            {produk.paket}
                          </h4>
                        </div>

                        {produk.isi && (
                          <p style={{ fontSize: '0.6875rem', color: '#64748b', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {produk.isi}
                          </p>
                        )}
                      </div>

                      {/* Status Tag */}
                      <span
                        style={{
                          fontSize: '0.625rem',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: isCustom ? '#eff6ff' : '#f8fafc',
                          color: isCustom ? '#1d4ed8' : '#64748b',
                          border: `1px solid ${isCustom ? '#bfdbfe' : '#e2e8f0'}`,
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                        }}
                      >
                        {isCustom ? 'Khusus' : 'Pusat'}
                      </span>
                    </div>

                    {/* Baris 2: Komparasi Finansial 3 Kolom */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        padding: '6px 8px',
                        gap: '4px',
                        width: '100%',
                        boxSizing: 'border-box',
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: '0.625rem', color: '#64748b', fontWeight: 500 }}>
                          Modal HPP
                        </span>
                        <strong style={{ fontSize: '0.75rem', color: '#334155', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {formatRupiah(hppEfektif)}
                        </strong>
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: '0.625rem', color: '#64748b', fontWeight: 500 }}>
                          Harga Pusat
                        </span>
                        <strong style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {formatRupiah(produk.harga)}
                        </strong>
                      </div>

                      <div style={{ minWidth: 0, textAlign: 'right' }}>
                        <span style={{ display: 'block', fontSize: '0.625rem', color: '#64748b', fontWeight: 500 }}>
                          Laba Toko
                        </span>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: liveCalc.laba >= 0 ? '#15803d' : '#b91c1c' }}>
                            +{formatRupiah(liveCalc.laba)}
                          </span>
                          <span
                            style={{
                              fontSize: '0.5625rem',
                              fontWeight: 700,
                              padding: '1px 3px',
                              borderRadius: '3px',
                              background: liveCalc.marginPersen >= 30 ? '#dcfce7' : liveCalc.marginPersen >= 10 ? '#fef9c3' : '#fee2e2',
                              color: liveCalc.marginPersen >= 30 ? '#15803d' : liveCalc.marginPersen >= 10 ? '#854d0e' : '#b91c1c',
                            }}
                          >
                            {liveCalc.marginPersen}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Baris 3: Input Harga Khusus Toko + Tombol Simpan */}
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', width: '100%', boxSizing: 'border-box' }}>
                      <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>
                          Rp
                        </span>
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder={`Pusat: ${produk.harga}`}
                          value={nominalInput}
                          onInput={(e) => {
                            const val = (e.target as HTMLInputElement).value.replace(/\D/g, '');
                            setDraftHarga({ ...draftHarga, [produk.id]: val });
                          }}
                          style={{
                            width: '100%',
                            maxWidth: '100%',
                            padding: '7px 8px 7px 28px',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            fontSize: '0.8125rem',
                            fontWeight: 700,
                            color: '#0f172a',
                            background: '#f8fafc',
                            boxSizing: 'border-box',
                            outline: 'none',
                          }}
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSimpanItem(produk.id, produk.paket)}
                        style={{
                          padding: '7px 12px',
                          background: '#0f172a',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          minHeight: '34px',
                          minWidth: 'auto',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                        }}
                      >
                        Simpan
                      </button>

                      {isCustom && (
                        <button
                          type="button"
                          onClick={() => handleReset(produk.id, produk.paket)}
                          style={{
                            padding: '7px 8px',
                            background: '#ffffff',
                            color: '#dc2626',
                            border: '1px solid #fecaca',
                            borderRadius: '6px',
                            fontSize: '0.6875rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            minHeight: '34px',
                            minWidth: 'auto',
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                          }}
                        >
                          Reset
                        </button>
                      )}
                    </div>

                    {/* Baris 4: Ketersediaan di Cabang Ini */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '2px', fontSize: '0.6875rem' }}>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#475569', fontWeight: 600, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={isAktifToko}
                          onChange={(e) => {
                            setDraftAktif({ ...draftAktif, [produk.id]: (e.target as HTMLInputElement).checked });
                          }}
                          style={{ cursor: 'pointer' }}
                        />
                        <span>Tersedia untuk dipesan di cabang ini</span>
                      </label>

                      <span style={{ color: isAktifToko ? '#16a34a' : '#94a3b8', fontWeight: 600 }}>
                        {isAktifToko ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
