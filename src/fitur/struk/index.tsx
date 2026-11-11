import { useState } from 'preact/hooks';
import { getProfilOutlet, simpanProfilOutlet } from '../../data/outlet.js';

export function LayarPengaturanStruk() {
  const [profilStruk, setProfilStruk] = useState(getProfilOutlet());
  const [pesanSukses, setPesanSukses] = useState('');

  const notifikasi = (teks: string) => {
    setPesanSukses(teks);
    setTimeout(() => setPesanSukses(''), 3000);
  };

  const handleSimpan = (e: Event) => {
    e.preventDefault();
    simpanProfilOutlet(profilStruk);
    notifikasi('Pengaturan struk dan printer berhasil disimpan');
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
      <div style={{ marginBottom: '18px' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#0f172a', letterSpacing: '-0.02em' }}>
          Format Struk & Printer
        </h2>
        <p style={{ fontSize: '0.8125rem', color: '#64748b', marginTop: '3px', marginBottom: 0 }}>
          Konfigurasi ukuran printer thermal kasir dan pesan footer nota
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

      <form
        onSubmit={handleSimpan}
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
            Awalan kode struk transaksi pada nomor antrean pelanggan (misal: A-001)
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
          Simpan Format Struk
        </button>
      </form>
    </div>
  );
}

