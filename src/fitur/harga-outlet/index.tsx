import { useState, useEffect } from 'preact/hooks';
import {
  muatProdukDenganHargaOutlet,
  type ProdukDenganHargaOutlet,
} from '../../data/menu.js';
import {
  muatSemuaOutlet,
  simpanHargaProdukPerOutlet,
  hapusHargaKhususProdukOutlet,
  outletAktifSignal,
} from '../../data/outlet.js';
import { formatRupiah } from '../../util/rupiah.js';
import type { OutletItem } from '../../data/db.js';

export function LayarHargaOutlet() {
  const [daftarOutlet, setDaftarOutlet] = useState<OutletItem[]>([]);
  const [outletTerpilih, setOutletTerpilih] = useState<string>('');
  const [produkList, setProdukList] = useState<ProdukDenganHargaOutlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [pesanSukses, setPesanSukses] = useState('');

  // Draft input nominal { [produkId]: string }
  const [draftHarga, setDraftHarga] = useState<Record<string, string>>({});

  useEffect(() => {
    muatSemuaOutlet().then((outlets) => {
      setDaftarOutlet(outlets);

      // Cek apakah ada query param ?outlet=...
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
      for (const item of data) {
        draft[item.produk.id] = item.hargaKhusus !== null ? String(item.hargaKhusus) : '';
      }
      setDraftHarga(draft);
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

  const handleSimpanHarga = async (produkId: string, namaProduk: string) => {
    if (!outletTerpilih) return;
    const nominalRaw = draftHarga[produkId];

    if (!nominalRaw || nominalRaw.trim() === '') {
      await hapusHargaKhususProdukOutlet(outletTerpilih, produkId);
      notifikasi(`Harga "${namaProduk}" direset ke harga dasar pusat`);
    } else {
      const nominal = Number(nominalRaw);
      if (isNaN(nominal) || nominal < 0) {
        alert('Masukkan nominal harga yang valid.');
        return;
      }
      await simpanHargaProdukPerOutlet(outletTerpilih, produkId, nominal, true);
      notifikasi(`Harga khusus "${namaProduk}" berhasil disimpan`);
    }

    await muatDataHarga(outletTerpilih);
  };

  const handleReset = async (produkId: string, namaProduk: string) => {
    if (!outletTerpilih) return;
    await hapusHargaKhususProdukOutlet(outletTerpilih, produkId);
    notifikasi(`Harga "${namaProduk}" kembali mengikuti harga pusat`);
    await muatDataHarga(outletTerpilih);
  };

  const outletObj = daftarOutlet.find((o) => o.id === outletTerpilih);

  return (
    <div style={{ padding: '20px 16px 80px' }}>
      {/* Back link */}
      <a
        href="#/kasir"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          fontSize: '0.75rem',
          fontWeight: 600,
          color: '#64748b',
          textDecoration: 'none',
          marginBottom: '10px',
        }}
      >
        ‹ Kembali ke Kasir
      </a>

      {/* Header Halaman */}
      <div style={{ marginBottom: '18px' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#0f172a', letterSpacing: '-0.02em' }}>
          Penetapan Harga per Toko
        </h2>
        <p style={{ fontSize: '0.8125rem', color: '#64748b', marginTop: '3px', marginBottom: 0 }}>
          Atur harga jual khusus untuk masing-masing cabang toko
        </p>
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
          }}
        >
          {pesanSukses}
        </div>
      )}

      {daftarOutlet.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '36px 16px',
            background: '#ffffff',
            border: '1px dashed #cbd5e1',
            borderRadius: '12px',
          }}
        >
          <p style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#0f172a', margin: '0 0 4px' }}>
            Belum ada cabang toko yang didaftarkan
          </p>
          <p style={{ fontSize: '0.8125rem', color: '#64748b', margin: '0 0 16px' }}>
            Daftarkan lokasi cabang toko terlebih dahulu sebelum mengatur perbedaan harga.
          </p>
          <a
            href="#/outlet"
            style={{
              display: 'inline-block',
              padding: '10px 18px',
              background: '#0f172a',
              color: '#ffffff',
              borderRadius: '8px',
              fontSize: '0.8125rem',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Buka Menu Lokasi & Cabang Toko ›
          </a>
        </div>
      ) : (
        <>
          {/* Kotak Pemilih Toko */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '18px',
            }}
          >
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
              Pilih Toko / Cabang yang Ingin Diatur:
            </label>
            <select
              value={outletTerpilih}
              onChange={(e) => handleChangeOutlet((e.target as HTMLSelectElement).value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                background: '#ffffff',
                fontSize: '0.9375rem',
                fontWeight: 600,
                color: '#0f172a',
                outline: 'none',
              }}
            >
              {daftarOutlet.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nama} ({o.kode}) {o.sumber === 'presensi' ? '• Presensi' : ''} {o.id === outletAktifSignal.value?.id ? '★ Toko Kasir Ini' : ''}
                </option>
              ))}
            </select>

            <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '8px 0 0', lineHeight: 1.4 }}>
              💡 Anda sedang mengatur harga untuk: <strong>{outletObj?.nama || 'Toko'}</strong>. Masukkan nominal khusus di bawah. Jika dikosongkan, produk akan otomatis memakai harga master pusat.
            </p>
          </div>

          {/* Daftar Produk */}
          <div>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '10px' }}>
              Daftar Menu ({produkList.length})
            </span>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>Memuat data harga toko...</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {produkList.map(({ produk, hargaKhusus, hargaEfektif }) => {
                  const nominalInput = draftHarga[produk.id] ?? '';
                  const isCustom = hargaKhusus !== null;

                  return (
                    <div
                      key={produk.id}
                      style={{
                        background: '#ffffff',
                        border: isCustom ? '1.5px solid #93c5fd' : '1px solid #e2e8f0',
                        borderRadius: '10px',
                        padding: '14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '0.6875rem', fontWeight: 600, background: '#f1f5f9', color: '#475569', padding: '2px 6px', borderRadius: '4px' }}>
                              {produk.varian}
                            </span>
                            <h4 style={{ fontSize: '0.9375rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                              {produk.paket}
                            </h4>
                          </div>
                          <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginTop: '2px' }}>
                            Harga Dasar Pusat: <strong style={{ color: '#0f172a' }}>{formatRupiah(produk.harga)}</strong>
                          </span>
                        </div>

                        <span
                          style={{
                            fontSize: '0.6875rem',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '4px',
                            background: isCustom ? '#eff6ff' : '#f8fafc',
                            color: isCustom ? '#1d4ed8' : '#64748b',
                            border: `1px solid ${isCustom ? '#bfdbfe' : '#e2e8f0'}`,
                          }}
                        >
                          {isCustom ? `Khusus: ${formatRupiah(hargaEfektif)}` : 'Sesuai Pusat'}
                        </span>
                      </div>

                      {/* Input dan Simpan */}
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <div style={{ flex: 1, position: 'relative' }}>
                          <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.8125rem', color: '#94a3b8', fontWeight: 600 }}>
                            Rp
                          </span>
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder={`Standar: ${produk.harga}`}
                            value={nominalInput}
                            onInput={(e) => {
                              const val = (e.target as HTMLInputElement).value.replace(/\D/g, '');
                              setDraftHarga({ ...draftHarga, [produk.id]: val });
                            }}
                            style={{
                              width: '100%',
                              padding: '8px 10px 8px 32px',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              fontSize: '0.875rem',
                              fontWeight: 600,
                              color: '#0f172a',
                              background: '#f8fafc',
                              boxSizing: 'border-box',
                              outline: 'none',
                            }}
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => handleSimpanHarga(produk.id, `${produk.varian} - ${produk.paket}`)}
                          style={{
                            padding: '8px 14px',
                            background: '#0f172a',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '0.8125rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            minHeight: '36px',
                            minWidth: 'auto',
                          }}
                        >
                          Simpan
                        </button>

                        {isCustom && (
                          <button
                            type="button"
                            onClick={() => handleReset(produk.id, `${produk.varian} - ${produk.paket}`)}
                            style={{
                              padding: '8px 10px',
                              background: '#ffffff',
                              color: '#dc2626',
                              border: '1px solid #fecaca',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              minHeight: '36px',
                              minWidth: 'auto',
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
          </div>
        </>
      )}
    </div>
  );
}

