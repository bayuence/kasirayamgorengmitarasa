import { useState, useEffect } from 'preact/hooks';
import {
  muatSemuaMenuAdmin,
  simpanProdukAdmin,
  hapusProdukAdmin,
} from '../../data/menu.js';
import { formatRupiah } from '../../util/rupiah.js';
import type { ProdukItem } from '../../data/db.js';

export function LayarKelolaProduk() {
  const [daftarProduk, setDaftarProduk] = useState<ProdukItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tampilModal, setTampilModal] = useState(false);
  const [pesanSukses, setPesanSukses] = useState('');

  // Form State
  const [formVarian, setFormVarian] = useState('Ayam Rempah Jawa');
  const [formPaket, setFormPaket] = useState('');
  const [formIsi, setFormIsi] = useState('');
  const [formHarga, setFormHarga] = useState<number | ''>('');

  useEffect(() => {
    muatData();
  }, []);

  const muatData = async () => {
    setLoading(true);
    const { produk } = await muatSemuaMenuAdmin();
    setDaftarProduk(produk);
    setLoading(false);
  };

  const notifikasi = (teks: string) => {
    setPesanSukses(teks);
    setTimeout(() => setPesanSukses(''), 3000);
  };

  const handleToggleAktif = async (item: ProdukItem) => {
    const updated = { ...item, aktif: !item.aktif, diubah_pada: new Date().toISOString() };
    await simpanProdukAdmin(updated);
    muatData();
    notifikasi(`Status menu "${item.paket}" berhasil diubah`);
  };

  const handleSimpanProduk = async (e: Event) => {
    e.preventDefault();
    if (!formPaket.trim() || formHarga === '') return;

    const baru: ProdukItem = {
      id: crypto.randomUUID(),
      varian: formVarian,
      paket: formPaket.trim(),
      isi: formIsi.trim(),
      harga: Number(formHarga),
      urutan: daftarProduk.length + 1,
      aktif: true,
      diubah_pada: new Date().toISOString(),
    };

    await simpanProdukAdmin(baru);
    setTampilModal(false);
    setFormPaket('');
    setFormIsi('');
    setFormHarga('');
    notifikasi('Produk baru berhasil ditambahkan');
    muatData();
  };

  const handleHapus = async (id: string, nama: string) => {
    if (confirm(`Hapus produk "${nama}" dari master menu?`)) {
      await hapusProdukAdmin(id);
      notifikasi('Produk berhasil dihapus');
      muatData();
    }
  };

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '10px', marginBottom: '18px' }}>
        <div>
          <h2 style={{ fontSize: '1.375rem', fontWeight: 800, margin: '0 0 4px', color: '#0f172a', letterSpacing: '-0.025em' }}>
            Katalog Menu & Produk
          </h2>
          <p style={{ fontSize: '0.8125rem', color: '#64748b', margin: 0, lineHeight: 1.4 }}>
            Kelola daftar varian, paket, dan harga dasar master pusat
          </p>
        </div>

        <button
          type="button"
          onClick={() => setTampilModal(true)}
          style={{
            padding: '9px 16px',
            background: '#0f172a',
            color: '#ffffff',
            borderRadius: '8px',
            fontSize: '0.8125rem',
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
            minHeight: '38px',
            minWidth: 'auto',
            whiteSpace: 'nowrap',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>Tambah Menu</span>
        </button>
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

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Memuat menu...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {daftarProduk.map((item) => (
            <div
              key={item.id}
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '12px 14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                opacity: item.aktif ? 1 : 0.6,
              }}
            >
              <div style={{ flex: 1, minWidth: 0, marginRight: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                  <span style={{ fontSize: '0.6875rem', fontWeight: 600, background: '#f1f5f9', color: '#475569', padding: '2px 6px', borderRadius: '4px' }}>
                    {item.varian}
                  </span>
                  <h4 style={{ fontSize: '0.9375rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                    {item.paket}
                  </h4>
                </div>
                {item.isi && (
                  <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '2px 0 4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.isi}
                  </p>
                )}
                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a' }}>
                  {formatRupiah(item.harga)}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => handleToggleAktif(item)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                    background: item.aktif ? '#f0fdf4' : '#f8fafc',
                    color: item.aktif ? '#16a34a' : '#64748b',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    minWidth: 'auto',
                    minHeight: '30px',
                  }}
                >
                  {item.aktif ? 'Aktif' : 'Nonaktif'}
                </button>
                <button
                  type="button"
                  onClick={() => handleHapus(item.id, `${item.varian} - ${item.paket}`)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    border: '1px solid #fecaca',
                    background: '#ffffff',
                    color: '#dc2626',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    minWidth: 'auto',
                    minHeight: '30px',
                  }}
                >
                  Hapus
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Tambah */}
      {tampilModal && (
        <div class="sheet-backdrop" onClick={() => setTampilModal(false)}>
          <div class="sheet" onClick={(e) => e.stopPropagation()} style={{ padding: '24px 20px' }}>
            <div class="sheet-handle" />
            <h3 style={{ fontSize: '1.0625rem', fontWeight: 700, margin: '0 0 16px', color: '#0f172a' }}>
              Tambah Menu Baru
            </h3>
            <form onSubmit={handleSimpanProduk} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Varian
                </label>
                <select
                  value={formVarian}
                  onChange={(e) => setFormVarian((e.target as HTMLSelectElement).value)}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f8fafc', fontSize: '0.875rem' }}
                >
                  <option value="Ayam Rempah Jawa">Ayam Rempah Jawa</option>
                  <option value="Ayam Goreng Bawang Putih">Ayam Goreng Bawang Putih</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Nama Paket (Reguler / Komplit / Jumbo)
                </label>
                <input
                  type="text"
                  required
                  placeholder="Misal: Paket Hemat"
                  value={formPaket}
                  onInput={(e) => setFormPaket((e.target as HTMLInputElement).value)}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f8fafc', fontSize: '0.875rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Isi Paket (Deskripsi)
                </label>
                <input
                  type="text"
                  placeholder="Nasi, ayam, sambal, lalapan..."
                  value={formIsi}
                  onInput={(e) => setFormIsi((e.target as HTMLInputElement).value)}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f8fafc', fontSize: '0.875rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Harga Dasar Pusat (Rp)
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  placeholder="20000"
                  value={formHarga}
                  onInput={(e) => setFormHarga(Number((e.target as HTMLInputElement).value))}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f8fafc', fontSize: '0.875rem' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setTampilModal(false)}
                  style={{ flex: 1, padding: '12px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 600 }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  style={{ flex: 1, padding: '12px', background: '#0f172a', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 600 }}
                >
                  Simpan Produk
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

