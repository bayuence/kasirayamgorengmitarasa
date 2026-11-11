import { useState, useEffect } from 'preact/hooks';
import {
  muatSemuaMenuAdmin,
  simpanProdukAdmin,
  hapusProdukAdmin,
  simpanKategoriAdmin,
  hapusKategoriAdmin,
  hitungKeuntungan,
} from '../../data/menu.js';
import { formatRupiah } from '../../util/rupiah.js';
import type { ProdukItem, KategoriItem } from '../../data/db.js';

export function LayarKelolaProduk() {
  const [tabAktif, setTabAktif] = useState<'menu' | 'kategori'>('menu');
  const [daftarProduk, setDaftarProduk] = useState<ProdukItem[]>([]);
  const [daftarKategori, setDaftarKategori] = useState<KategoriItem[]>([]);
  const [kategoriFilter, setKategoriFilter] = useState<string>('semua');
  const [loading, setLoading] = useState(true);
  const [pesanSukses, setPesanSukses] = useState('');

  // Modal Menu State
  const [tampilModalMenu, setTampilModalMenu] = useState(false);
  const [editProdukId, setEditProdukId] = useState<string | null>(null);
  const [formNamaMenu, setFormNamaMenu] = useState('');
  const [formKategori, setFormKategori] = useState('');
  const [formGambar, setFormGambar] = useState('');
  const [formHpp, setFormHpp] = useState<number | ''>('');
  const [formHarga, setFormHarga] = useState<number | ''>('');
  const [formIsi, setFormIsi] = useState('');
  const [formAktif, setFormAktif] = useState(true);

  // Modal Kategori State
  const [tampilModalKategori, setTampilModalKategori] = useState(false);
  const [editKategoriId, setEditKategoriId] = useState<string | null>(null);
  const [formNamaKategori, setFormNamaKategori] = useState('');
  const [formUrutanKategori, setFormUrutanKategori] = useState<number | ''>(1);

  useEffect(() => {
    muatData();
  }, []);

  const muatData = async () => {
    setLoading(true);
    const { produk, kategori } = await muatSemuaMenuAdmin();
    setDaftarProduk(produk);
    setDaftarKategori(kategori);
    if (kategori.length > 0 && !formKategori) {
      setFormKategori(kategori[0].nama);
    }
    setLoading(false);
  };

  const notifikasi = (teks: string) => {
    setPesanSukses(teks);
    setTimeout(() => setPesanSukses(''), 3000);
  };

  // Helper kompres foto ke base64 (Max 400x400)
  const handleUploadGambar = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
          setFormGambar(dataUrl);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Buka Form Tambah Menu
  const bukaTambahMenu = () => {
    setEditProdukId(null);
    setFormNamaMenu('');
    setFormKategori(daftarKategori[0]?.nama || 'Paket Ayam');
    setFormGambar('');
    setFormHpp('');
    setFormHarga('');
    setFormIsi('');
    setFormAktif(true);
    setTampilModalMenu(true);
  };

  // Buka Form Edit Menu
  const bukaEditMenu = (item: ProdukItem) => {
    setEditProdukId(item.id);
    setFormNamaMenu(item.paket);
    setFormKategori(item.kategori || item.varian || daftarKategori[0]?.nama || 'Paket Ayam');
    setFormGambar(item.gambar || '');
    setFormHpp(item.hpp !== undefined ? item.hpp : Math.round(item.harga * 0.6));
    setFormHarga(item.harga);
    setFormIsi(item.isi || '');
    setFormAktif(item.aktif);
    setTampilModalMenu(true);
  };

  // Simpan Menu
  const handleSimpanMenu = async (e: Event) => {
    e.preventDefault();
    if (!formNamaMenu.trim() || formHarga === '') {
      alert('Nama menu dan harga jual wajib diisi');
      return;
    }

    const kategoriObj = daftarKategori.find((k) => k.nama === formKategori);
    const hargaNum = Number(formHarga);
    const hppNum = formHpp === '' ? Math.round(hargaNum * 0.6) : Number(formHpp);

    const item: ProdukItem = {
      id: editProdukId || crypto.randomUUID(),
      varian: formKategori,
      paket: formNamaMenu.trim(),
      kategori: formKategori,
      kategori_id: kategoriObj?.id || null,
      gambar: formGambar,
      hpp: hppNum,
      harga: hargaNum,
      isi: formIsi.trim(),
      urutan: editProdukId
        ? daftarProduk.find((p) => p.id === editProdukId)?.urutan || 1
        : daftarProduk.length + 1,
      aktif: formAktif,
      diubah_pada: new Date().toISOString(),
    };

    await simpanProdukAdmin(item);
    setTampilModalMenu(false);
    notifikasi(editProdukId ? `Menu "${item.paket}" berhasil diperbarui` : `Menu baru "${item.paket}" berhasil ditambahkan`);
    muatData();
  };

  const handleToggleAktifMenu = async (item: ProdukItem) => {
    const updated = { ...item, aktif: !item.aktif, diubah_pada: new Date().toISOString() };
    await simpanProdukAdmin(updated);
    muatData();
    notifikasi(`Status menu "${item.paket}" diubah`);
  };

  const handleHapusMenu = async (id: string, nama: string) => {
    if (confirm(`Hapus menu "${nama}" dari master menu?`)) {
      await hapusProdukAdmin(id);
      notifikasi('Menu berhasil dihapus');
      muatData();
    }
  };

  // Buka Form Tambah Kategori
  const bukaTambahKategori = () => {
    setEditKategoriId(null);
    setFormNamaKategori('');
    setFormUrutanKategori(daftarKategori.length + 1);
    setTampilModalKategori(true);
  };

  // Buka Form Edit Kategori
  const bukaEditKategori = (k: KategoriItem) => {
    setEditKategoriId(k.id);
    setFormNamaKategori(k.nama);
    setFormUrutanKategori(k.urutan);
    setTampilModalKategori(true);
  };

  // Simpan Kategori
  const handleSimpanKategori = async (e: Event) => {
    e.preventDefault();
    if (!formNamaKategori.trim()) return;

    const baru: KategoriItem = {
      id: editKategoriId || crypto.randomUUID(),
      nama: formNamaKategori.trim(),
      urutan: Number(formUrutanKategori) || daftarKategori.length + 1,
      aktif: true,
      diubah_pada: new Date().toISOString(),
    };

    await simpanKategoriAdmin(baru);
    setTampilModalKategori(false);
    notifikasi(editKategoriId ? `Kategori "${baru.nama}" diperbarui` : `Kategori "${baru.nama}" berhasil dibuat`);
    muatData();
  };

  const handleHapusKategori = async (id: string, nama: string) => {
    const jumlahMenu = daftarProduk.filter((p) => p.kategori === nama || p.kategori_id === id).length;
    if (jumlahMenu > 0) {
      alert(`Tidak dapat menghapus kategori "${nama}" karena masih digunakan oleh ${jumlahMenu} menu.`);
      return;
    }
    if (confirm(`Hapus kategori "${nama}"?`)) {
      await hapusKategoriAdmin(id);
      notifikasi('Kategori berhasil dihapus');
      muatData();
    }
  };

  // Filter menu
  const produkTersaring = daftarProduk.filter((p) => {
    if (kategoriFilter === 'semua') return true;
    return (p.kategori || p.varian) === kategoriFilter;
  });

  // Perhitungan live keuntungan di modal
  const liveJual = formHarga === '' ? 0 : Number(formHarga);
  const liveHpp = formHpp === '' ? 0 : Number(formHpp);
  const liveCalc = hitungKeuntungan(liveJual, liveHpp);

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
            Katalog Menu & Kategori
          </h2>
          <p style={{ fontSize: '0.8125rem', color: '#64748b', margin: 0, lineHeight: 1.4 }}>
            Kelola kategori, foto menu, HPP modal, harga jual, dan margin keuntungan
          </p>
        </div>

        {tabAktif === 'menu' ? (
          <button
            type="button"
            onClick={bukaTambahMenu}
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
        ) : (
          <button
            type="button"
            onClick={bukaTambahKategori}
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
            <span>Tambah Kategori</span>
          </button>
        )}
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

      {/* Main Tab Switcher */}
      <div
        style={{
          display: 'flex',
          background: '#f1f5f9',
          padding: '4px',
          borderRadius: '10px',
          marginBottom: '16px',
          gap: '4px',
        }}
      >
        <button
          type="button"
          onClick={() => setTabAktif('menu')}
          style={{
            flex: 1,
            padding: '9px',
            border: 'none',
            borderRadius: '7px',
            fontSize: '0.8125rem',
            fontWeight: tabAktif === 'menu' ? 700 : 600,
            background: tabAktif === 'menu' ? '#ffffff' : 'transparent',
            color: tabAktif === 'menu' ? '#0f172a' : '#64748b',
            boxShadow: tabAktif === 'menu' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            cursor: 'pointer',
            minHeight: '38px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          <span>📋 Daftar Menu</span>
          <span
            style={{
              fontSize: '0.6875rem',
              fontWeight: 700,
              background: tabAktif === 'menu' ? '#0f172a' : '#e2e8f0',
              color: tabAktif === 'menu' ? '#ffffff' : '#64748b',
              padding: '1px 6px',
              borderRadius: '999px',
            }}
          >
            {daftarProduk.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setTabAktif('kategori')}
          style={{
            flex: 1,
            padding: '9px',
            border: 'none',
            borderRadius: '7px',
            fontSize: '0.8125rem',
            fontWeight: tabAktif === 'kategori' ? 700 : 600,
            background: tabAktif === 'kategori' ? '#ffffff' : 'transparent',
            color: tabAktif === 'kategori' ? '#0f172a' : '#64748b',
            boxShadow: tabAktif === 'kategori' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            cursor: 'pointer',
            minHeight: '38px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          <span>🏷️ Kelola Kategori</span>
          <span
            style={{
              fontSize: '0.6875rem',
              fontWeight: 700,
              background: tabAktif === 'kategori' ? '#0f172a' : '#e2e8f0',
              color: tabAktif === 'kategori' ? '#ffffff' : '#64748b',
              padding: '1px 6px',
              borderRadius: '999px',
            }}
          >
            {daftarKategori.length}
          </span>
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Memuat data menu & kategori...</div>
      ) : tabAktif === 'menu' ? (
        /* ══════════════ TAB 1: DAFTAR MENU ══════════════ */
        <div>
          {/* Filter Bar Kategori (Pill Horizontal) */}
          <div
            style={{
              display: 'flex',
              gap: '6px',
              overflowX: 'auto',
              paddingBottom: '10px',
              marginBottom: '12px',
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
              Semua ({daftarProduk.length})
            </button>
            {daftarKategori.map((k) => {
              const count = daftarProduk.filter((p) => (p.kategori || p.varian) === k.nama).length;
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

          {/* List Menu */}
          {produkTersaring.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '36px 16px',
                background: '#ffffff',
                border: '1px dashed #cbd5e1',
                borderRadius: '12px',
              }}
            >
              <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#64748b', margin: '0 0 10px' }}>
                Belum ada menu di kategori ini
              </p>
              <button
                type="button"
                onClick={bukaTambahMenu}
                style={{
                  padding: '8px 16px',
                  background: '#0f172a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                + Tambah Menu Sekarang
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {produkTersaring.map((item) => {
                const hpp = item.hpp !== undefined ? item.hpp : Math.round(item.harga * 0.6);
                const { laba, marginPersen } = hitungKeuntungan(item.harga, hpp);

                return (
                  <div
                    key={item.id}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      padding: '14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      opacity: item.aktif ? 1 : 0.65,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                    }}
                  >
                    {/* Baris Atas: Foto + Info Menu */}
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                      {/* Foto Thumbnail */}
                      <div
                        style={{
                          width: '56px',
                          height: '56px',
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
                        {item.gambar ? (
                          <img
                            src={item.gambar}
                            alt={item.paket}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <span style={{ fontSize: '1.5rem' }}>🍗</span>
                        )}
                      </div>

                      {/* Detail Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px', flexWrap: 'wrap' }}>
                          <span
                            style={{
                              fontSize: '0.6875rem',
                              fontWeight: 700,
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              padding: '2px 7px',
                              borderRadius: '4px',
                              border: '1px solid #dbeafe',
                            }}
                          >
                            {item.kategori || item.varian || 'Menu'}
                          </span>
                          <h4 style={{ fontSize: '0.9375rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                            {item.paket}
                          </h4>
                        </div>

                        {item.isi && (
                          <p
                            style={{
                              fontSize: '0.75rem',
                              color: '#64748b',
                              margin: '2px 0 0',
                              lineHeight: 1.3,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {item.isi}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Baris Tengah: Finansial 3 Kolom (HPP, Jual, Margin) */}
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
                          HPP / Modal
                        </span>
                        <strong style={{ fontSize: '0.8125rem', color: '#334155' }}>
                          {formatRupiah(hpp)}
                        </strong>
                      </div>

                      <div>
                        <span style={{ display: 'block', fontSize: '0.6875rem', color: '#64748b', fontWeight: 500 }}>
                          Harga Jual
                        </span>
                        <strong style={{ fontSize: '0.875rem', color: '#0f172a' }}>
                          {formatRupiah(item.harga)}
                        </strong>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <span style={{ display: 'block', fontSize: '0.6875rem', color: '#64748b', fontWeight: 500 }}>
                          Keuntungan (Margin)
                        </span>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              color: laba >= 0 ? '#15803d' : '#b91c1c',
                            }}
                          >
                            +{formatRupiah(laba)}
                          </span>
                          <span
                            style={{
                              fontSize: '0.6875rem',
                              fontWeight: 700,
                              padding: '1px 5px',
                              borderRadius: '4px',
                              background: marginPersen >= 30 ? '#dcfce7' : marginPersen >= 10 ? '#fef9c3' : '#fee2e2',
                              color: marginPersen >= 30 ? '#15803d' : marginPersen >= 10 ? '#854d0e' : '#b91c1c',
                            }}
                          >
                            {marginPersen}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Baris Bawah: Aksi */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '2px' }}>
                      <span style={{ fontSize: '0.6875rem', color: item.aktif ? '#16a34a' : '#94a3b8', fontWeight: 600 }}>
                        ● {item.aktif ? 'Tersedia di Kasir' : 'Nonaktif'}
                      </span>

                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => bukaEditMenu(item)}
                          style={{
                            padding: '5px 10px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            background: '#ffffff',
                            color: '#334155',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleAktifMenu(item)}
                          style={{
                            padding: '5px 10px',
                            borderRadius: '6px',
                            border: '1px solid #e2e8f0',
                            background: item.aktif ? '#f8fafc' : '#f0fdf4',
                            color: item.aktif ? '#64748b' : '#16a34a',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          {item.aktif ? 'Matikan' : 'Aktifkan'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleHapusMenu(item.id, item.paket)}
                          style={{
                            padding: '5px 8px',
                            borderRadius: '6px',
                            border: '1px solid #fecaca',
                            background: '#ffffff',
                            color: '#dc2626',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Hapus
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ══════════════ TAB 2: KELOLA KATEGORI ══════════════ */
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {daftarKategori.map((k) => {
              const menuCount = daftarProduk.filter((p) => (p.kategori || p.varian) === k.nama).length;

              return (
                <div
                  key={k.id}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '14px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '6px',
                        background: '#f1f5f9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.8125rem',
                        fontWeight: 700,
                        color: '#475569',
                      }}
                    >
                      {k.urutan}
                    </div>

                    <div>
                      <h4 style={{ fontSize: '0.9375rem', fontWeight: 700, margin: '0 0 2px', color: '#0f172a' }}>
                        {k.nama}
                      </h4>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        {menuCount} item menu terhubung
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => bukaEditKategori(k)}
                      style={{
                        padding: '5px 10px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        color: '#334155',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleHapusKategori(k.id, k.nama)}
                      style={{
                        padding: '5px 8px',
                        borderRadius: '6px',
                        border: '1px solid #fecaca',
                        background: '#ffffff',
                        color: '#dc2626',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══════════════ MODAL FORM MENU ══════════════ */}
      {tampilModalMenu && (
        <div class="sheet-backdrop" onClick={() => setTampilModalMenu(false)}>
          <div
            class="sheet"
            onClick={(e) => e.stopPropagation()}
            style={{ padding: '20px', maxHeight: '90vh', overflowY: 'auto' }}
          >
            <div class="sheet-handle" />
            <h3 style={{ fontSize: '1.125rem', fontWeight: 800, margin: '0 0 16px', color: '#0f172a' }}>
              {editProdukId ? 'Edit Menu' : 'Tambah Menu Baru'}
            </h3>

            <form onSubmit={handleSimpanMenu} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Foto Menu Upload */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Foto / Gambar Menu
                </label>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div
                    style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '10px',
                      background: '#f8fafc',
                      border: '1px dashed #cbd5e1',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      flexShrink: 0,
                    }}
                  >
                    {formGambar ? (
                      <img src={formGambar} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: '1.75rem' }}>📷</span>
                    )}
                  </div>

                  <div style={{ flex: 1 }}>
                    <input
                      type="file"
                      accept="image/*"
                      id="upload-foto-menu"
                      onChange={handleUploadGambar}
                      style={{ display: 'none' }}
                    />
                    <label
                      htmlFor="upload-foto-menu"
                      style={{
                        display: 'inline-block',
                        padding: '7px 12px',
                        background: '#f1f5f9',
                        color: '#334155',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        marginBottom: '4px',
                      }}
                    >
                      {formGambar ? 'Ganti Foto' : '+ Pilih / Foto Gambar'}
                    </label>
                    {formGambar && (
                      <button
                        type="button"
                        onClick={() => setFormGambar('')}
                        style={{
                          display: 'block',
                          background: 'none',
                          border: 'none',
                          color: '#dc2626',
                          fontSize: '0.6875rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        Hapus Foto
                      </button>
                    )}
                    <span style={{ display: 'block', fontSize: '0.6875rem', color: '#94a3b8' }}>
                      Mendukung kamera HP atau file gambar
                    </span>
                  </div>
                </div>
              </div>

              {/* Kategori Menu */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155' }}>
                    Ikut Kategori Apa? <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setTampilModalMenu(false);
                      setTabAktif('kategori');
                      bukaTambahKategori();
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#2563eb',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    + Kategori Baru
                  </button>
                </div>
                <select
                  value={formKategori}
                  onChange={(e) => setFormKategori((e.target as HTMLSelectElement).value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    background: '#f8fafc',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: '#0f172a',
                  }}
                >
                  {daftarKategori.map((k) => (
                    <option key={k.id} value={k.nama}>
                      {k.nama}
                    </option>
                  ))}
                </select>
              </div>

              {/* Nama Menu */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Nama Menu <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Misal: Ayam Rempah Paha Dada, Es Jeruk Manis..."
                  value={formNamaMenu}
                  onInput={(e) => setFormNamaMenu((e.target as HTMLInputElement).value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    background: '#f8fafc',
                    fontSize: '0.875rem',
                  }}
                />
              </div>

              {/* Baris Harga HPP vs Harga Jual */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Harga HPP / Modal (Rp) <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="Contoh: 11000"
                    value={formHpp}
                    onInput={(e) => setFormHpp(Number((e.target as HTMLInputElement).value))}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      background: '#f8fafc',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                    }}
                  />
                  <span style={{ fontSize: '0.6875rem', color: '#94a3b8' }}>Biaya modal per porsi</span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Harga Jual (Rp) <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="Contoh: 18000"
                    value={formHarga}
                    onInput={(e) => setFormHarga(Number((e.target as HTMLInputElement).value))}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      background: '#f8fafc',
                      fontSize: '0.875rem',
                      fontWeight: 700,
                      color: '#0f172a',
                    }}
                  />
                  <span style={{ fontSize: '0.6875rem', color: '#94a3b8' }}>Harga jual ke pelanggan</span>
                </div>
              </div>

              {/* Kalkulator Keuntungan Realtime */}
              <div
                style={{
                  background: liveCalc.laba >= 0 ? '#f0fdf4' : '#fef2f2',
                  border: `1px solid ${liveCalc.laba >= 0 ? '#bbf7d0' : '#fecaca'}`,
                  borderRadius: '10px',
                  padding: '12px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Kalkulator Keuntungan
                  </span>
                  <span
                    style={{
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      padding: '2px 7px',
                      borderRadius: '4px',
                      background: liveCalc.marginPersen >= 30 ? '#dcfce7' : liveCalc.marginPersen >= 10 ? '#fef9c3' : '#fee2e2',
                      color: liveCalc.marginPersen >= 30 ? '#15803d' : liveCalc.marginPersen >= 10 ? '#854d0e' : '#b91c1c',
                    }}
                  >
                    Margin: {liveCalc.marginPersen}%
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <span style={{ fontSize: '0.6875rem', color: '#64748b', display: 'block' }}>Keuntungan Bersih:</span>
                    <strong style={{ fontSize: '1rem', color: liveCalc.laba >= 0 ? '#15803d' : '#b91c1c' }}>
                      {formatRupiah(liveCalc.laba)}
                    </strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.6875rem', color: '#64748b', display: 'block' }}>Markup Modal:</span>
                    <strong style={{ fontSize: '1rem', color: '#0f172a' }}>
                      {liveCalc.markupPersen}%
                    </strong>
                  </div>
                </div>

                {liveCalc.laba < 0 && (
                  <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: '#b91c1c', fontWeight: 600 }}>
                    ⚠️ Peringatan: Harga jual lebih rendah dari modal HPP!
                  </p>
                )}
              </div>

              {/* Isi / Deskripsi Paket */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Isi / Komposisi Menu (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Misal: Nasi, ayam, sambal bawang, lalapan, es teh..."
                  value={formIsi}
                  onInput={(e) => setFormIsi((e.target as HTMLInputElement).value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    background: '#f8fafc',
                    fontSize: '0.875rem',
                  }}
                />
              </div>

              {/* Status Aktif */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0' }}>
                <input
                  type="checkbox"
                  id="menu-aktif-cb"
                  checked={formAktif}
                  onChange={(e) => setFormAktif((e.target as HTMLInputElement).checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="menu-aktif-cb" style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a', cursor: 'pointer' }}>
                  Aktifkan menu ini (bisa dipesan di kasir)
                </label>
              </div>

              {/* Tombol Aksi */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setTampilModalMenu(false)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: '#f1f5f9',
                    color: '#475569',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: '#0f172a',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Simpan Menu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════ MODAL FORM KATEGORI ══════════════ */}
      {tampilModalKategori && (
        <div class="sheet-backdrop" onClick={() => setTampilModalKategori(false)}>
          <div
            class="sheet"
            onClick={(e) => e.stopPropagation()}
            style={{ padding: '20px', maxWidth: '420px' }}
          >
            <div class="sheet-handle" />
            <h3 style={{ fontSize: '1.125rem', fontWeight: 800, margin: '0 0 16px', color: '#0f172a' }}>
              {editKategoriId ? 'Edit Kategori' : 'Tambah Kategori Baru'}
            </h3>

            <form onSubmit={handleSimpanKategori} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Nama Kategori <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Misal: Paket Ayam, Minuman, Gorengan..."
                  value={formNamaKategori}
                  onInput={(e) => setFormNamaKategori((e.target as HTMLInputElement).value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    background: '#f8fafc',
                    fontSize: '0.875rem',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Urutan Tampilan
                </label>
                <input
                  type="number"
                  min="1"
                  value={formUrutanKategori}
                  onInput={(e) => setFormUrutanKategori(Number((e.target as HTMLInputElement).value))}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    background: '#f8fafc',
                    fontSize: '0.875rem',
                  }}
                />
                <span style={{ fontSize: '0.6875rem', color: '#94a3b8' }}>Urutan tab di layar kasir</span>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setTampilModalKategori(false)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: '#f1f5f9',
                    color: '#475569',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: '#0f172a',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Simpan Kategori
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
