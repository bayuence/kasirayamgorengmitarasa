import { useState, useEffect } from 'preact/hooks';
import { muatMenuLokal } from '../../data/menu.js';
import { outletAktifSignal } from '../../data/outlet.js';
import type { ProdukItem, TambahanItem, KategoriItem } from '../../data/db.js';
import { formatRupiah } from '../../util/rupiah.js';
import {
  itemKeranjangSignal,
  totalHargaSignal,
  totalQtySignal,
  jenisPesananSignal,
  setJenisPesanan,
  catatanPesananSignal,
  hapusItem,
  itemTerakhirDihapusSignal,
  batalkanHapusItem,
  bersihkanUndo,
} from '../../state/keranjang.js';

export function LayarKasir() {
  const [produkList, setProdukList] = useState<ProdukItem[]>([]);
  const [tambahanList, setTambahanList] = useState<TambahanItem[]>([]);
  const [kategoriList, setKategoriList] = useState<KategoriItem[]>([]);
  const [kategoriAktif, setKategoriAktif] = useState<string>('Semua');
  const [loading, setLoading] = useState(true);
  const [bukaCatatan, setBukaCatatan] = useState(false);
  const [bukaRincian, setBukaRincian] = useState(false);

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

  const matchesKategori = (p: ProdukItem, katNama: string) => {
    const k = p.kategori || p.varian || '';
    if (k.toLowerCase() === katNama.toLowerCase()) return true;
    if (katNama === 'Paket Ayam') {
      return !k || k === 'Original' || k === 'Spicy' || k.toLowerCase().includes('ayam') || p.paket?.toLowerCase().includes('paket');
    }
    if (katNama === 'Minuman') {
      return k.toLowerCase().includes('minum') || p.paket?.toLowerCase().includes('teh') || p.paket?.toLowerCase().includes('jeruk');
    }
    if (katNama === 'Tambahan & Sambal') {
      return k.toLowerCase().includes('tambahan') || k.toLowerCase().includes('sambal') || p.paket?.toLowerCase().includes('kremes');
    }
    return false;
  };

  const produkTampil =
    kategoriAktif === 'Semua'
      ? produkList
      : produkList.filter((p) => matchesKategori(p, kategoriAktif));

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

  if (loading) {
    return (
      <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: '0.9375rem' }}>
        Memuat katalog menu...
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: '120px' }}>
      {/* Banner Cabang Toko Aktif */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '7px 16px',
          background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          fontSize: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {outletAktifSignal.value?.kode && (
            <span
              style={{
                fontSize: '0.625rem',
                fontWeight: 700,
                background: '#0f172a',
                color: '#ffffff',
                padding: '1px 5px',
                borderRadius: '3px',
                letterSpacing: '0.04em',
              }}
            >
              {outletAktifSignal.value.kode}
            </span>
          )}
          <span style={{ fontWeight: 600, color: '#0f172a' }}>
            {outletAktifSignal.value?.nama || 'Ayam Goreng Mitarasa'}
          </span>
        </div>

        <a
          href="#/outlet"
          style={{
            fontSize: '0.6875rem',
            color: '#64748b',
            fontWeight: 600,
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '2px',
          }}
        >
          {outletAktifSignal.value ? 'Ganti Cabang ›' : 'Atur Cabang ›'}
        </a>
      </div>

      {/* Pilihan Jenis Pesanan (Clean Toggle) */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 16px',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--line)',
        }}
      >
        <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--muted)' }}>Tipe Pesanan:</span>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            type="button"
            onClick={() => setJenisPesanan('makan_di_tempat')}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.8125rem',
              fontWeight: jenisPesananSignal.value === 'makan_di_tempat' ? 600 : 500,
              background:
                jenisPesananSignal.value === 'makan_di_tempat'
                  ? 'var(--ink)'
                  : 'var(--soft)',
              color:
                jenisPesananSignal.value === 'makan_di_tempat'
                  ? 'var(--surface)'
                  : 'var(--muted)',
              border: 'none',
              minHeight: '38px',
            }}
          >
            Makan di tempat
          </button>
          <button
            type="button"
            onClick={() => setJenisPesanan('bawa_pulang')}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.8125rem',
              fontWeight: jenisPesananSignal.value === 'bawa_pulang' ? 600 : 500,
              background:
                jenisPesananSignal.value === 'bawa_pulang'
                  ? 'var(--ink)'
                  : 'var(--soft)',
              color:
                jenisPesananSignal.value === 'bawa_pulang'
                  ? 'var(--surface)'
                  : 'var(--muted)',
              border: 'none',
              minHeight: '38px',
            }}
          >
            Bawa pulang
          </button>
        </div>
      </div>

      {/* Tab Filter Kategori Menu Dinamis */}
      <div
        style={{
          display: 'flex',
          gap: '6px',
          overflowX: 'auto',
          padding: '8px 16px',
          background: '#ffffff',
          borderBottom: '1px solid var(--line)',
          scrollbarWidth: 'none',
        }}
      >
        <button
          type="button"
          onClick={() => setKategoriAktif('Semua')}
          style={{
            padding: '6px 14px',
            borderRadius: '999px',
            fontSize: '0.8125rem',
            fontWeight: kategoriAktif === 'Semua' ? 700 : 500,
            background: kategoriAktif === 'Semua' ? 'var(--ink)' : 'var(--soft)',
            color: kategoriAktif === 'Semua' ? 'var(--surface)' : 'var(--muted)',
            border: 'none',
            whiteSpace: 'nowrap',
            cursor: 'pointer',
            minHeight: '34px',
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
                padding: '6px 14px',
                borderRadius: '999px',
                fontSize: '0.8125rem',
                fontWeight: isAktif ? 700 : 500,
                background: isAktif ? 'var(--ink)' : 'var(--soft)',
                color: isAktif ? 'var(--surface)' : 'var(--muted)',
                border: 'none',
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                minHeight: '34px',
              }}
            >
              {k.nama} ({count})
            </button>
          );
        })}
      </div>

      {/* Notifikasi Undo Hapus */}
      {itemTerakhirDihapusSignal.value && (
        <div
          style={{
            margin: '0 16px 12px',
            padding: '10px 14px',
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.875rem',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <span style={{ color: 'var(--ink-secondary)' }}>Item dihapus dari keranjang</span>
          <button
            type="button"
            onClick={batalkanHapusItem}
            style={{
              color: 'var(--ink)',
              fontWeight: 700,
              padding: '4px 8px',
              minHeight: '36px',
              textDecoration: 'underline',
            }}
          >
            Urungkan
          </button>
        </div>
      )}

      {/* Daftar Paket Menu */}
      <div style={{ padding: '0 16px' }}>
        {produkTampil.map((p) => {
          const qty = getQty(p.id);
          const cartItem = getItemKeranjang(p.id);

          return (
            <div key={p.id} class="card">
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                {/* Foto / Icon Menu jika ada */}
                {p.gambar ? (
                  <div
                    style={{
                      width: '58px',
                      height: '58px',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      flexShrink: 0,
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <img src={p.gambar} alt={p.paket} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ) : null}

                <div style={{ flex: 1, minWidth: 0, paddingRight: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                    <span
                      style={{
                        fontSize: '0.625rem',
                        fontWeight: 700,
                        background: '#f1f5f9',
                        color: '#475569',
                        padding: '1px 5px',
                        borderRadius: '3px',
                      }}
                    >
                      {p.kategori || p.varian}
                    </span>
                  </div>
                  <h3 style={{ fontSize: '1.0625rem', fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--ink)' }}>
                    {p.paket}
                  </h3>
                  <p style={{ color: 'var(--muted)', fontSize: '0.8125rem', marginTop: '3px', lineHeight: 1.4 }}>
                    {p.isi}
                  </p>
                  <p
                    class="tabular-nums"
                    style={{ fontWeight: 700, color: 'var(--ink)', marginTop: '8px', fontSize: '1.0625rem' }}
                  >
                    {formatRupiah(p.harga)}
                  </p>
                </div>

                {/* Stepper +/- */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {qty > 0 && (
                    <>
                      <button
                        type="button"
                        class="btn-stepper"
                        onClick={() => handleKurang(p.id)}
                        aria-label={`Kurangi ${p.paket}`}
                      >
                        −
                      </button>
                      <span class="tabular-nums" style={{ fontWeight: 700, minWidth: '24px', textAlign: 'center', fontSize: '1.0625rem' }}>
                        {qty}
                      </span>
                    </>
                  )}
                  <button
                    type="button"
                    class="btn-stepper"
                    onClick={() => handleTambah(p)}
                    aria-label={`Tambah ${p.paket}`}
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Chip Tambahan (Modern Pill Badges) */}
              {qty > 0 && (
                <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--line)' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: '8px' }}>
                    Pilihan Tambahan:
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {tambahanList.map((t) => {
                      const isSelected = cartItem?.tambahan.some((tb) => tb.nama === t.nama);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => toggleTambahan(p.id, t)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: 'var(--radius-full)',
                            fontSize: '0.75rem',
                            minHeight: '38px',
                            border: isSelected ? '1px solid var(--ink)' : '1px solid var(--line)',
                            background: isSelected ? 'var(--ink)' : 'var(--surface)',
                            color: isSelected ? 'var(--surface)' : 'var(--ink)',
                            fontWeight: isSelected ? 600 : 500,
                            boxShadow: 'var(--shadow-sm)',
                          }}
                        >
                          {isSelected ? '✓ ' : '+ '}{t.nama} (+{formatRupiah(t.harga)})
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Dialog Catatan Pesanan */}
      {bukaCatatan && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.4)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            zIndex: 40,
          }}
        >
          <div
            class="card"
            style={{ width: '100%', maxWidth: '380px', margin: 0, background: 'var(--surface)', boxShadow: 'var(--shadow-lg)' }}
          >
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '8px' }}>Catatan Pesanan</h3>
            <textarea
              rows={3}
              placeholder="Contoh: Sambel dipisah, ayam bagian paha"
              value={catatanPesananSignal.value}
              onInput={(e) => {
                catatanPesananSignal.value = (e.target as HTMLTextAreaElement).value;
              }}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--line)',
                background: 'var(--surface)',
                marginBottom: '14px',
                fontSize: '0.9375rem',
              }}
            />
            <button
              type="button"
              class="btn-primary"
              onClick={() => setBukaCatatan(false)}
            >
              Simpan Catatan
            </button>
          </div>
        </div>
      )}

      {/* Bottom Sheet Rincian Keranjang */}
      {bukaRincian && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.4)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'flex-end',
            zIndex: 35,
          }}
        >
          <div
            style={{
              width: '100%',
              background: 'var(--surface)',
              borderTopLeftRadius: '20px',
              borderTopRightRadius: '20px',
              padding: '20px 16px calc(20px + env(safe-area-inset-bottom, 0px))',
              maxHeight: '80vh',
              overflowY: 'auto',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Rincian Keranjang</h3>
              <button
                type="button"
                onClick={() => setBukaRincian(false)}
                style={{ fontSize: '0.875rem', color: 'var(--muted)', minHeight: '36px', fontWeight: 500 }}
              >
                Tutup
              </button>
            </div>

            {itemKeranjangSignal.value.map((item) => {
              const totalTambahan = item.tambahan.reduce((sum, t) => sum + t.harga * t.qty, 0);
              const subtotal = (item.harga + totalTambahan) * item.qty;

              return (
                <div
                  key={item.produkId}
                  style={{
                    padding: '10px 0',
                    borderBottom: '1px solid var(--line)',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <strong style={{ fontSize: '0.9375rem' }}>{item.qty}x {item.varian} - {item.paket}</strong>
                    {item.tambahan.length > 0 && (
                      <div style={{ fontSize: '0.8125rem', color: 'var(--muted)', marginTop: '2px' }}>
                        + {item.tambahan.map((t) => t.nama).join(', ')}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div class="tabular-nums" style={{ fontWeight: 600 }}>{formatRupiah(subtotal)}</div>
                    <button
                      type="button"
                      onClick={() => hapusItem(item.produkId)}
                      style={{ fontSize: '0.8125rem', color: 'var(--danger)', padding: 0, minHeight: '24px' }}
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              );
            })}

            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.9375rem', color: 'var(--muted)' }}>Total Pembayaran:</span>
              <strong class="tabular-nums" style={{ fontSize: '1.25rem', color: 'var(--ink)' }}>
                {formatRupiah(totalHargaSignal.value)}
              </strong>
            </div>

            <button
              type="button"
              class="btn-primary"
              style={{ marginTop: '16px' }}
              onClick={() => {
                setBukaRincian(false);
                window.location.hash = '#/bayar';
              }}
            >
              Lanjut ke Pembayaran
            </button>
          </div>
        </div>
      )}

      {/* Bilah Keranjang Melekat di Bawah */}
      {totalQtySignal.value > 0 && (
        <div class="bottom-bar">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setBukaRincian(true)}
              style={{ padding: 0, color: 'var(--ink)', textAlign: 'left', minHeight: '38px' }}
            >
              <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>
                {totalQtySignal.value} item
              </div>
              <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--muted)' }}>
                {jenisPesananSignal.value === 'makan_di_tempat' ? 'Makan di tempat' : 'Bawa pulang'} • <span style={{ textDecoration: 'underline' }}>Lihat rincian</span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => setBukaCatatan(true)}
              style={{
                fontSize: '0.75rem',
                fontWeight: 500,
                color: 'var(--ink)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-sm)',
                padding: '6px 10px',
                background: 'var(--soft)',
                minHeight: '36px',
              }}
            >
              {catatanPesananSignal.value ? 'Catatan ✓' : '+ Catatan'}
            </button>

            <span class="tabular-nums" style={{ fontSize: '1.1875rem', fontWeight: 700, color: 'var(--ink)' }}>
              {formatRupiah(totalHargaSignal.value)}
            </span>
          </div>

          <button
            type="button"
            class="btn-primary"
            onClick={() => {
              window.location.hash = '#/bayar';
            }}
          >
            Lanjut Bayar
          </button>
        </div>
      )}
    </div>
  );
}
