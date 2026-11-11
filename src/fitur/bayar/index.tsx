import { useState } from 'preact/hooks';
import { formatRupiah } from '../../util/rupiah.js';
import {
  totalHargaSignal,
  itemKeranjangSignal,
  jenisPesananSignal,
  catatanPesananSignal,
  resetKeranjang,
} from '../../state/keranjang.js';
import { sessionSignal } from '../../state/sesi.js';
import { simpanTransaksiBaru, type HasilTransaksi } from '../../data/outbox.js';
import { formatTeksStruk, bagikanStruk } from '../../util/struk.js';

export function LayarBayar() {
  const [metode, setMetode] = useState<'tunai' | 'qris'>('tunai');
  const [uangDiterima, setUangDiterima] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [hasilTransaksi, setHasilTransaksi] = useState<HasilTransaksi | null>(null);
  const [notifSalin, setNotifSalin] = useState<string>('');

  const total = totalHargaSignal.value;
  const nominalBayar = metode === 'tunai' ? uangDiterima : total;
  const kembalian = Math.max(0, nominalBayar - total);

  const handleSelesaikanPesanan = async () => {
    if (metode === 'tunai' && uangDiterima < total) {
      return;
    }

    setLoading(true);

    try {
      const items = itemKeranjangSignal.value.map((i) => ({
        produkId: i.produkId,
        namaProduk: `${i.varian} - ${i.paket}`,
        qty: i.qty,
        hargaSatuan: i.harga,
        tambahan: i.tambahan,
      }));

      const res = await simpanTransaksiBaru({
        jenis: jenisPesananSignal.value,
        metode,
        total,
        bayar: nominalBayar,
        kembalian,
        catatan: catatanPesananSignal.value || undefined,
        items,
      });

      setHasilTransaksi(res);
    } catch (err: any) {
      alert(`Gagal menyimpan transaksi: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCetak = () => {
    window.print();
  };

  const handleBagikan = async () => {
    if (!hasilTransaksi) return;
    const namaKasir = sessionSignal.value?.nama || 'Kasir';
    const teks = formatTeksStruk(
      hasilTransaksi.pesanan,
      hasilTransaksi.itemPesanan,
      namaKasir,
    );

    const cara = await bagikanStruk(teks, hasilTransaksi.nomorAntreanFormatted);
    if (cara === 'clipboard') {
      setNotifSalin('Teks struk berhasil disalin ke clipboard');
      setTimeout(() => setNotifSalin(''), 3000);
    }
  };

  // 1. Tampilan Hasil Struk Setelah Pembayaran Berhasil
  if (hasilTransaksi) {
    const namaKasir = sessionSignal.value?.nama || 'Kasir';
    const waktuTeks = new Date(hasilTransaksi.pesanan.waktu).toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <div style={{ padding: '24px 16px 80px', maxWidth: '420px', margin: '0 auto' }}>
        {/* Tampilan Layar Ringkasan Struk */}
        <div class="no-print" style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div
            style={{
              display: 'inline-block',
              fontSize: '0.8125rem',
              fontWeight: 600,
              padding: '4px 12px',
              borderRadius: 'var(--radius-full)',
              background: 'var(--soft)',
              color: 'var(--ink)',
              marginBottom: '10px',
            }}
          >
            {hasilTransaksi.pesanan.jenis === 'makan_di_tempat' ? 'Makan di tempat' : 'Bawa pulang'}
          </div>

          <h1
            class="tabular-nums"
            style={{ fontSize: '3rem', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}
          >
            {hasilTransaksi.nomorAntreanFormatted}
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '0.875rem', marginTop: '4px' }}>
            Nomor Antrean Pesanan • {waktuTeks}
          </p>
        </div>

        {/* Notifikasi Teks Salin */}
        {notifSalin && (
          <div
            class="no-print"
            style={{
              padding: '10px',
              borderRadius: 'var(--radius)',
              background: 'var(--soft)',
              color: 'var(--ink)',
              fontSize: '0.8125rem',
              textAlign: 'center',
              marginBottom: '16px',
              border: '1px solid var(--line)',
            }}
          >
            {notifSalin}
          </div>
        )}

        {/* Kartu Rincian Transaksi */}
        <div class="card no-print">
          <div style={{ borderBottom: '1px solid var(--line)', paddingBottom: '10px', marginBottom: '10px' }}>
            {hasilTransaksi.itemPesanan.map((it) => {
              const totalTambahan = it.tambahan.reduce((sum, t) => sum + t.harga * t.qty, 0);
              const subtotal = (it.harga_satuan + totalTambahan) * it.qty;

              return (
                <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                      {it.qty}x {it.nama_produk}
                    </div>
                    {it.tambahan.map((t) => (
                      <div key={t.nama} style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                        + {t.nama}
                      </div>
                    ))}
                  </div>
                  <div class="tabular-nums" style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                    {formatRupiah(subtotal)}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.875rem' }}>
            <span style={{ color: 'var(--muted)' }}>Total:</span>
            <span class="tabular-nums" style={{ fontWeight: 700 }}>
              {formatRupiah(hasilTransaksi.pesanan.total)}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.875rem' }}>
            <span style={{ color: 'var(--muted)' }}>Metode:</span>
            <span style={{ fontWeight: 600 }}>{hasilTransaksi.pesanan.metode.toUpperCase()}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.875rem' }}>
            <span style={{ color: 'var(--muted)' }}>Bayar:</span>
            <span class="tabular-nums">{formatRupiah(hasilTransaksi.pesanan.bayar)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', paddingTop: '6px', borderTop: '1px dashed var(--line)' }}>
            <span style={{ color: 'var(--muted)' }}>Kembalian:</span>
            <span class="tabular-nums" style={{ fontWeight: 700, color: 'var(--ink)' }}>
              {formatRupiah(hasilTransaksi.pesanan.kembalian)}
            </span>
          </div>
        </div>

        {/* Tombol Cetak & Bagikan */}
        <div class="no-print" style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <button
            type="button"
            class="btn-secondary"
            onClick={handleCetak}
            style={{ flex: 1, minHeight: '48px' }}
          >
            Cetak Struk (58 mm)
          </button>
          <button
            type="button"
            class="btn-secondary"
            onClick={handleBagikan}
            style={{ flex: 1, minHeight: '48px' }}
          >
            Bagikan Struk
          </button>
        </div>

        {/* Tombol Pesanan Baru */}
        <div class="no-print">
          <button
            type="button"
            class="btn-primary"
            onClick={() => {
              resetKeranjang();
              window.location.hash = '#/kasir';
            }}
          >
            Pesanan Baru
          </button>
        </div>

        {/* Komponen Cetak Fisik 58 mm (Hanya Tampil Saat window.print()) */}
        <div class="struk-print-area" style={{ display: 'none' }}>
          <div style={{ textAlign: 'center', marginBottom: '8px' }}>
            <strong style={{ fontSize: '13px' }}>MITARASA</strong>
            <div>Ayam Goreng Tradisional</div>
          </div>
          <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '4px 0', margin: '4px 0' }}>
            <div>No. Antrean: <strong>{hasilTransaksi.nomorAntreanFormatted}</strong></div>
            <div>Tgl: {new Date(hasilTransaksi.pesanan.waktu).toLocaleString('id-ID')}</div>
            <div>Tipe: {hasilTransaksi.pesanan.jenis === 'makan_di_tempat' ? 'Makan di tempat' : 'Bawa pulang'}</div>
            <div>Kasir: {namaKasir}</div>
          </div>
          <div style={{ margin: '4px 0' }}>
            {hasilTransaksi.itemPesanan.map((it) => (
              <div key={it.id} style={{ marginBottom: '4px' }}>
                <div>{it.qty}x {it.nama_produk}</div>
                {it.tambahan.map((t) => (
                  <div key={t.nama} style={{ paddingLeft: '8px', fontSize: '10px' }}>
                    + {t.nama} ({formatRupiah(t.harga)})
                  </div>
                ))}
                <div style={{ textAlign: 'right' }}>
                  {formatRupiah((it.harga_satuan + it.tambahan.reduce((s, x) => s + x.harga * x.qty, 0)) * it.qty)}
                </div>
              </div>
            ))}
          </div>
          <div style={{ borderTop: '1px dashed #000', paddingTop: '4px', margin: '4px 0' }}>
            <div>Total: <strong>{formatRupiah(hasilTransaksi.pesanan.total)}</strong></div>
            <div>Bayar ({hasilTransaksi.pesanan.metode.toUpperCase()}): {formatRupiah(hasilTransaksi.pesanan.bayar)}</div>
            <div>Kembalian: {formatRupiah(hasilTransaksi.pesanan.kembalian)}</div>
            {hasilTransaksi.pesanan.catatan && <div>Catatan: {hasilTransaksi.pesanan.catatan}</div>}
          </div>
          <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '10px' }}>
            <div>Terima Kasih!</div>
            <div>Selamat Menikmati Hidangan</div>
          </div>
        </div>
      </div>
    );
  }

  // 2. Tampilan Form Pembayaran
  return (
    <div style={{ padding: '16px', paddingBottom: '120px', maxWidth: '440px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '16px' }}>
        Pembayaran
      </h2>

      {/* Ringkasan Total */}
      <div class="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>Total Pembayaran:</span>
          <span class="tabular-nums" style={{ fontWeight: 800, fontSize: '1.625rem', color: 'var(--ink)' }}>
            {formatRupiah(total)}
          </span>
        </div>
        <div style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>
          {itemKeranjangSignal.value.length} jenis paket ({jenisPesananSignal.value === 'makan_di_tempat' ? 'Makan di tempat' : 'Bawa pulang'})
          {catatanPesananSignal.value && <div>Catatan: {catatanPesananSignal.value}</div>}
        </div>
      </div>

      {/* Metode Pembayaran (Pill Toggle) */}
      <div class="segmented-control" style={{ margin: '16px 0' }}>
        <button
          type="button"
          class={`segmented-btn ${metode === 'tunai' ? 'active' : ''}`}
          onClick={() => setMetode('tunai')}
        >
          Tunai
        </button>
        <button
          type="button"
          class={`segmented-btn ${metode === 'qris' ? 'active' : ''}`}
          onClick={() => setMetode('qris')}
        >
          QRIS
        </button>
      </div>

      {metode === 'tunai' ? (
        <div class="card">
          <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '8px' }}>
            Nominal Uang Diterima:
          </label>

          {/* Tombol Nominal Cepat */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '16px' }}>
            {[total, 20000, 50000, 100000].map((nominal) => (
              <button
                key={nominal}
                type="button"
                onClick={() => setUangDiterima(nominal)}
                style={{
                  padding: '8px 2px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--line)',
                  background: uangDiterima === nominal ? 'var(--ink)' : 'var(--soft)',
                  color: uangDiterima === nominal ? 'var(--surface)' : 'var(--ink)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  minHeight: '44px',
                }}
              >
                {nominal === total ? 'Uang pas' : formatRupiah(nominal)}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid var(--line)' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Kembalian:</span>
            <span class="tabular-nums" style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--ink)' }}>
              {formatRupiah(kembalian)}
            </span>
          </div>
        </div>
      ) : (
        <div class="card" style={{ textAlign: 'center', padding: '32px 16px' }}>
          <p style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '6px' }}>
            Pembayaran QRIS
          </p>
          <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>
            Arahkan pelanggan memindai kode QRIS toko sebesar <strong>{formatRupiah(total)}</strong>
          </p>
        </div>
      )}

      {/* Tombol Selesaikan */}
      <div class="bottom-bar">
        <button
          type="button"
          class="btn-primary"
          onClick={handleSelesaikanPesanan}
          disabled={loading || (metode === 'tunai' && uangDiterima < total)}
        >
          {loading
            ? 'Menyimpan Transaksi...'
            : metode === 'tunai'
            ? 'Selesaikan Pembayaran Tunai'
            : 'Tandai Lunas (QRIS)'}
        </button>
      </div>
    </div>
  );
}
