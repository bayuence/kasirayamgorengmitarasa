import { useState, useEffect } from 'preact/hooks';
import {
  muatSemuaMenuAdmin,
  simpanProdukAdmin,
  hapusProdukAdmin,
  simpanTambahanAdmin,
  hapusTambahanAdmin,
  muatProdukDenganHargaOutlet,
  type ProdukDenganHargaOutlet,
} from '../../data/menu.js';
import {
  muatSemuaOutlet,
  simpanOutletAdmin,
  hapusOutletAdmin,
  simpanHargaProdukPerOutlet,
  hapusHargaKhususProdukOutlet,
  outletAktifSignal,
  pilihOutletAktif,
  getProfilOutlet,
  simpanProfilOutlet,
} from '../../data/outlet.js';
import { formatRupiah } from '../../util/rupiah.js';
import type { ProdukItem, TambahanItem, OutletItem } from '../../data/db.js';

export function LayarPengaturan() {
  const getInitialTab = (): 'produk' | 'tambahan' | 'outlet' | 'harga_outlet' | 'struk' => {
    const hash = window.location.hash;
    if (hash.includes('tab=tambahan')) return 'tambahan';
    if (hash.includes('tab=outlet')) return 'outlet';
    if (hash.includes('tab=harga_outlet')) return 'harga_outlet';
    if (hash.includes('tab=struk')) return 'struk';
    return 'produk';
  };

  const [tabAktif, setTabAktif] = useState<'produk' | 'tambahan' | 'outlet' | 'harga_outlet' | 'struk'>(getInitialTab);

  // Data Menu Master
  const [daftarProduk, setDaftarProduk] = useState<ProdukItem[]>([]);
  const [daftarTambahan, setDaftarTambahan] = useState<TambahanItem[]>([]);
  const [loadingMenu, setLoadingMenu] = useState(true);

  // Data Outlet / Lokasi
  const [daftarOutlet, setDaftarOutlet] = useState<OutletItem[]>([]);
  const [outletTerpilihHarga, setOutletTerpilihHarga] = useState<string>('');
  const [produkHargaOutlet, setProdukHargaOutlet] = useState<ProdukDenganHargaOutlet[]>([]);
  const [loadingHargaOutlet, setLoadingHargaOutlet] = useState(false);

  // Form Tambah Produk
  const [tampilModalProduk, setTampilModalProduk] = useState(false);
  const [formVarian, setFormVarian] = useState('Ayam Rempah Jawa');
  const [formPaket, setFormPaket] = useState('');
  const [formIsi, setFormIsi] = useState('');
  const [formHarga, setFormHarga] = useState<number | ''>('');

  // Form Tambah Tambahan
  const [tampilModalTambahan, setTampilModalTambahan] = useState(false);
  const [formNamaTambahan, setFormNamaTambahan] = useState('');
  const [formHargaTambahan, setFormHargaTambahan] = useState<number | ''>('');

  // Form Tambah / Edit Outlet
  const [tampilModalOutlet, setTampilModalOutlet] = useState(false);
  const [editOutletId, setEditOutletId] = useState<string | null>(null);
  const [formOutletKode, setFormOutletKode] = useState('');
  const [formOutletNama, setFormOutletNama] = useState('');
  const [formOutletAlamat, setFormOutletAlamat] = useState('');
  const [formOutletTelepon, setFormOutletTelepon] = useState('');
  const [formOutletStruk, setFormOutletStruk] = useState('Terima kasih atas kunjungan Anda!');

  // Form input harga per produk di outlet yang dipilih (state draft: { [produkId]: { harga: string, aktif: boolean } })
  const [draftHargaOutlet, setDraftHargaOutlet] = useState<Record<string, { harga: string; aktif: boolean }>>({});

  // Profil Struk Legacy
  const [profilStruk, setProfilStruk] = useState(getProfilOutlet());
  const [pesanSukses, setPesanSukses] = useState('');

  useEffect(() => {
    muatData();
  }, []);

  useEffect(() => {
    if (tabAktif === 'harga_outlet' && outletTerpilihHarga) {
      muatDataHargaOutlet(outletTerpilihHarga);
    }
  }, [tabAktif, outletTerpilihHarga]);

  const muatData = async () => {
    setLoadingMenu(true);
    const { produk, tambahan } = await muatSemuaMenuAdmin();
    setDaftarProduk(produk);
    setDaftarTambahan(tambahan);

    const outlets = await muatSemuaOutlet();
    setDaftarOutlet(outlets);

    const currentOutletId = outletAktifSignal.value?.id || (outlets[0] ? outlets[0].id : '');
    setOutletTerpilihHarga(currentOutletId);

    if (currentOutletId) {
      await muatDataHargaOutlet(currentOutletId);
    }

    setLoadingMenu(false);
  };

  const muatDataHargaOutlet = async (outletId: string) => {
    setLoadingHargaOutlet(true);
    const data = await muatProdukDenganHargaOutlet(outletId);
    setProdukHargaOutlet(data);

    // Siapkan draft state untuk input harga
    const draft: Record<string, { harga: string; aktif: boolean }> = {};
    for (const item of data) {
      draft[item.produk.id] = {
        harga: item.hargaKhusus !== null ? String(item.hargaKhusus) : '',
        aktif: item.aktifDiOutlet,
      };
    }
    setDraftHargaOutlet(draft);
    setLoadingHargaOutlet(false);
  };

  const tampilkanNotif = (pesan: string) => {
    setPesanSukses(pesan);
    setTimeout(() => setPesanSukses(''), 3000);
  };

  // ── AKSI MASTER PRODUK ──
  const handleToggleAktifProduk = async (item: ProdukItem) => {
    const updated = { ...item, aktif: !item.aktif, diubah_pada: new Date().toISOString() };
    await simpanProdukAdmin(updated);
    muatData();
  };

  const handleSimpanProdukBaru = async (e: Event) => {
    e.preventDefault();
    if (!formPaket || formHarga === '') return;

    const baru: ProdukItem = {
      id: crypto.randomUUID(),
      varian: formVarian,
      paket: formPaket,
      isi: formIsi,
      harga: Number(formHarga),
      urutan: daftarProduk.length + 1,
      aktif: true,
      diubah_pada: new Date().toISOString(),
    };

    await simpanProdukAdmin(baru);
    setTampilModalProduk(false);
    setFormPaket('');
    setFormIsi('');
    setFormHarga('');
    tampilkanNotif('Produk baru berhasil disimpan ke master pusat');
    muatData();
  };

  const handleHapusProduk = async (id: string, nama: string) => {
    if (confirm(`Hapus produk "${nama}" dari master?`)) {
      await hapusProdukAdmin(id);
      tampilkanNotif('Produk berhasil dihapus');
      muatData();
    }
  };

  // ── AKSI TAMBAHAN ──
  const handleToggleAktifTambahan = async (item: TambahanItem) => {
    const updated = { ...item, aktif: !item.aktif, diubah_pada: new Date().toISOString() };
    await simpanTambahanAdmin(updated);
    muatData();
  };

  const handleSimpanTambahanBaru = async (e: Event) => {
    e.preventDefault();
    if (!formNamaTambahan || formHargaTambahan === '') return;

    const baru: TambahanItem = {
      id: crypto.randomUUID(),
      nama: formNamaTambahan,
      harga: Number(formHargaTambahan),
      urutan: daftarTambahan.length + 1,
      aktif: true,
      diubah_pada: new Date().toISOString(),
    };

    await simpanTambahanAdmin(baru);
    setTampilModalTambahan(false);
    setFormNamaTambahan('');
    setFormHargaTambahan('');
    tampilkanNotif('Item tambahan berhasil disimpan');
    muatData();
  };

  const handleHapusTambahan = async (id: string, nama: string) => {
    if (confirm(`Hapus tambahan "${nama}"?`)) {
      await hapusTambahanAdmin(id);
      tampilkanNotif('Item tambahan berhasil dihapus');
      muatData();
    }
  };

  // ── AKSI OUTLET / CABANG ──
  const handleBukaModalTambahOutlet = () => {
    setEditOutletId(null);
    setFormOutletKode('');
    setFormOutletNama('');
    setFormOutletAlamat('');
    setFormOutletTelepon('');
    setFormOutletStruk('Terima kasih atas kunjungan Anda!');
    setTampilModalOutlet(true);
  };

  const handleBukaModalEditOutlet = (o: OutletItem) => {
    setEditOutletId(o.id);
    setFormOutletKode(o.kode);
    setFormOutletNama(o.nama);
    setFormOutletAlamat(o.alamat || '');
    setFormOutletTelepon(o.telepon || '');
    setFormOutletStruk(o.catatan_struk || '');
    setTampilModalOutlet(true);
  };

  const handleSimpanOutlet = async (e: Event) => {
    e.preventDefault();
    if (!formOutletKode.trim() || !formOutletNama.trim()) {
      alert('Kode cabang dan nama toko wajib diisi.');
      return;
    }

    const item: OutletItem = {
      id: editOutletId || crypto.randomUUID(),
      kode: formOutletKode.trim().toUpperCase(),
      nama: formOutletNama.trim(),
      alamat: formOutletAlamat.trim(),
      telepon: formOutletTelepon.trim(),
      catatan_struk: formOutletStruk.trim(),
      aktif: true,
      diubah_pada: new Date().toISOString(),
    };

    await simpanOutletAdmin(item);
    setTampilModalOutlet(false);
    tampilkanNotif(editOutletId ? 'Data cabang berhasil diperbarui' : 'Cabang baru berhasil ditambahkan');
    muatData();
  };

  const handlePilihCabangAktifKasir = (o: OutletItem) => {
    pilihOutletAktif(o);
    tampilkanNotif(`Kasir perangkat ini disetel ke cabang: ${o.nama}`);
  };

  const handleToggleAktifOutlet = async (o: OutletItem) => {
    const updated = { ...o, aktif: !o.aktif, diubah_pada: new Date().toISOString() };
    await simpanOutletAdmin(updated);
    tampilkanNotif(`Status cabang ${o.nama} diubah`);
    muatData();
  };

  // ── AKSI HARGA KHUSUS PER TOKO ──
  const handleSimpanHargaKhususProduk = async (produkId: string) => {
    if (!outletTerpilihHarga) return;
    const draft = draftHargaOutlet[produkId];
    if (!draft) return;

    if (draft.harga.trim() === '') {
      // Jika dikosongkan, reset ke harga master
      await hapusHargaKhususProdukOutlet(outletTerpilihHarga, produkId);
      tampilkanNotif('Harga direset ke harga dasar pusat');
    } else {
      const nominal = Number(draft.harga);
      if (isNaN(nominal) || nominal < 0) {
        alert('Masukkan nominal harga yang valid');
        return;
      }
      await simpanHargaProdukPerOutlet(outletTerpilihHarga, produkId, nominal, draft.aktif);
      tampilkanNotif('Harga khusus cabang berhasil disimpan');
    }

    await muatDataHargaOutlet(outletTerpilihHarga);
  };

  const handleResetHargaKhusus = async (produkId: string) => {
    if (!outletTerpilihHarga) return;
    await hapusHargaKhususProdukOutlet(outletTerpilihHarga, produkId);
    tampilkanNotif('Harga kembali mengikuti harga dasar pusat');
    await muatDataHargaOutlet(outletTerpilihHarga);
  };

  // ── AKSI STRUK ──
  const handleSimpanStruk = (e: Event) => {
    e.preventDefault();
    simpanProfilOutlet(profilStruk);
    tampilkanNotif('Pengaturan struk berhasil disimpan');
  };

  const outletAktif = outletAktifSignal.value;

  return (
    <div style={{ padding: '20px 16px 80px' }}>
      {/* Header Halaman */}
      <div style={{ marginBottom: '18px' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#0f172a', letterSpacing: '-0.02em' }}>
          Pengaturan Toko & Kasir
        </h2>
        <p style={{ fontSize: '0.8125rem', color: '#64748b', marginTop: '3px', marginBottom: 0 }}>
          Kelola cabang toko, penetapan harga per lokasi, katalog produk & struk
        </p>
      </div>

      {/* Notifikasi Status */}
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

      {/* Segmented Tab Bar Modern */}
      <div
        style={{
          display: 'flex',
          overflowX: 'auto',
          background: '#f1f5f9',
          borderRadius: '8px',
          padding: '3px',
          gap: '2px',
          marginBottom: '18px',
          scrollbarWidth: 'none',
        }}
      >
        <TabButton label="Menu Pusat" aktif={tabAktif === 'produk'} onClick={() => setTabAktif('produk')} />
        <TabButton label="Tambahan" aktif={tabAktif === 'tambahan'} onClick={() => setTabAktif('tambahan')} />
        <TabButton label="Lokasi & Toko" aktif={tabAktif === 'outlet'} onClick={() => setTabAktif('outlet')} />
        <TabButton label="Harga per Toko" aktif={tabAktif === 'harga_outlet'} onClick={() => setTabAktif('harga_outlet')} />
        <TabButton label="Struk" aktif={tabAktif === 'struk'} onClick={() => setTabAktif('struk')} />
      </div>

      {/* ══════════════════════════════════════════════════════
          TAB 1: KELOLA MASTER PRODUK (PUSAT)
          ══════════════════════════════════════════════════════ */}
      {tabAktif === 'produk' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Katalog Master Pusat ({daftarProduk.length})
              </span>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '2px 0 0' }}>
                Harga dasar acuan sebelum penyesuaian khusus per cabang
              </p>
            </div>
            <button
              type="button"
              onClick={() => setTampilModalProduk(true)}
              style={{
                padding: '6px 14px',
                background: '#0f172a',
                color: '#ffffff',
                borderRadius: '6px',
                fontSize: '0.8125rem',
                fontWeight: 600,
                border: 'none',
                minHeight: '34px',
                minWidth: 'auto',
                cursor: 'pointer',
              }}
            >
              + Tambah Menu
            </button>
          </div>

          {loadingMenu ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Memuat katalog...</div>
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
                      onClick={() => handleToggleAktifProduk(item)}
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
                      onClick={() => handleHapusProduk(item.id, `${item.varian} - ${item.paket}`)}
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
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          TAB 2: KELOLA TAMBAHAN
          ══════════════════════════════════════════════════════ */}
      {tabAktif === 'tambahan' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Item Tambahan & Add-ons ({daftarTambahan.length})
            </span>
            <button
              type="button"
              onClick={() => setTampilModalTambahan(true)}
              style={{
                padding: '6px 14px',
                background: '#0f172a',
                color: '#ffffff',
                borderRadius: '6px',
                fontSize: '0.8125rem',
                fontWeight: 600,
                border: 'none',
                minHeight: '34px',
                minWidth: 'auto',
                cursor: 'pointer',
              }}
            >
              + Tambah Item
            </button>
          </div>

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
                    onClick={() => handleToggleAktifTambahan(item)}
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
                    onClick={() => handleHapusTambahan(item.id, item.nama)}
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
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          TAB 3: LOKASI & CABANG TOKO (MULTI-OUTLET)
          ══════════════════════════════════════════════════════ */}
      {tabAktif === 'outlet' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Box Cabang Aktif Perangkat Ini */}
          {outletAktif && (
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '16px',
              }}
            >
              <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Cabang Aktif di Perangkat Ini
              </span>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                <div>
                  <h3 style={{ fontSize: '1.0625rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                    {outletAktif.nama}
                  </h3>
                  <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '2px 0 0' }}>
                    Kode: <strong style={{ color: '#0f172a' }}>{outletAktif.kode}</strong> • {outletAktif.alamat || 'Alamat belum diatur'}
                  </p>
                </div>
                <span
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    padding: '3px 8px',
                    borderRadius: '999px',
                    background: '#f0fdf4',
                    color: '#15803d',
                    border: '1px solid #bbf7d0',
                  }}
                >
                  ● Aktif
                </span>
              </div>
            </div>
          )}

          {/* Daftar Semua Cabang */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                  Daftar Cabang & Lokasi Toko ({daftarOutlet.length})
                </h3>
                <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '2px 0 0' }}>
                  Pilih cabang untuk mengaktifkan kasir atau tambah lokasi baru
                </p>
              </div>

              <button
                type="button"
                onClick={handleBukaModalTambahOutlet}
                style={{
                  padding: '6px 14px',
                  background: '#0f172a',
                  color: '#ffffff',
                  borderRadius: '6px',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  border: 'none',
                  minHeight: '34px',
                  minWidth: 'auto',
                  cursor: 'pointer',
                }}
              >
                + Tambah Cabang
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {daftarOutlet.map((o) => {
                const isCurrent = o.id === outletAktif?.id;
                return (
                  <div
                    key={o.id}
                    style={{
                      background: '#ffffff',
                      border: isCurrent ? '2px solid #0f172a' : '1px solid #e2e8f0',
                      borderRadius: '12px',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      boxShadow: isCurrent ? '0 2px 8px rgba(15,23,42,0.06)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                          <span
                            style={{
                              fontSize: '0.6875rem',
                              fontWeight: 700,
                              background: '#0f172a',
                              color: '#ffffff',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              letterSpacing: '0.04em',
                            }}
                          >
                            {o.kode}
                          </span>
                          <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                            {o.nama}
                          </h4>
                        </div>
                        <p style={{ fontSize: '0.78125rem', color: '#64748b', margin: '2px 0' }}>
                          📍 {o.alamat || 'Alamat belum diatur'}
                        </p>
                        {o.telepon && (
                          <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '1px 0 0' }}>
                            📞 {o.telepon}
                          </p>
                        )}
                      </div>

                      {isCurrent ? (
                        <span
                          style={{
                            fontSize: '0.6875rem',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '4px',
                            background: '#0f172a',
                            color: '#ffffff',
                          }}
                        >
                          Perangkat Ini
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handlePilihCabangAktifKasir(o)}
                          style={{
                            padding: '5px 10px',
                            background: '#f8fafc',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: '#0f172a',
                            cursor: 'pointer',
                            minHeight: '30px',
                            minWidth: 'auto',
                          }}
                        >
                          Gunakan Cabang Ini
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid #f1f5f9' }}>
                      <span style={{ fontSize: '0.75rem', color: o.aktif ? '#16a34a' : '#94a3b8', fontWeight: 600 }}>
                        {o.aktif ? '● Beroperasi Aktif' : '○ Nonaktif'}
                      </span>

                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setTabAktif('harga_outlet');
                            setOutletTerpilihHarga(o.id);
                          }}
                          style={{
                            padding: '4px 8px',
                            background: '#f1f5f9',
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: '#0f172a',
                            cursor: 'pointer',
                            minHeight: '28px',
                            minWidth: 'auto',
                          }}
                        >
                          Atur Harga Toko Ini ›
                        </button>
                        <button
                          type="button"
                          onClick={() => handleBukaModalEditOutlet(o)}
                          style={{
                            padding: '4px 8px',
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: '#475569',
                            cursor: 'pointer',
                            minHeight: '28px',
                            minWidth: 'auto',
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleAktifOutlet(o)}
                          style={{
                            padding: '4px 8px',
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: o.aktif ? '#d97706' : '#16a34a',
                            cursor: 'pointer',
                            minHeight: '28px',
                            minWidth: 'auto',
                          }}
                        >
                          {o.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          TAB 4: HARGA KHUSUS PER TOKO / CABANG
          ══════════════════════════════════════════════════════ */}
      {tabAktif === 'harga_outlet' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Pemilih Cabang */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '16px',
            }}
          >
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
              Pilih Cabang untuk Penyesuaian Harga:
            </label>
            <select
              value={outletTerpilihHarga}
              onChange={(e) => {
                const val = (e.target as HTMLSelectElement).value;
                setOutletTerpilihHarga(val);
                muatDataHargaOutlet(val);
              }}
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
                  {o.nama} ({o.kode}) {o.id === outletAktif?.id ? '★ Cabang Kasir Ini' : ''}
                </option>
              ))}
            </select>
            <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '8px 0 0' }}>
              💡 Masukkan harga khusus untuk cabang ini. Jika dibiarkan kosong, produk akan otomatis menggunakan <strong>Harga Dasar Pusat</strong>.
            </p>
          </div>

          {/* Daftar Produk dengan Harga Khusus */}
          <div>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '10px' }}>
              Daftar Menu & Penetapan Harga ({produkHargaOutlet.length})
            </span>

            {loadingHargaOutlet ? (
              <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>Memuat data harga cabang...</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {produkHargaOutlet.map(({ produk, hargaKhusus, hargaEfektif, aktifDiOutlet }) => {
                  const draft = draftHargaOutlet[produk.id] || {
                    harga: hargaKhusus !== null ? String(hargaKhusus) : '',
                    aktif: aktifDiOutlet,
                  };
                  const isCustom = hargaKhusus !== null;

                  return (
                    <div
                      key={produk.id}
                      style={{
                        background: '#ffffff',
                        border: isCustom ? '1px solid #93c5fd' : '1px solid #e2e8f0',
                        borderRadius: '10px',
                        padding: '14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                      }}
                    >
                      {/* Baris Atas: Info Menu & Harga Pusat */}
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
                            Harga Pusat: <strong style={{ color: '#0f172a' }}>{formatRupiah(produk.harga)}</strong>
                          </span>
                        </div>

                        {/* Status Harga Toko */}
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

                      {/* Baris Bawah: Input Harga Khusus & Aksi */}
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <div style={{ flex: 1, position: 'relative' }}>
                          <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.8125rem', color: '#94a3b8', fontWeight: 600 }}>
                            Rp
                          </span>
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder={`Standar: ${produk.harga}`}
                            value={draft.harga}
                            onInput={(e) => {
                              const val = (e.target as HTMLInputElement).value.replace(/\D/g, '');
                              setDraftHargaOutlet({
                                ...draftHargaOutlet,
                                [produk.id]: { ...draft, harga: val },
                              });
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

                        {/* Tombol Simpan */}
                        <button
                          type="button"
                          onClick={() => handleSimpanHargaKhususProduk(produk.id)}
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

                        {/* Tombol Reset jika ada harga khusus */}
                        {isCustom && (
                          <button
                            type="button"
                            onClick={() => handleResetHargaKhusus(produk.id)}
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
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          TAB 5: FORMAT STRUK & PRINTER
          ══════════════════════════════════════════════════════ */}
      {tabAktif === 'struk' && (
        <form
          onSubmit={handleSimpanStruk}
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '20px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Lebar Kertas Printer Thermal
            </label>
            <select
              value={profilStruk.ukuranKertas}
              onChange={(e) => setProfilStruk({ ...profilStruk, ukuranKertas: (e.target as HTMLSelectElement).value as any })}
              style={{
                width: '100%',
                padding: '11px 12px',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                background: '#f8fafc',
                fontSize: '0.875rem',
                color: '#0f172a',
                boxSizing: 'border-box',
                outline: 'none',
              }}
            >
              <option value="58mm">58 mm (Printer Kasir Portable Bluetooth)</option>
              <option value="80mm">80 mm (Printer Desktop)</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Kode Perangkat Kasir Ini
            </label>
            <input
              type="text"
              maxLength={2}
              value={profilStruk.kodePerangkat}
              onInput={(e) => setProfilStruk({ ...profilStruk, kodePerangkat: (e.target as HTMLInputElement).value })}
              style={{
                width: '100%',
                padding: '11px 12px',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                background: '#f8fafc',
                fontSize: '0.875rem',
                fontWeight: 700,
                color: '#0f172a',
                boxSizing: 'border-box',
                outline: 'none',
                textTransform: 'uppercase',
              }}
            />
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px', display: 'block' }}>
              Awalan kode struk transaksi (misal: A-001)
            </span>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Pesan Footer Struk (Catatan Bawah Nota)
            </label>
            <textarea
              rows={3}
              value={profilStruk.pesanFooter}
              onInput={(e) => setProfilStruk({ ...profilStruk, pesanFooter: (e.target as HTMLTextAreaElement).value })}
              placeholder="Terima kasih atas kunjungan Anda!"
              style={{
                width: '100%',
                padding: '11px 12px',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                background: '#f8fafc',
                fontSize: '0.875rem',
                color: '#0f172a',
                boxSizing: 'border-box',
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />
          </div>

          <button
            type="submit"
            style={{
              marginTop: '6px',
              padding: '12px 16px',
              background: '#0f172a',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              minHeight: '44px',
            }}
          >
            Simpan Konfigurasi Struk
          </button>
        </form>
      )}

      {/* ── MODAL TAMBAH PRODUK BARU ── */}
      {tampilModalProduk && (
        <div class="sheet-backdrop" onClick={() => setTampilModalProduk(false)}>
          <div class="sheet" onClick={(e) => e.stopPropagation()} style={{ padding: '24px 20px' }}>
            <div class="sheet-handle" />
            <h3 style={{ fontSize: '1.0625rem', fontWeight: 700, margin: '0 0 16px', color: '#0f172a' }}>
              Tambah Menu Baru (Pusat)
            </h3>
            <form onSubmit={handleSimpanProdukBaru} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Varian
                </label>
                <select
                  value={formVarian}
                  onChange={(e) => setFormVarian((e.target as HTMLSelectElement).value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    background: '#f8fafc',
                    fontSize: '0.875rem',
                  }}
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
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    background: '#f8fafc',
                    fontSize: '0.875rem',
                  }}
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
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    background: '#f8fafc',
                    fontSize: '0.875rem',
                  }}
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
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    background: '#f8fafc',
                    fontSize: '0.875rem',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setTampilModalProduk(false)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: '#f1f5f9',
                    color: '#475569',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    fontWeight: 600,
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
                  }}
                >
                  Simpan Produk
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL TAMBAH TAMBAHAN ── */}
      {tampilModalTambahan && (
        <div class="sheet-backdrop" onClick={() => setTampilModalTambahan(false)}>
          <div class="sheet" onClick={(e) => e.stopPropagation()} style={{ padding: '24px 20px' }}>
            <div class="sheet-handle" />
            <h3 style={{ fontSize: '1.0625rem', fontWeight: 700, margin: '0 0 16px', color: '#0f172a' }}>
              Tambah Item Tambahan
            </h3>
            <form onSubmit={handleSimpanTambahanBaru} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Nama Tambahan
                </label>
                <input
                  type="text"
                  required
                  placeholder="Misal: Sambal Matah"
                  value={formNamaTambahan}
                  onInput={(e) => setFormNamaTambahan((e.target as HTMLInputElement).value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    background: '#f8fafc',
                    fontSize: '0.875rem',
                  }}
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
                  value={formHargaTambahan}
                  onInput={(e) => setFormHargaTambahan(Number((e.target as HTMLInputElement).value))}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    background: '#f8fafc',
                    fontSize: '0.875rem',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setTampilModalTambahan(false)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: '#f1f5f9',
                    color: '#475569',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    fontWeight: 600,
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
                  }}
                >
                  Simpan Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL TAMBAH / EDIT CABANG OUTLET ── */}
      {tampilModalOutlet && (
        <div class="sheet-backdrop" onClick={() => setTampilModalOutlet(false)}>
          <div class="sheet" onClick={(e) => e.stopPropagation()} style={{ padding: '24px 20px' }}>
            <div class="sheet-handle" />
            <h3 style={{ fontSize: '1.0625rem', fontWeight: 700, margin: '0 0 16px', color: '#0f172a' }}>
              {editOutletId ? 'Edit Data Cabang' : 'Tambah Cabang Baru'}
            </h3>
            <form onSubmit={handleSimpanOutlet} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Kode Cabang (Singkat)
                </label>
                <input
                  type="text"
                  required
                  placeholder="Misal: MANYAR, GKB, SBY01"
                  value={formOutletKode}
                  onInput={(e) => setFormOutletKode((e.target as HTMLInputElement).value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    background: '#f8fafc',
                    fontSize: '0.875rem',
                    textTransform: 'uppercase',
                    fontWeight: 600,
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Nama Lengkap Cabang / Toko
                </label>
                <input
                  type="text"
                  required
                  placeholder="Misal: Ayam Goreng Mitarasa - Manyar"
                  value={formOutletNama}
                  onInput={(e) => setFormOutletNama((e.target as HTMLInputElement).value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    background: '#f8fafc',
                    fontSize: '0.875rem',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Alamat Lengkap Toko
                </label>
                <input
                  type="text"
                  placeholder="Misal: Jl. Raya Manyar No. 88, Gresik"
                  value={formOutletAlamat}
                  onInput={(e) => setFormOutletAlamat((e.target as HTMLInputElement).value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    background: '#f8fafc',
                    fontSize: '0.875rem',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Nomor Telepon / WhatsApp Toko
                </label>
                <input
                  type="text"
                  placeholder="0812-xxxx-xxxx"
                  value={formOutletTelepon}
                  onInput={(e) => setFormOutletTelepon((e.target as HTMLInputElement).value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    background: '#f8fafc',
                    fontSize: '0.875rem',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Pesan Khusus Struk Cabang Ini
                </label>
                <input
                  type="text"
                  placeholder="Terima kasih atas kunjungan Anda!"
                  value={formOutletStruk}
                  onInput={(e) => setFormOutletStruk((e.target as HTMLInputElement).value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    background: '#f8fafc',
                    fontSize: '0.875rem',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setTampilModalOutlet(false)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: '#f1f5f9',
                    color: '#475569',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    fontWeight: 600,
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
                  }}
                >
                  Simpan Cabang
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function TabButton({
  label,
  aktif,
  onClick,
}: {
  label: string;
  aktif: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        padding: '8px 12px',
        borderRadius: '6px',
        border: 'none',
        background: aktif ? '#ffffff' : 'transparent',
        color: aktif ? '#0f172a' : '#64748b',
        fontWeight: aktif ? 700 : 500,
        fontSize: '0.8125rem',
        cursor: 'pointer',
        boxShadow: aktif ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
        whiteSpace: 'nowrap',
        minHeight: '34px',
        minWidth: 'auto',
        transition: 'all 0.12s ease',
      }}
    >
      {label}
    </button>
  );
}
