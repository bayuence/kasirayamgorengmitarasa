import { useState, useEffect, useRef } from 'preact/hooks';
import { getSupabase } from '../../data/supabase.js';
import { sinkronkanMenuDariSupabase } from '../../data/menu.js';
import { muatDaftarKaryawan, verifikasiKaryawan, type KaryawanPresensi } from '../../data/presensi.js';
import {
  sessionSignal,
  isLockedSignal,
  simpanSesi,
  DEFAULT_KASIR_ID,
} from '../../state/sesi.js';

const DAFTAR_BULAN = [
  { value: '01', label: 'Januari' },
  { value: '02', label: 'Februari' },
  { value: '03', label: 'Maret' },
  { value: '04', label: 'April' },
  { value: '05', label: 'Mei' },
  { value: '06', label: 'Juni' },
  { value: '07', label: 'Juli' },
  { value: '08', label: 'Agustus' },
  { value: '09', label: 'September' },
  { value: '10', label: 'Oktober' },
  { value: '11', label: 'November' },
  { value: '12', label: 'Desember' },
];

export function LayarLogin() {
  const [mode, setMode] = useState<'email' | 'karyawan'>('email');

  // Form Email
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [lihatPassword, setLihatPassword] = useState(false);

  // Form Karyawan (Presensi)
  const [namaKaryawan, setNamaKaryawan] = useState('');
  const [daftarKaryawan, setDaftarKaryawan] = useState<KaryawanPresensi[]>([]);
  const [saranKaryawan, setSaranKaryawan] = useState<KaryawanPresensi[]>([]);
  const [tampilSaran, setTampilSaran] = useState(false);
  const [indeksSaranAktif, setIndeksSaranAktif] = useState(0);

  // Tanggal Lahir: Hari (Ketik) | Bulan (Pilih Dropdown) | Tahun (Ketik)
  const [hari, setHari] = useState('');
  const [bulan, setBulan] = useState('');
  const [tahun, setTahun] = useState('');

  // Refs untuk navigasi kursor otomatis
  const hariInputRef = useRef<HTMLInputElement>(null);
  const bulanSelectRef = useRef<HTMLSelectElement>(null);
  const tahunInputRef = useRef<HTMLInputElement>(null);
  const submitKaryawanRef = useRef<HTMLButtonElement>(null);

  const [pesan, setPesan] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Jika sesi login sudah ada, tidak perlu membuka halaman login
    if (sessionSignal.value) {
      window.location.hash = '#/kasir';
      return;
    }

    muatDaftarKaryawan().then((list) => {
      if (list && list.length > 0) {
        setDaftarKaryawan(list);
      }
    });
  }, []);

  // Filter saran nama cerdas
  const handleKetikNama = (teks: string) => {
    setNamaKaryawan(teks);
    const query = teks.trim().toLowerCase();

    if (query.length > 0) {
      const hasil = daftarKaryawan.filter((k) =>
        k.name.toLowerCase().includes(query)
      );
      setSaranKaryawan(hasil.slice(0, 5));
      setTampilSaran(hasil.length > 0);
      setIndeksSaranAktif(0);
    } else {
      setSaranKaryawan([]);
      setTampilSaran(false);
    }
  };

  // Pilih nama dari saran & auto-fokus ke kolom Hari
  const pilihSaran = (namaDipilih: string) => {
    setNamaKaryawan(namaDipilih);
    setTampilSaran(false);
    setSaranKaryawan([]);
    setTimeout(() => {
      hariInputRef.current?.focus();
    }, 50);
  };

  const handleKeyDownNama = (e: KeyboardEvent) => {
    if (!tampilSaran || saranKaryawan.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndeksSaranAktif((prev) => (prev + 1) % saranKaryawan.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndeksSaranAktif((prev) => (prev - 1 + saranKaryawan.length) % saranKaryawan.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = saranKaryawan[indeksSaranAktif] || saranKaryawan[0];
      if (target) {
        pilihSaran(target.name);
      }
    } else if (e.key === 'Escape') {
      setTampilSaran(false);
    }
  };

  // Alur cerdas Hari (ketik) -> Bulan (pilih) -> Tahun (ketik)
  const handleInputHari = (val: string) => {
    const numeric = val.replace(/\D/g, '').slice(0, 2);
    setHari(numeric);
    // Jika 2 digit atau angka pertama > 3, langsung pindah ke dropdown bulan
    if (numeric.length === 2 || (numeric.length === 1 && parseInt(numeric, 10) > 3)) {
      bulanSelectRef.current?.focus();
    }
  };

  const handleChangeBulan = (val: string) => {
    setBulan(val);
    if (val) {
      // Saat bulan dipilih, kursor otomatis melompat ke kolom Tahun
      setTimeout(() => {
        tahunInputRef.current?.focus();
      }, 50);
    }
  };

  const handleInputTahun = (val: string) => {
    const numeric = val.replace(/\D/g, '').slice(0, 4);
    setTahun(numeric);
    if (numeric.length === 4) {
      submitKaryawanRef.current?.focus();
    }
  };

  const handleKeyDownTahun = (e: KeyboardEvent) => {
    if (e.key === 'Backspace' && tahun === '') {
      bulanSelectRef.current?.focus();
    }
  };

  // 1. Login via Email & Password (Default)
  const handleLoginEmail = async (e: Event) => {
    e.preventDefault();
    setLoading(true);
    setPesan('');

    try {
      const supabase = await getSupabase();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        setPesan('Email atau kata sandi tidak valid.');
        setLoading(false);
        return;
      }

      if (data.user) {
        let namaUser = 'Owner';
        let peranUser: 'owner' | 'kasir' = 'owner';

        try {
          const { data: profil } = await supabase
            .from('profil')
            .select('nama, peran')
            .eq('id', data.user.id)
            .maybeSingle();

          if (profil) {
            namaUser = profil.nama || namaUser;
            peranUser = profil.peran || peranUser;
          }
        } catch {
          // fallback
        }

        simpanSesi({
          id: data.user.id,
          email: data.user.email,
          nama: namaUser,
          peran: peranUser,
          loginMethod: 'email',
          foto: null,
          roleOriginal: peranUser === 'owner' ? 'Owner / Admin' : 'Staff Toko',
          divisi: 'Manajemen',
        });

        try { await sinkronkanMenuDariSupabase(); } catch {}

        isLockedSignal.value = false;
        window.location.hash = '#/kasir';
      }
    } catch (err: any) {
      setPesan('Terjadi gangguan jaringan. Pastikan koneksi internet aktif.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Login via Karyawan (Nama & Hari-Bulan-Tahun)
  const handleLoginKaryawan = async (e: Event) => {
    e.preventDefault();
    setLoading(true);
    setPesan('');

    const h = hari.trim().padStart(2, '0');
    const b = bulan.trim();
    const t = tahun.trim();

    if (!h || !b || !t || t.length !== 4) {
      setPesan('Lengkapi tanggal lahir: Tanggal, pilih Bulan, dan 4 digit Tahun.');
      setLoading(false);
      return;
    }

    const dobFormatted = `${t}-${b}-${h}`; // format standar YYYY-MM-DD

    try {
      const hasil = await verifikasiKaryawan(namaKaryawan, dobFormatted);

      if (!hasil.sukses || !hasil.user) {
        setPesan(hasil.pesan || 'Data karyawan atau tanggal lahir tidak cocok.');
        setLoading(false);
        return;
      }

      simpanSesi({
        id: DEFAULT_KASIR_ID,
        presensiUserId: hasil.user.id,
        nama: hasil.user.name,
        peran: hasil.user.role?.toLowerCase() === 'admin' ? 'owner' : 'kasir',
        loginMethod: 'karyawan',
        foto: hasil.user.photo || null,
        roleOriginal: hasil.user.role || 'Karyawan',
        divisi: hasil.user.divisionName || 'Operasional',
      });

      try { await sinkronkanMenuDariSupabase(); } catch {}

      isLockedSignal.value = false;
      window.location.hash = '#/kasir';
    } catch (err: any) {
      setPesan(`Gagal memverifikasi: ${err.message || 'Periksa koneksi internet'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 20px',
        background: '#fef8eb',
      }}
    >
      <div style={{ width: '100%', maxWidth: '370px' }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <img
            src="/logo.png"
            alt="Ayam Goreng Bawang Putih Mitrasa"
            style={{
              width: '260px',
              maxWidth: '85%',
              height: 'auto',
              objectFit: 'contain',
              display: 'block',
              margin: '0 auto',
            }}
          />
        </div>

        {/* Clean Enterprise Card */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '28px 24px',
            boxShadow: '0 4px 24px -2px rgba(15, 23, 42, 0.06), 0 2px 6px -1px rgba(15, 23, 42, 0.02)',
            border: '1px solid rgba(15, 23, 42, 0.06)',
          }}
        >
          {/* Header Kartu */}
          <div style={{ marginBottom: '20px' }}>
            <h1
              style={{
                fontSize: '1.125rem',
                fontWeight: 700,
                color: '#0f172a',
                letterSpacing: '-0.02em',
                margin: 0,
              }}
            >
              {mode === 'email' ? 'Masuk ke Sistem Kasir' : 'Masuk sebagai Karyawan'}
            </h1>
            <p
              style={{
                fontSize: '0.8125rem',
                color: '#64748b',
                marginTop: '4px',
                marginBottom: 0,
              }}
            >
              {mode === 'email'
                ? 'Gunakan akun terdaftar untuk mengakses kasir'
                : 'Terhubung dengan sistem Presensi Donattour'}
            </p>
          </div>

          {/* Alert Pesan Error */}
          {pesan && (
            <div
              style={{
                padding: '11px 14px',
                borderRadius: '8px',
                background: '#fef2f2',
                color: '#b91c1c',
                fontSize: '0.8125rem',
                fontWeight: 500,
                marginBottom: '18px',
                border: '1px solid #fecaca',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span>{pesan}</span>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              MODE 1: LOGIN UTAMA (EMAIL & KATA SANDI) - DEFAULT
             ───────────────────────────────────────────────────────────── */}
          {mode === 'email' && (
            <>
              <form onSubmit={handleLoginEmail} autocomplete="off" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      color: '#334155',
                      marginBottom: '6px',
                    }}
                  >
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
                    placeholder="ence@mitarasa.com"
                    autocomplete="off"
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '10px',
                      background: '#f8fafc',
                      fontSize: '0.9375rem',
                      color: '#0f172a',
                      boxSizing: 'border-box',
                      outline: 'none',
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      color: '#334155',
                      marginBottom: '6px',
                    }}
                  >
                    Kata Sandi
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={lihatPassword ? ('text' as any) : 'password'}
                      required
                      value={password}
                      onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
                      placeholder="••••••••"
                      autocomplete="new-password"
                      style={{
                        width: '100%',
                        padding: '12px 46px 12px 14px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '10px',
                        background: '#f8fafc',
                        fontSize: '0.9375rem',
                        color: '#0f172a',
                        boxSizing: 'border-box',
                        outline: 'none',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setLihatPassword((v) => !v)}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        padding: '6px',
                        cursor: 'pointer',
                        color: '#94a3b8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: 'unset',
                        minWidth: 'unset',
                      }}
                      aria-label={lihatPassword ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'}
                    >
                      {lihatPassword ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                          <line x1="1" y1="1" x2="23" y2="23"/>
                        </svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                          <circle cx="12" cy="12" r="3"/>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    marginTop: '4px',
                    width: '100%',
                    padding: '13px 16px',
                    background: loading ? '#64748b' : '#0f172a',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '0.9375rem',
                    fontWeight: 600,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    minHeight: '48px',
                    boxShadow: '0 2px 4px rgba(15, 23, 42, 0.1)',
                  }}
                >
                  {loading ? 'Memverifikasi...' : 'Masuk'}
                </button>
              </form>

              {/* Pembatas Elegan */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  margin: '22px 0 18px',
                  gap: '12px',
                }}
              >
                <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
                <span
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    color: '#94a3b8',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}
                >
                  atau
                </span>
                <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
              </div>

              {/* Tombol Opsi Karyawan */}
              <button
                type="button"
                onClick={() => { setMode('karyawan'); setPesan(''); }}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: '#f8fafc',
                  color: '#1e293b',
                  border: '1px solid #cbd5e1',
                  borderRadius: '10px',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  minHeight: '46px',
                  cursor: 'pointer',
                }}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                <span>Masuk melalui Akun Karyawan</span>
              </button>
            </>
          )}

          {/* ─────────────────────────────────────────────────────────────
              MODE 2: LOGIN KARYAWAN (HARI: KETIK | BULAN: PILIH | TAHUN: KETIK)
             ───────────────────────────────────────────────────────────── */}
          {mode === 'karyawan' && (
            <>
              <form onSubmit={handleLoginKaryawan} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div style={{ position: 'relative' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      color: '#334155',
                      marginBottom: '6px',
                    }}
                  >
                    Nama Lengkap
                  </label>
                  <input
                    type="text"
                    required
                    value={namaKaryawan}
                    onInput={(e) => handleKetikNama((e.target as HTMLInputElement).value)}
                    onKeyDown={handleKeyDownNama}
                    onBlur={() => setTimeout(() => setTampilSaran(false), 200)}
                    onFocus={() => {
                      if (namaKaryawan.trim().length > 0 && saranKaryawan.length > 0) {
                        setTampilSaran(true);
                      }
                    }}
                    placeholder="Contoh: ence"
                    autocomplete="off"
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      border: tampilSaran ? '1px solid #0f172a' : '1px solid #e2e8f0',
                      borderRadius: '10px',
                      background: '#f8fafc',
                      fontSize: '0.9375rem',
                      color: '#0f172a',
                      boxSizing: 'border-box',
                      outline: 'none',
                    }}
                    autoFocus
                  />

                  {/* Smart Floating Predictive Box */}
                  {tampilSaran && saranKaryawan.length > 0 && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        marginTop: '4px',
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '10px',
                        boxShadow: '0 8px 20px -4px rgba(15, 23, 42, 0.12)',
                        zIndex: 50,
                        overflow: 'hidden',
                      }}
                    >
                      {saranKaryawan.map((k, idx) => {
                        const isAktif = idx === indeksSaranAktif;
                        return (
                          <div
                            key={k.id}
                            onMouseDown={() => pilihSaran(k.name)}
                            onMouseEnter={() => setIndeksSaranAktif(idx)}
                            style={{
                              padding: '10px 14px',
                              fontSize: '0.875rem',
                              fontWeight: isAktif ? 600 : 400,
                              background: isAktif ? '#f1f5f9' : '#ffffff',
                              color: isAktif ? '#0f172a' : '#334155',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              borderBottom: idx < saranKaryawan.length - 1 ? '1px solid #f1f5f9' : 'none',
                            }}
                          >
                            <span>{k.name}</span>
                            <span style={{ fontSize: '0.6875rem', color: '#94a3b8' }}>
                              {isAktif ? 'Tekan ↵ Enter' : k.role || 'Karyawan'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* ── Tanggal Lahir: Hari (Ketik) | Bulan (Pilih) | Tahun (Ketik) ── */}
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      color: '#334155',
                      marginBottom: '6px',
                    }}
                  >
                    Tanggal Lahir
                  </label>

                  <div style={{ display: 'grid', gridTemplateColumns: '70px 1.5fr 85px', gap: '8px' }}>
                    {/* 1. Hari: Ketik 2 digit */}
                    <div>
                      <input
                        ref={hariInputRef}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={2}
                        required
                        value={hari}
                        onInput={(e) => handleInputHari((e.target as HTMLInputElement).value)}
                        placeholder="Tgl"
                        style={{
                          width: '100%',
                          textAlign: 'center',
                          padding: '12px 6px',
                          border: '1px solid #e2e8f0',
                          borderRadius: '10px',
                          background: '#f8fafc',
                          fontSize: '0.9375rem',
                          fontWeight: 600,
                          color: '#0f172a',
                          boxSizing: 'border-box',
                          outline: 'none',
                        }}
                      />
                      <span style={{ display: 'block', textAlign: 'center', fontSize: '0.6875rem', color: '#94a3b8', marginTop: '4px' }}>
                        1-31
                      </span>
                    </div>

                    {/* 2. Bulan: Pilihan Dropdown Nama Bulan */}
                    <div>
                      <select
                        ref={bulanSelectRef}
                        required
                        value={bulan}
                        onChange={(e) => handleChangeBulan((e.target as HTMLSelectElement).value)}
                        style={{
                          width: '100%',
                          padding: '12px 10px',
                          border: '1px solid #e2e8f0',
                          borderRadius: '10px',
                          background: '#f8fafc',
                          fontSize: '0.875rem',
                          fontWeight: 500,
                          color: bulan ? '#0f172a' : '#94a3b8',
                          boxSizing: 'border-box',
                          outline: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        <option value="">Pilih Bulan</option>
                        {DAFTAR_BULAN.map((b) => (
                          <option key={b.value} value={b.value}>
                            {b.label}
                          </option>
                        ))}
                      </select>
                      <span style={{ display: 'block', textAlign: 'center', fontSize: '0.6875rem', color: '#94a3b8', marginTop: '4px' }}>
                        Bulan
                      </span>
                    </div>

                    {/* 3. Tahun: Ketik 4 digit */}
                    <div>
                      <input
                        ref={tahunInputRef}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={4}
                        required
                        value={tahun}
                        onInput={(e) => handleInputTahun((e.target as HTMLInputElement).value)}
                        onKeyDown={handleKeyDownTahun}
                        placeholder="Tahun"
                        style={{
                          width: '100%',
                          textAlign: 'center',
                          padding: '12px 6px',
                          border: '1px solid #e2e8f0',
                          borderRadius: '10px',
                          background: '#f8fafc',
                          fontSize: '0.9375rem',
                          fontWeight: 600,
                          color: '#0f172a',
                          boxSizing: 'border-box',
                          outline: 'none',
                        }}
                      />
                      <span style={{ display: 'block', textAlign: 'center', fontSize: '0.6875rem', color: '#94a3b8', marginTop: '4px' }}>
                        YYYY
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  ref={submitKaryawanRef}
                  type="submit"
                  disabled={loading}
                  style={{
                    marginTop: '4px',
                    width: '100%',
                    padding: '13px 16px',
                    background: loading ? '#64748b' : '#0f172a',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '0.9375rem',
                    fontWeight: 600,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    minHeight: '48px',
                    boxShadow: '0 2px 4px rgba(15, 23, 42, 0.1)',
                  }}
                >
                  {loading ? 'Memvalidasi...' : 'Verifikasi & Masuk Kasir'}
                </button>
              </form>

              {/* Kembali ke login Email */}
              <div style={{ textAlign: 'center', marginTop: '18px' }}>
                <button
                  type="button"
                  onClick={() => { setMode('email'); setPesan(''); }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#64748b',
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    minHeight: '36px',
                    padding: '4px 8px',
                  }}
                >
                  ← Kembali ke Masuk dengan Email
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
