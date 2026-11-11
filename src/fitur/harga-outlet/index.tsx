import { useState, useEffect } from 'preact/hooks';
import {
  muatProdukDenganHargaOutlet,
  muatSemuaKategori,
  hitungKeuntungan,
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
        // Jika harga ikut pusat tapi dinonaktifkan di toko ini
        const item = produkList.find((p) => p.produk.id === produkId);
        if (item) {
          await simpanHargaProdukPerOutlet(outletTerpilih, produkId, item.produk.harga, false);
          notifikasi(`Menu "${namaProduk}" dinonaktifkan untuk toko ini`);
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
      notifikasi(`Pengaturan "${namaProduk}" berhasil disimpan untuk toko ini`);
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

  // Filter daftar menu
  const listTersaring = produkList.filter(({ produk }) => {
    if (kategoriFilter === 'semua') return true;
    return (produk.kategori || produk.varian) === kategoriFilter;
  });

  return (
    <div style={{ padding: '16px 16px 80px', maxWidth: '640px', margin: '0 auto' }}>
      {/* Back link */}
      <a
        href="#/kasir"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '0.8125rem',
          fontWeight: 600,
          color: '#64748b',
          textDecoration: 'none',
          marginBottom: '14px',
          padding: '2px 0',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
        <span>Kembali ke Kasir</span>
      </a>

      {/* Header Halaman */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.375rem', fontWeight: 800, margin: '0 0 4px', color: '#0f172a', letterSpacing: '-0.025em' }}>
            Atur Menu & Harga per Toko
          </h2>
          <p style={{ fontSize: '0.8125rem', color: '#64748b', margin: 0, lineHeight: 1.4 }}>
            Atur kategori, harga modal HPP, margin keuntungan, dan harga jual tiap cabang
          </p>
        </div>

        <a
          href="#/produk"
          style={{
            padding: '9px 14px',
            background: '#ffffff',
            color: '#0f172a',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            fontSize: '0.8125rem',
            fontWeight: 600,
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            minHeight: '38px',
          }}
        >
          <span>🏷️ Master Menu & Kategori</span>
          <span>›</span>
        </a>
      </div>

      {pesanSukses && (
        <div
          style={{
            padding: '10px 14px',
            background: '#f0fdf4',
            color: '#15803d',
            borderRadius: '8px',
            fontSize: '0.8125rem',
            fontWeight: 600,
            marginBottom: '16px',
            border: '1px solid #bbf7d0',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>{pesanSukses}</span>
        </div>
      )}

      {daftarOutlet.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '36px 20px',
            background: '#ffffff',
            border: '1px dashed #cbd5e1',
            borderRadius: '14px',
          }}
        >
          <p style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>
            Belum ada cabang toko yang didaftarkan
          </p>
          <p style={{ fontSize: '0.8125rem', color: '#64748b', margin: '0 0 16px', lineHeight: 1.4 }}>
            Daftarkan cabang toko terlebih dahulu sebelum mengatur harga khusus per toko.
          </p>
          <a
            href="#/outlet"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 18px',
              background: '#0f172a',
              color: '#ffffff',
              borderRadius: '8px',
              fontSize: '0.8125rem',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            <span>Buka Lokasi & Cabang Toko</span>
            <span>›</span>
          </a>
        </div>
      ) : (
        <>
          {/* Kotak Pemilih Toko */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '14px',
              padding: '16px',
              marginBottom: '16px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            }}
          >
            <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
              PILIH TOKO / CABANG:
            </label>
            <select
              value={outletTerpilih}
              onChange={(e) => handleChangeOutlet((e.target as HTMLSelectElement).value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                background: '#f8fafc',
                fontSize: '0.9375rem',
                fontWeight: 700,
                color: '#0f172a',
                outline: 'none',
              }}
            >
              {daftarOutlet.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nama} ({o.kode}) {o.sumber === 'presensi' ? '• Presensi' : ''} {o.id === outletAktifSignal.value?.id ? '★ Kasir Aktif di Sini' : ''}
                </option>
              ))}
            </select>

            <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px', fontSize: '0.75rem', color: '#64748b' }}>
              <span>
                💡 Cabang: <strong style={{ color: '#0f172a' }}>{outletObj?.nama || 'Toko'}</strong>
              </span>
              <span style={{ color: '#475569', fontWeight: 600 }}>
                Kosongkan harga khusus jika ingin mengikuti harga master pusat
              </span>
            </div>
          </div>

          {/* Filter Bar Kategori (Pills) */}
          <div
            style={{
              display: 'flex',
              gap: '6px',
              overflowX: 'auto',
              paddingBottom: '10px',
              marginBottom: '14px',
              scrollbarWidth: 'none',
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
              }}
            >
              Semua ({produkList.length})
            </button>
            {daftarKategori.map((k) => {
              const count = produkList.filter(({ produk }) => (produk.kategori || produk.varian) === k.nama).length;
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
                  }}
                >
                  {k.nama} ({count})
                </button>
              );
            })}
          </div>

          {/* Daftar Menu Cabang */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8', fontSize: '0.875rem' }}>
              Memuat data menu & harga cabang...
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
                      padding: '14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      opacity: isAktifToko ? 1 : 0.6,
                      boxShadow: isCustom ? '0 2px 8px rgba(59,130,246,0.06)' : '0 1px 2px rgba(0,0,0,0.02)',
                    }}
                  >
                    {/* Baris 1: Foto + Info Menu + Badge Kategori */}
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                      <div
                        style={{
                          width: '52px',
                          height: '52px',
                          borderRadius: '10px',
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
                          <span style={{ fontSize: '1.4rem' }}>🍗</span>
                        )}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '2px' }}>
                          <span
                            style={{
                              fontSize: '0.6875rem',
                              fontWeight: 700,
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              border: '1px solid #dbeafe',
                            }}
                          >
                            {produk.kategori || produk.varian || 'Menu'}
                          </span>
                          <h4 style={{ fontSize: '0.9375rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                            {produk.paket}
                          </h4>
                        </div>

                        {produk.isi && (
                          <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '2px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {produk.isi}
                          </p>
                        )}
                      </div>

                      {/* Badge Status Harga */}
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '4px',
                          background: isCustom ? '#eff6ff' : '#f8fafc',
                          color: isCustom ? '#1d4ed8' : '#64748b',
                          border: `1px solid ${isCustom ? '#bfdbfe' : '#e2e8f0'}`,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {isCustom ? 'Harga Khusus' : 'Sesuai Pusat'}
                      </span>
                    </div>

                    {/* Baris 2: Komparasi Finansial (HPP, Harga Pusat, Keuntungan & Margin Toko) */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr 1.2fr',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        gap: '8px',
                      }}
                    >
                      <div>
                        <span style={{ display: 'block', fontSize: '0.6875rem', color: '#64748b', fontWeight: 500 }}>
                          HPP Modal
                        </span>
                        <strong style={{ fontSize: '0.8125rem', color: '#334155' }}>
                          {formatRupiah(hppEfektif)}
                        </strong>
                      </div>

                      <div>
                        <span style={{ display: 'block', fontSize: '0.6875rem', color: '#64748b', fontWeight: 500 }}>
                          Harga Pusat
                        </span>
                        <strong style={{ fontSize: '0.8125rem', color: '#64748b' }}>
                          {formatRupiah(produk.harga)}
                        </strong>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <span style={{ display: 'block', fontSize: '0.6875rem', color: '#64748b', fontWeight: 500 }}>
                          Keuntungan Toko
                        </span>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              color: liveCalc.laba >= 0 ? '#15803d' : '#b91c1c',
                            }}
                          >
                            +{formatRupiah(liveCalc.laba)}
                          </span>
                          <span
                            style={{
                              fontSize: '0.6875rem',
                              fontWeight: 700,
                              padding: '1px 5px',
                              borderRadius: '4px',
                              background: liveCalc.marginPersen >= 30 ? '#dcfce7' : liveCalc.marginPersen >= 10 ? '#fef9c3' : '#fee2e2',
                              color: liveCalc.marginPersen >= 30 ? '#15803d' : liveCalc.marginPersen >= 10 ? '#854d0e' : '#b91c1c',
                            }}
                          >
                            {liveCalc.marginPersen}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Baris 3: Input Harga Jual Toko + Toggle Aktif + Simpan */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: '150px', position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.8125rem', color: '#94a3b8', fontWeight: 600 }}>
                          Rp
                        </span>
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder={`Harga pusat: ${produk.harga}`}
                          value={nominalInput}
                          onInput={(e) => {
                            const val = (e.target as HTMLInputElement).value.replace(/\D/g, '');
                            setDraftHarga({ ...draftHarga, [produk.id]: val });
                          }}
                          style={{
                            width: '100%',
                            padding: '8px 10px 8px 32px',
                            border: '1px solid #cbd5e1',
                            borderRadius: '8px',
                            fontSize: '0.875rem',
                            fontWeight: 700,
                            color: '#0f172a',
                            background: '#f8fafc',
                            boxSizing: 'border-box',
                            outline: 'none',
                          }}
                        />
                      </div>

                      {/* Checkbox Ketersediaan di Toko */}
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 600, color: '#475569', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={isAktifToko}
                          onChange={(e) => {
                            setDraftAktif({ ...draftAktif, [produk.id]: (e.target as HTMLInputElement).checked });
                          }}
                          style={{ cursor: 'pointer' }}
                        />
                        <span>Tersedia</span>
                      </label>

                      <button
                        type="button"
                        onClick={() => handleSimpanItem(produk.id, produk.paket)}
                        style={{
                          padding: '8px 14px',
                          background: '#0f172a',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '0.8125rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          minHeight: '36px',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Simpan
                      </button>

                      {isCustom && (
                        <button
                          type="button"
                          onClick={() => handleReset(produk.id, produk.paket)}
                          style={{
                            padding: '8px 10px',
                            background: '#ffffff',
                            color: '#dc2626',
                            border: '1px solid #fecaca',
                            borderRadius: '8px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            minHeight: '36px',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          Reset
                        </button>
                      )}
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
