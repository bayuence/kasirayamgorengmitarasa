import type { ComponentChildren } from 'preact';
import { sessionSignal, hapusSesi } from '../state/sesi.js';
import { getProfilOutlet } from '../data/outlet.js';
import {
  IconKasir,
  IconRiwayat,
  IconShift,
  IconLaporan,
  IconMenu,
  IconTambahan,
  IconOutlet,
  IconStruk,
  IconDompet,
  IconKeluar,
  IconClose,
  IconChevronRight,
  IconShield,
  IconBuilding,
  IconUser,
} from './Ikon.js';

interface SideMenuProps {
  isOpen: boolean;
  onClose: () => void;
  currentRoute: string;
}

export function SideMenu({ isOpen, onClose, currentRoute }: SideMenuProps) {
  if (!isOpen) return null;

  const session = sessionSignal.value;
  const outlet = getProfilOutlet();
  const baseRoute = currentRoute.split('?')[0];

  const handlePindah = (hash: string) => {
    window.location.hash = hash;
    onClose();
  };

  const handleKeluar = () => {
    if (confirm('Keluar dari sesi kasir saat ini?')) {
      hapusSesi();
      onClose();
      window.location.hash = '#/login';
    }
  };

  const userRole = session?.roleOriginal || (session?.peran === 'owner' ? 'Admin' : 'Karyawan');
  const userDivisi = session?.divisi || 'Operasional';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(3px)',
        }}
      />

      {/* Drawer Panel */}
      <div
        style={{
          position: 'relative',
          width: '86%',
          maxWidth: '330px',
          height: '100%',
          background: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 101,
          animation: 'slideInLeft 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
          boxShadow: '6px 0 28px rgba(15, 23, 42, 0.12)',
        }}
      >
        {/* ── HEADER: PROFIL AKUN ── */}
        <div
          style={{
            padding: '20px 18px 16px',
            borderBottom: '1px solid #e2e8f0',
            background: '#ffffff',
          }}
        >
          {/* Top Bar Header Drawer */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '14px',
            }}
          >
            <span
              style={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: '#64748b',
              }}
            >
              Profil Akun
            </span>

            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup Menu"
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                color: '#475569',
                padding: '4px',
                width: '30px',
                height: '30px',
                minWidth: '30px',
                minHeight: '30px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconClose size={16} />
            </button>
          </div>

          {/* User Card: Foto + Nama + Role + Divisi */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Foto Profil */}
            {session?.foto ? (
              <img
                src={session.foto}
                alt={session.nama || 'Foto Profil'}
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '2px solid #e2e8f0',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                  flexShrink: 0,
                  backgroundColor: '#f1f5f9',
                }}
              />
            ) : (
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '50%',
                  background: '#f1f5f9',
                  border: '2px solid #e2e8f0',
                  color: '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.125rem',
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {session?.nama ? session.nama.slice(0, 2).toUpperCase() : <IconUser size={24} />}
              </div>
            )}

            {/* Nama & Role & Divisi */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3
                style={{
                  fontSize: '1.0625rem',
                  fontWeight: 700,
                  color: '#0f172a',
                  margin: '0 0 6px',
                  letterSpacing: '-0.02em',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {session?.nama || 'Pengguna'}
              </h3>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', alignItems: 'center' }}>
                {/* Badge Role */}
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    padding: '2px 7px',
                    borderRadius: '4px',
                    background: '#0f172a',
                    color: '#ffffff',
                  }}
                >
                  <IconShield size={11} strokeWidth={2} />
                  {userRole}
                </span>

                {/* Badge Divisi */}
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    padding: '2px 7px',
                    borderRadius: '4px',
                    background: '#f1f5f9',
                    color: '#334155',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <IconBuilding size={11} strokeWidth={2} />
                  Divisi {userDivisi}
                </span>
              </div>
            </div>
          </div>

          {/* Info Outlet Terdaftar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '12px',
              paddingTop: '10px',
              borderTop: '1px dashed #e2e8f0',
              fontSize: '0.75rem',
              color: '#64748b',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
              <IconOutlet size={14} color="#94a3b8" />
              <span
                style={{
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  color: outlet.id ? '#0f172a' : '#94a3b8',
                }}
              >
                {outlet.id ? outlet.namaToko : 'Belum pilih cabang'}
              </span>
            </div>

            {outlet.id && outlet.sumber === 'presensi' && (
              <span
                style={{
                  fontSize: '0.625rem',
                  fontWeight: 600,
                  padding: '1px 5px',
                  borderRadius: '3px',
                  background: '#eff6ff',
                  color: '#1d4ed8',
                  border: '1px solid #bfdbfe',
                  whiteSpace: 'nowrap',
                }}
              >
                Presensi
              </span>
            )}
          </div>
        </div>

        {/* ── DAFTAR NAVIGASI SIDE MENU ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 10px' }}>
          {/* SECTION 1: OPERASIONAL */}
          <div style={{ marginBottom: '20px' }}>
            <span
              style={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                color: '#94a3b8',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                padding: '0 10px',
                display: 'block',
                marginBottom: '6px',
              }}
            >
              Operasional
            </span>

            <MenuRow
              ikon={<IconKasir size={18} />}
              label="Kasir (POS)"
              aktif={baseRoute === '#/kasir'}
              onClick={() => handlePindah('#/kasir')}
            />
            <MenuRow
              ikon={<IconRiwayat size={18} />}
              label="Riwayat Transaksi"
              aktif={baseRoute === '#/riwayat'}
              onClick={() => handlePindah('#/riwayat')}
            />
            <MenuRow
              ikon={<IconShift size={18} />}
              label="Shift Kasir"
              aktif={baseRoute === '#/shift'}
              onClick={() => handlePindah('#/shift')}
            />
            <MenuRow
              ikon={<IconLaporan size={18} />}
              label="Laporan Penjualan"
              aktif={baseRoute === '#/laporan'}
              onClick={() => handlePindah('#/laporan')}
            />
          </div>

          {/* SECTION 2: ADMINISTRASI */}
          <div>
            <span
              style={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                color: '#94a3b8',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                padding: '0 10px',
                display: 'block',
                marginBottom: '6px',
              }}
            >
              Administrasi & Pengaturan
            </span>

            <MenuRow
              ikon={<IconMenu size={18} />}
              label="Katalog Menu & Kategori"
              sublabel="Atur foto, kategori, HPP modal & margin"
              aktif={baseRoute === '#/produk'}
              onClick={() => handlePindah('#/produk')}
            />
            <MenuRow
              ikon={<IconTambahan size={18} />}
              label="Item Tambahan (Add-ons)"
              sublabel="Nasi daun jeruk, sambal, dll"
              aktif={baseRoute === '#/tambahan'}
              onClick={() => handlePindah('#/tambahan')}
            />
            <MenuRow
              ikon={<IconOutlet size={18} />}
              label="Lokasi & Cabang Toko"
              sublabel="Daftar cabang & pilih toko kasir"
              aktif={baseRoute === '#/outlet'}
              onClick={() => handlePindah('#/outlet')}
            />
            <MenuRow
              ikon={<IconKasir size={18} />}
              label="Atur Menu & Harga per Toko"
              sublabel="Penetapan harga cabang & margin keuntungan"
              aktif={baseRoute === '#/harga-outlet'}
              onClick={() => handlePindah('#/harga-outlet')}
            />
            <MenuRow
              ikon={<IconDompet size={18} />}
              label="Atur Metode Pembayaran"
              sublabel="Pecahan uang tunai & QRIS dinamis toko"
              aktif={baseRoute === '#/metode-pembayaran'}
              onClick={() => handlePindah('#/metode-pembayaran')}
            />
            <MenuRow
              ikon={<IconStruk size={18} />}
              label="Format Struk & Printer"
              sublabel="Lebar kertas 58mm, catatan footer"
              aktif={baseRoute === '#/struk'}
              onClick={() => handlePindah('#/struk')}
            />
          </div>
        </div>

        {/* ── FOOTER: KELUAR ── */}
        <div
          style={{
            padding: '14px 16px',
            borderTop: '1px solid #f1f5f9',
            background: '#ffffff',
          }}
        >
          <button
            type="button"
            onClick={handleKeluar}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: '#ffffff',
              color: '#b91c1c',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              fontSize: '0.8125rem',
              fontWeight: 600,
              minHeight: '40px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'background-color 0.12s ease',
            }}
          >
            <IconKeluar size={16} color="#b91c1c" />
            <span>Keluar dari Sesi Ini</span>
          </button>

          <p style={{ textAlign: 'center', fontSize: '0.6875rem', color: '#94a3b8', margin: '8px 0 0' }}>
            Ayam Goreng Mitarasa
          </p>
        </div>
      </div>
    </div>
  );
}

function MenuRow({
  ikon,
  label,
  sublabel,
  aktif,
  onClick,
}: {
  ikon: ComponentChildren;
  label: string;
  sublabel?: string;
  aktif: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        padding: '9px 10px',
        borderRadius: '8px',
        background: aktif ? '#f1f5f9' : 'transparent',
        border: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        textAlign: 'left',
        cursor: 'pointer',
        minHeight: '42px',
        marginBottom: '2px',
        color: aktif ? '#0f172a' : '#334155',
        transition: 'background-color 0.12s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
        {/* Ikon Container */}
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '6px',
            background: aktif ? '#e2e8f0' : '#f8fafc',
            border: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: aktif ? '#0f172a' : '#64748b',
            flexShrink: 0,
          }}
        >
          {ikon}
        </div>

        {/* Teks Label & Sublabel */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: '0.84375rem',
              fontWeight: aktif ? 700 : 500,
              color: aktif ? '#0f172a' : '#1e293b',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {label}
          </div>
          {sublabel && (
            <div
              style={{
                fontSize: '0.6875rem',
                color: '#64748b',
                marginTop: '1px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {sublabel}
            </div>
          )}
        </div>
      </div>

      <div style={{ marginLeft: '6px', flexShrink: 0, color: aktif ? '#0f172a' : '#cbd5e1' }}>
        <IconChevronRight size={14} />
      </div>
    </button>
  );
}
