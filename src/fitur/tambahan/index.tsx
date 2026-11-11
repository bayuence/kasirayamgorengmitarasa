import { useState, useEffect } from 'preact/hooks';
import {
  muatSemuaMenuAdmin,
  simpanTambahanAdmin,
  hapusTambahanAdmin,
} from '../../data/menu.js';
import { formatRupiah } from '../../util/rupiah.js';
import type { TambahanItem } from '../../data/db.js';

export function LayarKelolaTambahan() {
  const [daftarTambahan, setDaftarTambahan] = useState<TambahanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tampilModal, setTampilModal] = useState(false);
  const [pesanSukses, setPesanSukses] = useState('');

  // Form State
  const [formNama, setFormNama] = useState('');
  const [formHarga, setFormHarga] = useState<number | ''>('');

  useEffect(() => {
    muatData();
  }, []);

  const muatData = async () => {
    setLoading(true);
    const { tambahan } = await muatSemuaMenuAdmin();
    setDaftarTambahan(tambahan);
    setLoading(false);
  };

  const notifikasi = (teks: string) => {
    setPesanSukses(teks);
    setTimeout(() => setPesanSukses(''), 3000);
  };

  const handleToggleAktif = async (item: TambahanItem) => {
    const updated = { ...item, aktif: !item.aktif, diubah_pada: new Date().toISOString() };
    await simpanTambahanAdmin(updated);
    muatData();
    notifikasi(`Status item "${item.nama}" berhasil diubah`);
  };

  const handleSimpanTambahan = async (e: Event) => {
    e.preventDefault();
    if (!formNama.trim() || formHarga === '') return;

    const baru: TambahanItem = {
      id: crypto.randomUUID(),
      nama: formNama.trim(),
      harga: Number(formHarga),
      urutan: daftarTambahan.length + 1,
      aktif: true,
      diubah_pada: new Date().toISOString(),
    };

    await simpanTambahanAdmin(baru);
    setTampilModal(false);
    setFormNama('');
    setFormHarga('');
    notifikasi('Item tambahan berhasil ditambahkan');
    muatData();
  };

  const handleHapus = async (id: string, nama: string) => {
    if (confirm(`Hapus tambahan "${nama}"?`)) {
      await hapusTambahanAdmin(id);
      notifikasi('Item berhasil dihapus');
      muatData();
    }
  };

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#0f172a', letterSpacing: '-0.02em' }}>
            Item Tambahan (Add-ons)
          </h2>
          <p style={{ fontSize: '0.8125rem', color: '#64748b', marginTop: '3px', marginBottom: 0 }}>
            Kelola topping dan pilihan pelengkap pesanan (kremes, sambal, dll)
          </p>
        </div>

        <button
          type="button"
          onClick={() => setTampilModal(true)}
          style={{
            padding: '8px 14px',
            background: '#0f172a',
            color: '#ffffff',
            borderRadius: '6px',
            fontSize: '0.8125rem',
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
            minHeight: '36px',
            minWidth: 'auto',
            whiteSpace: 'nowrap',
          }}
        >
          + Tambah Item
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
        <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Memuat item tambahan...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {daftarTambahan.map((item) => (
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
              <div>
                <h4 style={{ fontSize: '0.9375rem', fontWeight: 600, margin: 0, color: '#0f172a' }}>
                  {item.nama}
                </h4>
                <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0f172a', display: 'block', marginTop: '2px' }}>
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
                  onClick={() => handleHapus(item.id, item.nama)}
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
              Tambah Item Tambahan
            </h3>
            <form onSubmit={handleSimpanTambahan} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Nama Tambahan
                </label>
                <input
                  type="text"
                  required
                  placeholder="Misal: Sambal Matah"
                  value={formNama}
                  onInput={(e) => setFormNama((e.target as HTMLInputElement).value)}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f8fafc', fontSize: '0.875rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Harga (Rp)
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  placeholder="3000"
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
                  Simpan Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

