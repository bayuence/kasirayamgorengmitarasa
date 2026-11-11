import { useState, useEffect } from 'preact/hooks';
import { LayarLogin } from './fitur/login/index.js';
import { LayarKasir } from './fitur/kasir/index.js';
import { LayarBayar } from './fitur/bayar/index.js';
import { LayarRiwayat } from './fitur/riwayat/index.js';
import { LayarShift } from './fitur/shift/index.js';
import { LayarLaporan } from './fitur/laporan/index.js';
import { LayarKelolaProduk } from './fitur/produk/index.js';
import { LayarKelolaTambahan } from './fitur/tambahan/index.js';
import { LayarKelolaOutlet } from './fitur/outlet/index.js';
import { LayarHargaOutlet } from './fitur/harga-outlet/index.js';
import { LayarPengaturanStruk } from './fitur/struk/index.js';
import { SideMenu } from './komponen/SideMenu.js';
import {
  IconKasir,
  IconRiwayat,
  IconShift,
  IconLaporan,
} from './komponen/Ikon.js';
import { statusSinkronSignal, pendingOutboxCountSignal } from './state/sinkron.js';
import { sessionSignal, inisialisasiSesi, perkayaSesiDariPresensi } from './state/sesi.js';
import { inisialisasiSinkronisasiOtomatis } from './data/sync.js';

// ── Tab Konfigurasi Bottom Nav (Hanya Operasional Kasir Utama) ──
const TABS = [
  { hash: '#/kasir',   label: 'Kasir',   ikon: IconKasir },
  { hash: '#/riwayat', label: 'Riwayat', ikon: IconRiwayat },
  { hash: '#/shift',   label: 'Shift',   ikon: IconShift },
  { hash: '#/laporan', label: 'Laporan', ikon: IconLaporan },
];

export function App() {
  const [route, setRoute] = useState<string>(() => {
    const session = inisialisasiSesi() || sessionSignal.value;
    if (!session) return '#/login';
    if (window.location.hash === '#/login' || !window.location.hash) {
      window.location.hash = '#/kasir';
      return '#/kasir';
    }
    return window.location.hash;
  });

  const [isSideMenuOpen, setIsSideMenuOpen] = useState(false);

  useEffect(() => {
    const cleanup = inisialisasiSinkronisasiOtomatis();

    // Pastikan data profil sesi karyawan selalu diperkaya dengan foto dan divisi terbaru
    if (sessionSignal.value) {
      perkayaSesiDariPresensi(sessionSignal.value);
    }

    const handleHashChange = () => {
      const h = window.location.hash || '#/kasir';
      if (!sessionSignal.value) {
        if (h !== '#/login') {
          window.location.hash = '#/login';
          setRoute('#/login');
        }
      } else {
        // Jika sudah login tapi URL hash mengarah ke #/login, otomatis kembalikan ke #/kasir
        if (h === '#/login') {
          window.location.hash = '#/kasir';
          setRoute('#/kasir');
        } else {
          setRoute(h);
        }
      }
    };

    if (!sessionSignal.value && window.location.hash !== '#/login') {
      window.location.hash = '#/login';
    } else if (sessionSignal.value && (window.location.hash === '#/login' || !window.location.hash)) {
      window.location.hash = '#/kasir';
      setRoute('#/kasir');
    }

    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      cleanup?.();
    };
  }, []);

  // ── Halaman login — hanya jika belum login ───────────────────
  if (!sessionSignal.value) {
    return <LayarLogin />;
  }

  // ── Halaman bayar — full screen tanpa bottom nav ────────────
  if (route === '#/bayar') {
    return <LayarBayar />;
  }

  const baseRoute = route.split('?')[0];

  const renderRoute = () => {
    switch (baseRoute) {
      case '#/kasir':        return <LayarKasir />;
      case '#/riwayat':      return <LayarRiwayat />;
      case '#/shift':        return <LayarShift />;
      case '#/laporan':      return <LayarLaporan />;
      case '#/produk':       return <LayarKelolaProduk />;
      case '#/tambahan':     return <LayarKelolaTambahan />;
      case '#/outlet':       return <LayarKelolaOutlet />;
      case '#/harga-outlet': return <LayarHargaOutlet />;
      case '#/struk':        return <LayarPengaturanStruk />;
      case '#/pengaturan':   return <LayarKelolaOutlet />;
      default:               return <LayarKasir />;
    }
  };

  const isOnline = statusSinkronSignal.value !== 'offline';
  const pending = pendingOutboxCountSignal.value;
  const session = sessionSignal.value;

  return (
    <>
      {/* ── Top Bar Minimalist Enterprise ──────────────────────── */}
      <header class="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Tombol Hamburger ☰ Minimalist */}
          <button
            type="button"
            onClick={() => setIsSideMenuOpen(true)}
            aria-label="Buka Menu Profil dan Pengaturan"
            style={{
              padding: '6px 8px',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
              background: '#ffffff',
              color: '#0f172a',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '3.5px',
              minWidth: '34px',
              minHeight: '34px',
              cursor: 'pointer',
            }}
          >
            <span style={{ width: '16px', height: '1.8px', background: '#0f172a', borderRadius: '1px' }} />
            <span style={{ width: '12px', height: '1.8px', background: '#0f172a', borderRadius: '1px', alignSelf: 'flex-start' }} />
            <span style={{ width: '16px', height: '1.8px', background: '#0f172a', borderRadius: '1px' }} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <img
              src="/logo.png"
              alt="Ayam Goreng Mitarasa"
              style={{ width: '26px', height: '26px', borderRadius: '4px', objectFit: 'contain' }}
            />
            <span class="brand-title" style={{ fontSize: '0.9375rem', fontWeight: 700, letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
              Ayam Goreng Mitarasa
            </span>
          </div>
        </div>

        {/* Profil Mini & Status Pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Mini Avatar Pill -> buka Profil Akun */}
          <button
            type="button"
            onClick={() => setIsSideMenuOpen(true)}
            title="Buka Profil Akun"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 8px 3px 4px',
              borderRadius: '20px',
              border: '1px solid #e2e8f0',
              background: '#f8fafc',
              cursor: 'pointer',
              minWidth: 'auto',
              minHeight: 'auto',
            }}
          >
            {session?.foto ? (
              <img
                src={session.foto}
                alt={session.nama || 'Akun'}
                style={{ width: '22px', height: '22px', borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              <div
                style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  background: '#0f172a',
                  color: '#ffffff',
                  fontSize: '0.625rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                }}
              >
                {session?.nama?.slice(0, 1).toUpperCase() || 'U'}
              </div>
            )}
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#0f172a',
                maxWidth: '70px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {session?.nama || 'Akun'}
            </span>
          </button>

          {/* Status Sinkron Pill */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '0.6875rem',
              fontWeight: 600,
              padding: '3px 8px',
              borderRadius: '999px',
              background: isOnline ? '#f0fdf4' : '#f8fafc',
              color: isOnline ? '#15803d' : '#64748b',
              border: `1px solid ${isOnline ? '#bbf7d0' : '#e2e8f0'}`,
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: isOnline ? (pending > 0 ? '#d97706' : '#16a34a') : '#94a3b8',
              }}
            />
            <span>{!isOnline ? 'Offline' : pending > 0 ? `${pending}` : 'Online'}</span>
          </div>
        </div>
      </header>

      {/* ── Side Menu Drawer ────────────────────────────────── */}
      <SideMenu
        isOpen={isSideMenuOpen}
        onClose={() => setIsSideMenuOpen(false)}
        currentRoute={route}
      />

      {/* ── Konten Halaman ──────────────────────────────────── */}
      <main class="page">
        {renderRoute()}
      </main>

      {/* ── Bottom Nav Bar (Operasional Kasir: Kasir, Riwayat, Shift, Laporan) ── */}
      <nav
        class="bottom-nav"
        style={{
          height: '56px',
          minHeight: '56px',
          background: '#ffffff',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'stretch',
        }}
      >
        {TABS.map(({ hash, label, ikon: IkonKomponen }) => {
          const active = baseRoute === hash;
          return (
            <a
              key={hash}
              href={hash}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textDecoration: 'none',
                position: 'relative',
                color: active ? '#0f172a' : '#64748b',
                background: 'transparent',
                gap: '2px',
                padding: '4px 0',
                transition: 'color 0.12s ease',
              }}
            >
              <IkonKomponen size={19} strokeWidth={active ? 2.1 : 1.75} />
              <span
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: active ? 700 : 500,
                  letterSpacing: active ? '-0.01em' : '0',
                }}
              >
                {label}
              </span>

              {/* Active Indicator Top Pill */}
              {active && (
                <span
                  style={{
                    position: 'absolute',
                    top: 0,
                    width: '28px',
                    height: '2.5px',
                    borderRadius: '0 0 2px 2px',
                    background: '#0f172a',
                  }}
                />
              )}
            </a>
          );
        })}
      </nav>
    </>
  );
}
