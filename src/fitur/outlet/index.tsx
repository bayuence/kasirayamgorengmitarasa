import { useState, useEffect } from 'preact/hooks';
import {
  muatSemuaOutlet,
  simpanOutletAdmin,
  hapusOutletAdmin,
  imporOutletDariPresensi,
  sinkronkanCabangDariPresensi,
  outletAktifSignal,
  pilihOutletAktif,
} from '../../data/outlet.js';
import {
  muatDaftarLokasiPresensi,
  type LokasiPresensi,
} from '../../data/presensi.js';
import type { OutletItem } from '../../data/db.js';

export function LayarKelolaOutlet() {
  const [daftarOutlet, setDaftarOutlet] = useState<OutletItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pesanSukses, setPesanSukses] = useState('');

  // Modal State
  const [tampilModal, setTampilModal] = useState(false);
  const [tabModal, setTabModal] = useState<'manual' | 'presensi'>('manual');
  const [editId, setEditId] = useState<string | null>(null);

  // Form Input Manual
  const [formKode, setFormKode] = useState('');
  const [formNama, setFormNama] = useState('');
  const [formAlamat, setFormAlamat] = useState('');
  const [formTelepon, setFormTelepon] = useState('');
  const [formStruk, setFormStruk] = useState('Terima kasih atas kunjungan Anda!');
  const [formSumber, setFormSumber] = useState<'manual' | 'presensi'>('manual');
  const [formPresensiLocId, setFormPresensiLocId] = useState<string | null>(null);

  // Data Lokasi Presensi Donattour
  const [lokasiPresensi, setLokasiPresensi] = useState<LokasiPresensi[]>([]);
  const [loadingPresensi, setLoadingPresensi] = useState(false);
  const [imporLoadingId, setImporLoadingId] = useState<string | null>(null);
  const [loadingSync, setLoadingSync] = useState(false);

  useEffect(() => {
    muatData();
  }, []);

  const muatData = async () => {
    setLoading(true);
    try {
      const data = await muatSemuaOutlet();
      setDaftarOutlet(data || []);

      // Jika ada cabang dari Presensi dan perangkat sedang online, sinkronkan otomatis di latar belakang
      if (data && data.some((o) => o.sumber === 'presensi') && navigator.onLine) {
        sinkronkanCabangDariPresensi().then((res) => {
          if (res.diubah > 0) {
            muatSemuaOutlet().then((fresh) => setDaftarOutlet(fresh || []));
          }
        }).catch(() => {});
      }
    } catch (e) {
      console.warn('Gagal muat outlet:', e);
      setDaftarOutlet([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSinkronkanPresensi = async () => {
    setLoadingSync(true);
    try {
      const res = await sinkronkanCabangDariPresensi();
      if (res.diubah > 0) {
        notifikasi(`Berhasil memperbarui ${res.diubah} cabang dari Presensi: ${res.daftar.join(', ')}`);
      } else {
        notifikasi('Semua data cabang sudah sinkron dengan Presensi Donattour');
      }
      const data = await muatSemuaOutlet();
      setDaftarOutlet(data || []);
    } catch (err: any) {
      alert(`Gagal sinkronisasi: ${err.message || 'Periksa jaringan internet'}`);
    } finally {
      setLoadingSync(false);
    }
  };

  const muatPresensi = async () => {
    setLoadingPresensi(true);
    try {
      const list = await muatDaftarLokasiPresensi();
      setLokasiPresensi(list);
    } catch (e) {
      console.warn('Gagal muat lokasi presensi:', e);
      setLokasiPresensi([]);
    } finally {
      setLoadingPresensi(false);
    }
  };

  const notifikasi = (teks: string) => {
    setPesanSukses(teks);
    setTimeout(() => setPesanSukses(''), 4000);
  };

  const handleBukaTambah = (tab: 'manual' | 'presensi' = 'manual') => {
    setEditId(null);
    setTabModal(tab);
    setFormKode('');
    setFormNama('');
    setFormAlamat('');
    setFormTelepon('');
    setFormStruk('Terima kasih atas kunjungan Anda!');
    setFormSumber('manual');
    setFormPresensiLocId(null);
    setTampilModal(true);

    if (tab === 'presensi') {
      muatPresensi();
    }
  };

  const handleBukaEdit = (o: OutletItem) => {
    setEditId(o.id);
    setTabModal('manual');
    setFormKode(o.kode);
    setFormNama(o.nama);
    setFormAlamat(o.alamat || '');
    setFormTelepon(o.telepon || '');
    setFormStruk(o.catatan_struk || '');
    setFormSumber(o.sumber || 'manual');
    setFormPresensiLocId(o.presensi_location_id || null);
    setTampilModal(true);
  };

  const handleSimpanManual = async (e: Event) => {
    e.preventDefault();
    if (!formKode.trim() || !formNama.trim()) {
      alert('Kode cabang dan nama toko wajib diisi.');
      return;
    }

    const item: OutletItem = {
      id: editId || crypto.randomUUID(),
      kode: formKode.trim().toUpperCase(),
      nama: formNama.trim(),
      alamat: formAlamat.trim(),
      telepon: formTelepon.trim(),
      catatan_struk: formStruk.trim(),
      aktif: true,
      sumber: formSumber,
      presensi_location_id: formPresensiLocId,
      diubah_pada: new Date().toISOString(),
    };

    await simpanOutletAdmin(item);
    setTampilModal(false);
    notifikasi(editId ? 'Data cabang berhasil diperbarui' : 'Cabang baru berhasil disimpan ke database');
    muatData();
  };

  const handleImporLokasi = async (lokasi: LokasiPresensi) => {
    setImporLoadingId(lokasi.id);
    try {
      const baru = await imporOutletDariPresensi(lokasi);
      notifikasi(`Cabang "${baru.nama}" berhasil diimpor dari Presensi dengan label [Dari Presensi]`);
      setTampilModal(false);
      muatData();
    } catch (e: any) {
      alert(`Gagal mengimpor cabang: ${e.message || 'Kesalahan jaringan'}`);
    } finally {
      setImporLoadingId(null);
    }
  };

  const handlePilihCabang = (o: OutletItem) => {
    pilihOutletAktif(o);
    notifikasi(`Kasir perangkat ini disetel ke cabang: ${o.nama}`);
  };

  const handleToggleAktif = async (o: OutletItem) => {
    const updated = { ...o, aktif: !o.aktif, diubah_pada: new Date().toISOString() };
    await simpanOutletAdmin(updated);
    notifikasi(`Status cabang ${o.nama} diubah`);
    muatData();
  };

  const handleHapusCabang = async (o: OutletItem) => {
    if (confirm(`Hapus cabang "${o.nama}" (${o.kode}) dari sistem Kasir Mitarasa?`)) {
      await hapusOutletAdmin(o.id);
      notifikasi(`Cabang "${o.nama}" telah dihapus`);
      muatData();
    }
  };

  const outletAktif = outletAktifSignal.value;

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px', gap: '8px' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#0f172a', letterSpacing: '-0.02em' }}>
            Lokasi & Cabang Toko
          </h2>
          <p style={{ fontSize: '0.8125rem', color: '#64748b', marginTop: '3px', marginBottom: 0 }}>
            Pilih cabang aktif kasir dan kelola cabang manual maupun dari presensi
          </p>
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          {daftarOutlet.some((o) => o.sumber === 'presensi') && (
            <button
              type="button"
              disabled={loadingSync}
              onClick={handleSinkronkanPresensi}
              title="Sinkronkan pembaruan nama cabang dari Presensi"
              style={{
                padding: '8px 12px',
                background: '#eff6ff',
                color: '#1d4ed8',
                borderRadius: '6px',
                fontSize: '0.8125rem',
                fontWeight: 600,
                border: '1px solid #bfdbfe',
                cursor: loadingSync ? 'not-allowed' : 'pointer',
                minHeight: '36px',
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ animation: loadingSync ? 'spin 1s linear infinite' : 'none' }}
              >
                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
              </svg>
              <span>{loadingSync ? 'Sinkron...' : 'Sinkron Presensi'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => handleBukaTambah('manual')}
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
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Tambah Cabang</span>
          </button>
        </div>
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
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>{pesanSukses}</span>
        </div>
      )}

      {/* Banner Cabang Aktif Kasir Saat Ini (Hanya tampil jika ada cabang terdaftar) */}
      {daftarOutlet.length > 0 && outletAktif && outletAktif.id && (
        <div
          style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Cabang Aktif di Perangkat Kasir Ini
            </span>

            {/* Label Asal Data */}
            {outletAktif.sumber === 'presensi' ? (
              <span
                style={{
                  fontSize: '0.625rem',
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: '#eff6ff',
                  color: '#1d4ed8',
                  border: '1px solid #bfdbfe',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 21h18"/>
                  <path d="M5 21V7l8-4v18"/>
                  <path d="M19 21V11l-6-4"/>
                </svg>
                Dari Presensi
              </span>
            ) : (
              <span
                style={{
                  fontSize: '0.625rem',
                  fontWeight: 600,
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: '#f1f5f9',
                  color: '#475569',
                  border: '1px solid #e2e8f0',
                }}
              >
                Input Manual
              </span>
            )}
          </div>

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
        <div style={{ marginBottom: '10px' }}>
          <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
            Daftar Cabang & Lokasi Toko ({daftarOutlet.length})
          </h3>
          <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '2px 0 0' }}>
            Pilih cabang untuk mengaktifkan kasir atau atur harga khusus per toko
          </p>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Memuat daftar cabang...</div>
        ) : daftarOutlet.length === 0 ? (
          /* Empty State dengan 2 Pilihan Tambah */
          <div
            style={{
              textAlign: 'center',
              padding: '36px 20px',
              background: '#ffffff',
              border: '1px dashed #cbd5e1',
              borderRadius: '12px',
            }}
          >
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                background: '#f1f5f9',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '12px',
                color: '#475569',
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 21h18"/>
                <path d="M5 21V7l8-4v18"/>
                <path d="M19 21V11l-6-4"/>
              </svg>
            </div>
            <p style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>
              Belum ada cabang toko yang didaftarkan
            </p>
            <p style={{ fontSize: '0.8125rem', color: '#64748b', margin: '0 auto 20px', maxWidth: '300px', lineHeight: 1.4 }}>
              Pilih salah satu opsi di bawah untuk menambahkan cabang pertama Anda:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '320px', margin: '0 auto' }}>
              {/* Opsi 1: Input Manual */}
              <button
                type="button"
                onClick={() => handleBukaTambah('manual')}
                style={{
                  padding: '11px 16px',
                  background: '#0f172a',
                  color: '#ffffff',
                  borderRadius: '8px',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                <span>+ Input Cabang Manual</span>
              </button>

              {/* Opsi 2: Ambil dari Presensi */}
              <button
                type="button"
                onClick={() => handleBukaTambah('presensi')}
                style={{
                  padding: '11px 16px',
                  background: '#eff6ff',
                  color: '#1d4ed8',
                  borderRadius: '8px',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  border: '1px solid #bfdbfe',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>
                </svg>
                <span>Ambil Data dari Presensi</span>
              </button>
            </div>
          </div>
        ) : (
          /* List Semua Cabang */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {daftarOutlet.map((o) => {
              const isCurrent = o.id === outletAktif?.id;
              const isPresensi = o.sumber === 'presensi';

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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
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

                        {/* Label Sumber: Dari Presensi atau Manual */}
                        {isPresensi ? (
                          <span
                            style={{
                              fontSize: '0.625rem',
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              border: '1px solid #bfdbfe',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                            }}
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 21h18"/>
                              <path d="M5 21V7l8-4v18"/>
                              <path d="M19 21V11l-6-4"/>
                            </svg>
                            Dari Presensi
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: '0.625rem',
                              fontWeight: 600,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: '#f8fafc',
                              color: '#64748b',
                              border: '1px solid #e2e8f0',
                            }}
                          >
                            Manual
                          </span>
                        )}

                        <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                          {o.nama}
                        </h4>
                      </div>

                      <p style={{ fontSize: '0.78125rem', color: '#64748b', margin: '2px 0' }}>
                        {o.alamat || 'Alamat belum diatur'}
                      </p>
                      {o.telepon && (
                        <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '1px 0 0' }}>
                          Telp: {o.telepon}
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
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Kasir Aktif di Sini
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handlePilihCabang(o)}
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
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Gunakan Cabang Ini
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid #f1f5f9', flexWrap: 'wrap', gap: '6px' }}>
                    <span style={{ fontSize: '0.75rem', color: o.aktif ? '#16a34a' : '#94a3b8', fontWeight: 600 }}>
                      {o.aktif ? '● Beroperasi Aktif' : '○ Nonaktif'}
                    </span>

                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <a
                        href={`#/harga-outlet?outlet=${o.id}`}
                        style={{
                          padding: '4px 8px',
                          background: '#f1f5f9',
                          border: '1px solid #e2e8f0',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: '#0f172a',
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          minHeight: '28px',
                        }}
                      >
                        Atur Harga Toko Ini ›
                      </a>
                      <button
                        type="button"
                        onClick={() => handleBukaEdit(o)}
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
                        onClick={() => handleToggleAktif(o)}
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
                      <button
                        type="button"
                        onClick={() => handleHapusCabang(o)}
                        style={{
                          padding: '4px 8px',
                          background: '#fff1f2',
                          border: '1px solid #fecdd3',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: '#e11d48',
                          cursor: 'pointer',
                          minHeight: '28px',
                          minWidth: 'auto',
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

      {/* Modal Tambah / Edit dengan 2 Opsi Tab */}
      {tampilModal && (
        <div class="sheet-backdrop" onClick={() => setTampilModal(false)}>
          <div class="sheet" onClick={(e) => e.stopPropagation()} style={{ padding: '22px 20px', maxHeight: '88vh', overflowY: 'auto' }}>
            <div class="sheet-handle" />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '1.0625rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                {editId ? 'Edit Data Cabang' : 'Tambah Cabang Toko'}
              </h3>
              <button
                type="button"
                onClick={() => setTampilModal(false)}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  width: '28px',
                  height: '28px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#64748b',
                  fontSize: '0.875rem',
                  fontWeight: 700,
                }}
              >
                ✕
              </button>
            </div>

            {/* Tab Pilihan Tambah Cabang (Hanya saat tambah baru) */}
            {!editId && (
              <div
                style={{
                  display: 'flex',
                  background: '#f1f5f9',
                  padding: '4px',
                  borderRadius: '8px',
                  marginBottom: '16px',
                  gap: '4px',
                }}
              >
                <button
                  type="button"
                  onClick={() => setTabModal('manual')}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    background: tabModal === 'manual' ? '#ffffff' : 'transparent',
                    color: tabModal === 'manual' ? '#0f172a' : '#64748b',
                    fontWeight: tabModal === 'manual' ? 700 : 500,
                    fontSize: '0.8125rem',
                    cursor: 'pointer',
                    boxShadow: tabModal === 'manual' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  <span>1. Input Manual</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTabModal('presensi');
                    muatPresensi();
                  }}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    background: tabModal === 'presensi' ? '#ffffff' : 'transparent',
                    color: tabModal === 'presensi' ? '#1d4ed8' : '#64748b',
                    fontWeight: tabModal === 'presensi' ? 700 : 500,
                    fontSize: '0.8125rem',
                    cursor: 'pointer',
                    boxShadow: tabModal === 'presensi' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>
                  </svg>
                  <span>2. Ambil dari Presensi</span>
                </button>
              </div>
            )}

            {/* ── KONTEN TAB 1: FORM INPUT MANUAL / EDIT ── */}
            {tabModal === 'manual' ? (
              <form onSubmit={handleSimpanManual} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {editId && (
                  <div style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.75rem', color: '#64748b' }}>
                    Sumber Data: <strong>{formSumber === 'presensi' ? 'Diimpor dari Presensi Donattour' : 'Input Manual'}</strong>
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Kode Cabang (Singkat) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Misal: MANYAR, GKB, SBY01"
                    value={formKode}
                    onInput={(e) => setFormKode((e.target as HTMLInputElement).value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      background: '#f8fafc',
                      fontSize: '0.875rem',
                      textTransform: 'uppercase',
                      fontWeight: 700,
                    }}
                  />
                  <span style={{ fontSize: '0.6875rem', color: '#94a3b8', marginTop: '2px', display: 'block' }}>
                    Kode unik toko untuk identifikasi kasir dan nomor antrean
                  </span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Nama Lengkap Cabang / Toko *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Misal: Ayam Goreng Mitarasa - Manyar"
                    value={formNama}
                    onInput={(e) => setFormNama((e.target as HTMLInputElement).value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      background: '#f8fafc',
                      fontSize: '0.875rem',
                      color: '#0f172a',
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
                    value={formAlamat}
                    onInput={(e) => setFormAlamat((e.target as HTMLInputElement).value)}
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
                    value={formTelepon}
                    onInput={(e) => setFormTelepon((e.target as HTMLInputElement).value)}
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
                    value={formStruk}
                    onInput={(e) => setFormStruk((e.target as HTMLInputElement).value)}
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

                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setTampilModal(false)}
                    style={{
                      flex: 1,
                      padding: '11px',
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
                      padding: '11px',
                      background: '#0f172a',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {editId ? 'Simpan Perubahan' : 'Simpan Cabang'}
                  </button>
                </div>
              </form>
            ) : (
              /* ── KONTEN TAB 2: AMBIL DARI PRESENSI DONATTOUR ── */
              <div>
                <p style={{ fontSize: '0.8125rem', color: '#64748b', margin: '0 0 14px', lineHeight: 1.45 }}>
                  Pilih lokasi yang sudah terdaftar di sistem Presensi Donattour untuk diimpor ke Kasir Mitarasa. Cabang yang diimpor akan otomatis diberi label <strong>[Dari Presensi]</strong> dan disimpan ke database proyek ini.
                </p>

                {loadingPresensi ? (
                  <div style={{ textAlign: 'center', padding: '30px', color: '#64748b', fontSize: '0.875rem' }}>
                    Memeriksa lokasi di Presensi Donattour...
                  </div>
                ) : lokasiPresensi.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 16px', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                    <p style={{ fontSize: '0.875rem', color: '#64748b', margin: '0 0 8px' }}>
                      Tidak ada lokasi ditemukan di sistem Presensi Donattour.
                    </p>
                    <button
                      type="button"
                      onClick={muatPresensi}
                      style={{
                        padding: '6px 12px',
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Coba Lagi
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {lokasiPresensi.map((loc) => {
                      // Periksa apakah lokasi ini sudah pernah diimpor
                      const sudahDiimpor = daftarOutlet.some(
                        (o) => o.presensi_location_id === loc.id || o.id === loc.id
                      );
                      const isSedangImpor = imporLoadingId === loc.id;

                      return (
                        <div
                          key={loc.id}
                          style={{
                            padding: '14px',
                            borderRadius: '10px',
                            background: sudahDiimpor ? '#f8fafc' : '#ffffff',
                            border: sudahDiimpor ? '1px solid #e2e8f0' : '1px solid #bfdbfe',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '12px',
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                              <h4 style={{ fontSize: '0.9375rem', fontWeight: 700, margin: 0, color: sudahDiimpor ? '#64748b' : '#0f172a' }}>
                                {loc.name.trim()}
                              </h4>
                              {sudahDiimpor && (
                                <span style={{ fontSize: '0.625rem', fontWeight: 600, color: '#16a34a', background: '#f0fdf4', padding: '1px 6px', borderRadius: '4px', border: '1px solid #bbf7d0' }}>
                                  ✓ Sudah Ada di Kasir
                                </span>
                              )}
                            </div>
                            <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: 0 }}>
                              Radius: {loc.radius || 50}m
                              {loc.latitude && loc.longitude && ` • Lat: ${loc.latitude.toFixed(4)}, Long: ${loc.longitude.toFixed(4)}`}
                            </p>
                          </div>

                          {sudahDiimpor ? (
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>
                              Terdaftar
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={isSedangImpor}
                              onClick={() => handleImporLokasi(loc)}
                              style={{
                                padding: '8px 14px',
                                background: '#1d4ed8',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                cursor: isSedangImpor ? 'not-allowed' : 'pointer',
                                whiteSpace: 'nowrap',
                                minHeight: '34px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                              }}
                            >
                              {isSedangImpor ? (
                                'Mengimpor...'
                              ) : (
                                <>
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="12" y1="5" x2="12" y2="19" />
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                  </svg>
                                  <span>Impor Cabang</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
