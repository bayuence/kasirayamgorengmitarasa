import { useState, useEffect } from 'preact/hooks';
import { getLocalDB, type PesananItem, type ItemPesananDetail } from '../../data/db.js';
import { getTanggalLokal, formatNomorAntrean, batalkanPesananLokal } from '../../data/outbox.js';
import { formatRupiah } from '../../util/rupiah.js';
import { formatTeksStruk, bagikanStruk } from '../../util/struk.js';
import { sessionSignal } from '../../state/sesi.js';

interface PesananDenganItem {
  pesanan: PesananItem;
  items: ItemPesananDetail[];
  nomorAntrean: string;
}

export function LayarRiwayat() {
  const [daftarPesanan, setDaftarPesanan] = useState<PesananDenganItem[]>([]);
  const [cari, setCari] = useState('');
  const [loading, setLoading] = useState(true);
  const [pesananDipilih, setPesananDipilih] = useState<PesananDenganItem | null>(null);
  const [modalBatal, setModalBatal] = useState(false);
  const [alasanBatal, setAlasanBatal] = useState('');
  const [errorBatal, setErrorBatal] = useState('');
  const [notifSalin, setNotifSalin] = useState('');

  const muatRiwayatHariIni = async () => {
    setLoading(true);
    const db = await getLocalDB();
    const tanggalHariIni = getTanggalLokal();

    const pesananHariIni = await db.getAllFromIndex('pesanan', 'by-tanggal', tanggalHariIni);
    // Urutkan dari yang terbaru
    pesananHariIni.sort((a, b) => new Date(b.waktu).getTime() - new Date(a.waktu).getTime());

    const hasil: PesananDenganItem[] = [];
    for (const p of pesananHariIni) {
      const items = await db.getAllFromIndex('item_pesanan', 'by-pesanan', p.id);
      hasil.push({
        pesanan: p,
        items,
        nomorAntrean: formatNomorAntrean(p.kode_perangkat, p.nomor),
      });
    }

    setDaftarPesanan(hasil);
    setLoading(false);
  };

  useEffect(() => {
    muatRiwayatHariIni();
  }, []);

  const handleBatalkan = async (e: Event) => {
    e.preventDefault();
    if (!alasanBatal.trim()) {
      setErrorBatal('Alasan pembatalan wajib diisi');
      return;
    }

    if (!pesananDipilih) return;

    try {
      await batalkanPesananLokal(pesananDipilih.pesanan.id, alasanBatal.trim());
      setModalBatal(false);
      setAlasanBatal('');
      setErrorBatal('');
      setPesananDipilih(null);
      await muatRiwayatHariIni();
    } catch (err: any) {
      setErrorBatal(err.message || 'Gagal membatalkan pesanan');
    }
  };

  const handleCetak = () => {
    window.print();
  };

  const handleBagikan = async () => {
    if (!pesananDipilih) return;
    const namaKasir = sessionSignal.value?.nama || 'Kasir';
    const teks = formatTeksStruk(
      pesananDipilih.pesanan,
      pesananDipilih.items,
      namaKasir,
    );

    const res = await bagikanStruk(teks, pesananDipilih.nomorAntrean);
    if (res === 'clipboard') {
      setNotifSalin('Teks struk berhasil disalin');
      setTimeout(() => setNotifSalin(''), 3000);
    }
  };

  const pesananTersaring = daftarPesanan.filter((item) => {
    if (!cari.trim()) return true;
    const kataKunci = cari.toLowerCase().trim();
    return (
      item.nomorAntrean.toLowerCase().includes(kataKunci) ||
      String(item.pesanan.nomor).includes(kataKunci) ||
      item.items.some((it) => it.nama_produk.toLowerCase().includes(kataKunci))
    );
  });

  return (
    <div style={{ padding: '16px', maxWidth: '480px', margin: '0 auto', width: '100%', paddingBottom: '80px' }}>
      <div class="no-print" style={{ marginBottom: '16px' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '4px' }}>
          Riwayat Hari Ini
        </h2>
        <p style={{ color: 'var(--muted)', fontSize: '0.8125rem' }}>
          Daftar pesanan toko Mitarasa per {new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })}
        </p>
      </div>

      {/* Input Pencarian Nomor Antrean */}
      <div class="no-print" style={{ marginBottom: '16px' }}>
        <input
          type="search"
          placeholder="Cari nomor antrean (contoh: A-001 atau 1)..."
          value={cari}
          onInput={(e) => setCari((e.target as HTMLInputElement).value)}
          style={{
            width: '100%',
            padding: '12px 14px',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--line)',
            background: 'var(--surface)',
            fontSize: '0.875rem',
          }}
        />
      </div>

      {loading ? (
        <div class="no-print" style={{ textAlign: 'center', padding: '32px', color: 'var(--muted)' }}>
          Memuat riwayat transaksi...
        </div>
      ) : pesananTersaring.length === 0 ? (
        <div
          class="card no-print"
          style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--muted)' }}
        >
          {cari ? 'Tidak ada pesanan yang sesuai pencarian.' : 'Belum ada transaksi hari ini.'}
        </div>
      ) : (
        <div class="no-print" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {pesananTersaring.map((item) => {
            const waktu = new Date(item.pesanan.waktu).toLocaleTimeString('id-ID', {
              hour: '2-digit',
              minute: '2-digit',
            });
            const isBatal = item.pesanan.status === 'batal';

            return (
              <div
                key={item.pesanan.id}
                class="card"
                onClick={() => setPesananDipilih(item)}
                style={{
                  cursor: 'pointer',
                  margin: 0,
                  opacity: isBatal ? 0.65 : 1,
                  borderLeft: isBatal ? '3px solid var(--danger)' : '3px solid var(--ink)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <strong class="tabular-nums" style={{ fontSize: '1.125rem' }}>
                        {item.nomorAntrean}
                      </strong>
                      <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>• {waktu}</span>
                      {isBatal && (
                        <span
                          style={{
                            fontSize: '0.6875rem',
                            fontWeight: 600,
                            color: 'var(--danger)',
                            background: 'var(--danger-soft)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                          }}
                        >
                          BATAL
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--muted)', marginTop: '4px' }}>
                      {item.items.map((i) => `${i.qty}x ${i.nama_produk}`).join(', ')}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div
                      class="tabular-nums"
                      style={{
                        fontWeight: 700,
                        fontSize: '1rem',
                        textDecoration: isBatal ? 'line-through' : 'none',
                      }}
                    >
                      {formatRupiah(item.pesanan.total)}
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--muted)', textTransform: 'uppercase' }}>
                      {item.pesanan.metode}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Detail Transaksi */}
      {pesananDipilih && !modalBatal && (
        <div
          class="no-print"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.4)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'flex-end',
            zIndex: 40,
          }}
        >
          <div
            style={{
              width: '100%',
              background: 'var(--surface)',
              borderTopLeftRadius: '20px',
              borderTopRightRadius: '20px',
              padding: '20px 16px calc(20px + env(safe-area-inset-bottom, 0px))',
              maxHeight: '85vh',
              overflowY: 'auto',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>
                  {pesananDipilih.nomorAntrean}
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                  {new Date(pesananDipilih.pesanan.waktu).toLocaleString('id-ID')}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPesananDipilih(null)}
                style={{ fontSize: '0.875rem', color: 'var(--muted)', minHeight: '36px' }}
              >
                Tutup
              </button>
            </div>

            {notifSalin && (
              <div
                style={{
                  padding: '8px',
                  borderRadius: 'var(--radius)',
                  background: 'var(--soft)',
                  fontSize: '0.8125rem',
                  textAlign: 'center',
                  marginBottom: '12px',
                }}
              >
                {notifSalin}
              </div>
            )}

            {pesananDipilih.pesanan.status === 'batal' && (
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: 'var(--radius)',
                  background: 'var(--danger-soft)',
                  border: '1px solid rgba(220, 38, 38, 0.2)',
                  color: 'var(--danger)',
                  fontSize: '0.8125rem',
                  marginBottom: '14px',
                }}
              >
                <strong>Pesanan Dibatalkan</strong>
                <div>Alasan: {pesananDipilih.pesanan.alasan_batal}</div>
              </div>
            )}

            {/* Rincian Produk */}
            <div style={{ borderBottom: '1px solid var(--line)', paddingBottom: '10px', marginBottom: '10px' }}>
              {pesananDipilih.items.map((it) => (
                <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                      {it.qty}x {it.nama_produk}
                    </div>
                    {it.tambahan.map((t) => (
                      <div key={t.nama} style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                        + {t.nama} ({formatRupiah(t.harga)})
                      </div>
                    ))}
                  </div>
                  <div class="tabular-nums" style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                    {formatRupiah((it.harga_satuan + it.tambahan.reduce((s, x) => s + x.harga * x.qty, 0)) * it.qty)}
                  </div>
                </div>
              ))}
            </div>

            {/* Ringkasan Biaya */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.875rem' }}>
              <span>Total:</span>
              <strong class="tabular-nums">{formatRupiah(pesananDipilih.pesanan.total)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.875rem' }}>
              <span>Metode:</span>
              <span>{pesananDipilih.pesanan.metode.toUpperCase()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.875rem' }}>
              <span>Bayar:</span>
              <span class="tabular-nums">{formatRupiah(pesananDipilih.pesanan.bayar)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', fontSize: '0.875rem' }}>
              <span>Kembalian:</span>
              <span class="tabular-nums">{formatRupiah(pesananDipilih.pesanan.kembalian)}</span>
            </div>

            {/* Tombol Cetak & Bagikan Struk */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <button
                type="button"
                class="btn-secondary"
                onClick={handleCetak}
                style={{ flex: 1, minHeight: '46px' }}
              >
                Cetak Struk
              </button>
              <button
                type="button"
                class="btn-secondary"
                onClick={handleBagikan}
                style={{ flex: 1, minHeight: '46px' }}
              >
                Bagikan
              </button>
            </div>

            {/* Tombol Batalkan Pesanan (Hanya jika belum batal) */}
            {pesananDipilih.pesanan.status === 'selesai' && (
              <button
                type="button"
                onClick={() => setModalBatal(true)}
                style={{
                  width: '100%',
                  color: 'var(--danger)',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  padding: '12px',
                  borderRadius: 'var(--radius)',
                  background: 'var(--danger-soft)',
                  minHeight: '46px',
                }}
              >
                Batalkan Pesanan
              </button>
            )}
          </div>
        </div>
      )}

      {/* Modal Alasan Pembatalan Pesanan */}
      {modalBatal && pesananDipilih && (
        <div
          class="no-print"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.4)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            zIndex: 50,
          }}
        >
          <div class="card" style={{ width: '100%', maxWidth: '380px', margin: 0, background: 'var(--surface)' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '6px' }}>
              Batalkan Pesanan {pesananDipilih.nomorAntrean}
            </h3>
            <p style={{ color: 'var(--muted)', fontSize: '0.8125rem', marginBottom: '14px' }}>
              Alasan pembatalan wajib diisi untuk pencatatan log audit toko.
            </p>

            {errorBatal && (
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--radius)',
                  background: 'var(--danger-soft)',
                  color: 'var(--danger)',
                  fontSize: '0.8125rem',
                  marginBottom: '12px',
                }}
              >
                {errorBatal}
              </div>
            )}

            <form onSubmit={handleBatalkan}>
              <textarea
                required
                rows={3}
                placeholder="Contoh: Pelanggan salah pilih menu / batal pesan"
                value={alasanBatal}
                onInput={(e) => setAlasanBatal((e.target as HTMLTextAreaElement).value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--line)',
                  background: 'var(--surface)',
                  fontSize: '0.875rem',
                  marginBottom: '16px',
                }}
                autoFocus
              />

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  class="btn-secondary"
                  onClick={() => {
                    setModalBatal(false);
                    setErrorBatal('');
                  }}
                  style={{ flex: 1 }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    background: 'var(--danger)',
                    color: '#ffffff',
                    fontWeight: 600,
                    borderRadius: 'var(--radius)',
                    minHeight: '48px',
                  }}
                >
                  Konfirmasi Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Komponen Cetak Fisik 58 mm untuk Riwayat */}
      {pesananDipilih && (
        <div class="struk-print-area" style={{ display: 'none' }}>
          <div style={{ textAlign: 'center', marginBottom: '8px' }}>
            <strong style={{ fontSize: '13px' }}>MITARASA</strong>
            <div>Ayam Goreng Tradisional</div>
          </div>
          <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '4px 0', margin: '4px 0' }}>
            <div>No. Antrean: <strong>{pesananDipilih.nomorAntrean}</strong></div>
            <div>Tgl: {new Date(pesananDipilih.pesanan.waktu).toLocaleString('id-ID')}</div>
            {pesananDipilih.pesanan.status === 'batal' && (
              <div>STATUS: <strong>DIBATALKAN</strong></div>
            )}
          </div>
          <div style={{ margin: '4px 0' }}>
            {pesananDipilih.items.map((it) => (
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
            <div>Total: <strong>{formatRupiah(pesananDipilih.pesanan.total)}</strong></div>
            <div>Bayar: {formatRupiah(pesananDipilih.pesanan.bayar)}</div>
            <div>Kembalian: {formatRupiah(pesananDipilih.pesanan.kembalian)}</div>
          </div>
        </div>
      )}
    </div>
  );
}
