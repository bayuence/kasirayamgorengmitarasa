import { useState, useEffect } from 'preact/hooks';
import { getLocalDB, type ShiftItem, type OutboxItem } from '../../data/db.js';
import { formatRupiah } from '../../util/rupiah.js';
import { sessionSignal } from '../../state/sesi.js';
import { pendingOutboxCountSignal } from '../../state/sinkron.js';
import { prosesOutbox } from '../../data/sync.js';

export function LayarShift() {
  const [shiftAktif, setShiftAktif] = useState<ShiftItem | null>(null);
  const [riwayatShift, setRiwayatShift] = useState<ShiftItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Form Buka Shift
  const [kasAwalInput, setKasAwalInput] = useState<number>(100000);

  // Form Tutup Shift
  const [kasAkhirInput, setKasAkhirInput] = useState<number>(0);
  const [totalTunaiShift, setTotalTunaiShift] = useState<number>(0);
  const [totalQrisShift, setTotalQrisShift] = useState<number>(0);
  const [jumlahPesananShift, setJumlahPesananShift] = useState<number>(0);

  const muatDataShift = async () => {
    setLoading(true);
    const db = await getLocalDB();

    // Cek ID shift aktif
    const metaAktif = await db.get('meta', 'shift_aktif_id');
    let aktif: ShiftItem | null = null;

    if (metaAktif && typeof metaAktif.val === 'string') {
      const item = await db.get('shift', metaAktif.val);
      if (item && !item.tutup_pada) {
        aktif = item;
      }
    }

    setShiftAktif(aktif);

    if (aktif) {
      // Hitung total tunai dan transaksi untuk shift ini
      const semuaPesanan = await db.getAll('pesanan');
      const pesananShiftIni = semuaPesanan.filter(
        (p) => p.shift_id === aktif?.id && p.status === 'selesai',
      );

      let tunai = 0;
      let qris = 0;
      for (const p of pesananShiftIni) {
        if (p.metode === 'tunai') tunai += p.total;
        else if (p.metode === 'qris') qris += p.total;
      }

      setTotalTunaiShift(tunai);
      setTotalQrisShift(qris);
      setJumlahPesananShift(pesananShiftIni.length);
      setKasAkhirInput(aktif.kas_awal + tunai);
    }

    // Ambil riwayat shift yang sudah tutup
    const semuaShift = await db.getAll('shift');
    const closed = semuaShift
      .filter((s) => Boolean(s.tutup_pada))
      .sort((a, b) => new Date(b.buka_pada).getTime() - new Date(a.buka_pada).getTime());
    setRiwayatShift(closed);

    setLoading(false);
  };

  useEffect(() => {
    muatDataShift();
  }, []);

  const handleBukaShift = async (e: Event) => {
    e.preventDefault();
    const db = await getLocalDB();
    const shiftId = crypto.randomUUID();
    const waktuISO = new Date().toISOString();
    const kasirId = sessionSignal.value?.id || 'kasir-lokal';

    const dataBaru: ShiftItem = {
      id: shiftId,
      kasir_id: kasirId,
      buka_pada: waktuISO,
      tutup_pada: null,
      kas_awal: kasAwalInput,
      kas_akhir: null,
      selisih: null,
    };

    const outboxItem: OutboxItem = {
      id: crypto.randomUUID(),
      tabel: 'shift',
      data: dataBaru,
      waktu: waktuISO,
      status: 'pending',
      percobaan: 0,
    };

    const tx = db.transaction(['shift', 'meta', 'outbox'], 'readwrite');
    await tx.objectStore('shift').put(dataBaru);
    await tx.objectStore('meta').put({ key: 'shift_aktif_id', val: shiftId });
    await tx.objectStore('outbox').put(outboxItem);
    await tx.done;

    pendingOutboxCountSignal.value = await db.count('outbox');
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      prosesOutbox().catch(() => {});
    }

    await muatDataShift();
  };

  const handleTutupShift = async (e: Event) => {
    e.preventDefault();
    if (!shiftAktif) return;

    const db = await getLocalDB();
    const waktuTutup = new Date().toISOString();
    const estimasiKas = shiftAktif.kas_awal + totalTunaiShift;
    const selisih = kasAkhirInput - estimasiKas;

    const updatedShift: ShiftItem = {
      ...shiftAktif,
      tutup_pada: waktuTutup,
      kas_akhir: kasAkhirInput,
      selisih,
    };

    const outboxItem: OutboxItem = {
      id: crypto.randomUUID(),
      tabel: 'shift',
      data: updatedShift,
      waktu: waktuTutup,
      status: 'pending',
      percobaan: 0,
    };

    const tx = db.transaction(['shift', 'meta', 'outbox'], 'readwrite');
    await tx.objectStore('shift').put(updatedShift);
    await tx.objectStore('meta').delete('shift_aktif_id');
    await tx.objectStore('outbox').put(outboxItem);
    await tx.done;

    pendingOutboxCountSignal.value = await db.count('outbox');
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      prosesOutbox().catch(() => {});
    }

    await muatDataShift();
  };

  if (loading) {
    return (
      <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--muted)' }}>
        Memuat data shift...
      </div>
    );
  }

  // 1. Tampilan Buka Shift jika belum ada shift aktif
  if (!shiftAktif) {
    return (
      <div style={{ padding: '16px', maxWidth: '440px', margin: '0 auto', width: '100%', paddingBottom: '40px' }}>
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '4px' }}>
            Buka Shift Kasir
          </h2>
          <p style={{ color: 'var(--muted)', fontSize: '0.8125rem' }}>
            Isi modal kas awal laci sebelum mencatat pesanan pertama.
          </p>
        </div>

        <div class="card">
          <form onSubmit={handleBukaShift}>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '8px' }}>
              Modal Kas Awal Laci:
            </label>

            <input
              type="number"
              min={0}
              step={1000}
              required
              value={kasAwalInput}
              onInput={(e) => setKasAwalInput(Number((e.target as HTMLInputElement).value) || 0)}
              style={{
                width: '100%',
                fontSize: '1.25rem',
                fontWeight: 700,
                padding: '12px 14px',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--line)',
                background: 'var(--surface)',
                marginBottom: '12px',
              }}
            />

            {/* Tombol Nominal Cepat */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '20px' }}>
              {[0, 50000, 100000, 200000].map((nom) => (
                <button
                  key={nom}
                  type="button"
                  onClick={() => setKasAwalInput(nom)}
                  style={{
                    padding: '8px 4px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--line)',
                    background: kasAwalInput === nom ? 'var(--ink)' : 'var(--soft)',
                    color: kasAwalInput === nom ? 'var(--surface)' : 'var(--ink)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    minHeight: '40px',
                  }}
                >
                  {nom === 0 ? 'Rp 0' : formatRupiah(nom)}
                </button>
              ))}
            </div>

            <button type="submit" class="btn-primary">
              Buka Shift Sekarang
            </button>
          </form>
        </div>

        {/* Riwayat Shift Sebelumnya */}
        {riwayatShift.length > 0 && (
          <div style={{ marginTop: '24px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '10px' }}>
              Riwayat Shift Ditutup
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {riwayatShift.map((s) => (
                <div key={s.id} class="card" style={{ margin: 0, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                    <span style={{ color: 'var(--muted)' }}>
                      {new Date(s.buka_pada).toLocaleDateString('id-ID')}
                    </span>
                    <strong class="tabular-nums">
                      Kas Akhir: {formatRupiah(s.kas_akhir || 0)}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginTop: '4px' }}>
                    <span>Modal: {formatRupiah(s.kas_awal)}</span>
                    <span style={{ color: (s.selisih || 0) < 0 ? 'var(--danger)' : 'var(--ink)' }}>
                      Selisih: {s.selisih === 0 ? 'Uang pas' : formatRupiah(s.selisih || 0)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // 2. Tampilan Tutup Shift jika sedang ada shift berjalan
  const waktuBuka = new Date(shiftAktif.buka_pada).toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const estimasiKasLaci = shiftAktif.kas_awal + totalTunaiShift;
  const selisih = kasAkhirInput - estimasiKasLaci;

  return (
    <div style={{ padding: '16px', maxWidth: '440px', margin: '0 auto', width: '100%', paddingBottom: '40px' }}>
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
            Shift Berjalan
          </h2>
          <span
            style={{
              fontSize: '0.6875rem',
              fontWeight: 700,
              background: 'var(--soft)',
              color: 'var(--ink)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)',
            }}
          >
            AKTIF
          </span>
        </div>
        <p style={{ color: 'var(--muted)', fontSize: '0.8125rem', marginTop: '2px' }}>
          Dibuka sejak {waktuBuka}
        </p>
      </div>

      {/* Ringkasan Penjualan Shift */}
      <div class="card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.875rem' }}>
          <span style={{ color: 'var(--muted)' }}>Modal Kas Awal:</span>
          <span class="tabular-nums" style={{ fontWeight: 600 }}>{formatRupiah(shiftAktif.kas_awal)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.875rem' }}>
          <span style={{ color: 'var(--muted)' }}>Penjualan Tunai ({jumlahPesananShift} pesanan):</span>
          <span class="tabular-nums" style={{ fontWeight: 600 }}>+{formatRupiah(totalTunaiShift)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.875rem' }}>
          <span style={{ color: 'var(--muted)' }}>Penjualan QRIS:</span>
          <span class="tabular-nums" style={{ fontWeight: 600 }}>+{formatRupiah(totalQrisShift)}</span>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            paddingTop: '8px',
            borderTop: '1px solid var(--line)',
            fontSize: '0.9375rem',
          }}
        >
          <span style={{ fontWeight: 600 }}>Estimasi Uang Fisik Laci:</span>
          <strong class="tabular-nums" style={{ fontSize: '1.125rem', color: 'var(--ink)' }}>
            {formatRupiah(estimasiKasLaci)}
          </strong>
        </div>
      </div>

      {/* Form Tutup Shift */}
      <div class="card">
        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '12px' }}>
          Tutup Shift Kasir
        </h3>

        <form onSubmit={handleTutupShift}>
          <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '6px' }}>
            Hitung Uang Fisik di Laci:
          </label>
          <input
            type="number"
            min={0}
            step={1000}
            required
            value={kasAkhirInput}
            onInput={(e) => setKasAkhirInput(Number((e.target as HTMLInputElement).value) || 0)}
            style={{
              width: '100%',
              fontSize: '1.25rem',
              fontWeight: 700,
              padding: '12px 14px',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--line)',
              background: 'var(--surface)',
              marginBottom: '12px',
            }}
          />

          {/* Indikator Selisih Kas */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 'var(--radius)',
              background: selisih === 0 ? 'var(--soft)' : selisih < 0 ? 'var(--danger-soft)' : 'var(--soft)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
            }}
          >
            <span style={{ fontSize: '0.8125rem', fontWeight: 500 }}>
              Status Selisih:
            </span>
            <strong
              class="tabular-nums"
              style={{
                fontSize: '0.9375rem',
                color: selisih < 0 ? 'var(--danger)' : 'var(--ink)',
              }}
            >
              {selisih === 0
                ? 'Uang Pas (Sesuai)'
                : selisih > 0
                ? `Lebih: +${formatRupiah(selisih)}`
                : `Kurang: -${formatRupiah(Math.abs(selisih))}`}
            </strong>
          </div>

          <button type="submit" class="btn-primary">
            Tutup Shift & Simpan Laporan
          </button>
        </form>
      </div>
    </div>
  );
}
