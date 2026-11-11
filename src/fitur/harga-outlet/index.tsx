import { useState, useEffect } from 'preact/hooks';
import {
  muatProdukDenganHargaOutlet,
  muatSemuaKategori,
  simpanKategoriAdmin,
  hapusKategoriAdmin,
  simpanUrutanKategori,
  simpanProdukAdmin,
  hapusProdukAdmin,
  hitungKeuntungan,
  sinkronkanMenuDariSupabase,
  type ProdukDenganHargaOutlet,
} from '../../data/menu.js';
import {
  muatSemuaOutlet,
  simpanHargaProdukPerOutlet,
  outletAktifSignal,
} from '../../data/outlet.js';
import { formatRupiah } from '../../util/rupiah.js';
import type { OutletItem, KategoriItem, ProdukItem } from '../../data/db.js';
import {
  IconToko,
  IconCheck,
  IconPiringSendok,
  IconTutup,
} from '../../komponen/Icon.js';

// Helper kompresi foto unggahan ke string kode data (WebP/JPEG) ultra-ringan
export function kompresFotoKeKode(file: File): Promise<{ kode: string; ukuranKb: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const TARGET_SIZE = 240; // resolusi ideal square untuk kasir mobile

        let sWidth = img.width;
        let sHeight = img.height;
        let sx = 0;
        let sy = 0;

        // Center crop 1:1 agar foto simetris dan tidak gepeng/terdistorsi
        if (sWidth > sHeight) {
          sx = (sWidth - sHeight) / 2;
          sWidth = sHeight;
        } else if (sHeight > sWidth) {
          sy = (sHeight - sWidth) / 2;
          sHeight = sWidth;
        }

        canvas.width = TARGET_SIZE;
        canvas.height = TARGET_SIZE;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas tidak didukung'));
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, TARGET_SIZE, TARGET_SIZE);

        // Kompresi WebP (atau fallback JPEG) kualitas optimal
        let dataUrl = canvas.toDataURL('image/webp', 0.8);
        if (!dataUrl.startsWith('data:image/webp')) {
          dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        }

        // Hitung estimasi ukuran string dalam KB
        const ukuranKb = Math.max(1, Math.round((dataUrl.length * 0.75) / 1024));
        resolve({ kode: dataUrl, ukuranKb });
      };
      img.onerror = () => reject(new Error('Format gambar tidak dapat dibaca'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Gagal membaca berkas'));
    reader.readAsDataURL(file);
  });
}

export function LayarHargaOutlet() {
  const [daftarOutlet, setDaftarOutlet] = useState<OutletItem[]>([]);
  const [outletTerpilih, setOutletTerpilih] = useState<string>('');
  const [daftarKategori, setDaftarKategori] = useState<KategoriItem[]>([]);
  const [kategoriFilter, setKategoriFilter] = useState<string>('semua');
  const [produkList, setProdukList] = useState<ProdukDenganHargaOutlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [pesanSukses, setPesanSukses] = useState('');

  // Draft input nominal { [produkId]: string }
  const [draftHarga, setDraftHarga] = useState<Record<string, string>>({});
  // Draft ketersediaan outlet { [produkId]: boolean }
  const [draftAktif, setDraftAktif] = useState<Record<string, boolean>>({});

  // ── Pop-up Modal Atur Kategori ──
  const [tampilModalKategori, setTampilModalKategori] = useState(false);
  const [formNamaKategori, setFormNamaKategori] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingNama, setEditingNama] = useState('');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // ── Pop-up Modal Tambah / Edit Menu ──
  const [tampilModalMenu, setTampilModalMenu] = useState(false);
  const [editProdukId, setEditProdukId] = useState<string | null>(null);
  const [formMenuNama, setFormMenuNama] = useState('');
  const [formMenuKategori, setFormMenuKategori] = useState('');
  const [formMenuGambar, setFormMenuGambar] = useState('');
  const [ukuranKodeKb, setUkuranKodeKb] = useState<number>(0);
  const [sedangKompres, setSedangKompres] = useState<boolean>(false);
  const [formMenuHpp, setFormMenuHpp] = useState<number | ''>('');
  const [formMenuHarga, setFormMenuHarga] = useState<number | ''>('');
  const [formMenuIsi, setFormMenuIsi] = useState('');
  const [formMenuAktif, setFormMenuAktif] = useState(true);

  useEffect(() => {
    sinkronkanMenuDariSupabase().catch(() => {});

    Promise.all([muatSemuaOutlet(), muatSemuaKategori()]).then(([outlets, kategoris]) => {
      setDaftarOutlet(outlets);
      setDaftarKategori(kategoris);

      const hash = window.location.hash;
      const match = hash.match(/outlet=([^&]+)/);
      const urlOutletId = match ? match[1] : null;

      const targetId = urlOutletId || outletAktifSignal.value?.id || (outlets[0] ? outlets[0].id : '');
      setOutletTerpilih(targetId);

      if (targetId) {
        muatDataHarga(targetId);
      }
    });
  }, []);

  const muatDataHarga = async (outletId: string) => {
    setLoading(true);
    try {
      const data = await muatProdukDenganHargaOutlet(outletId);
      setProdukList(data);

      const draft: Record<string, string> = {};
      const aktifMap: Record<string, boolean> = {};
      for (const item of data) {
        draft[item.produk.id] = String(item.hargaEfektif);
        aktifMap[item.produk.id] = item.aktifDiOutlet;
      }
      setDraftHarga(draft);
      setDraftAktif(aktifMap);
    } catch (e) {
      console.warn('Gagal muat harga outlet:', e);
    } finally {
      setLoading(false);
    }
  };

  const refreshKategori = async () => {
    const kategoris = await muatSemuaKategori();
    setDaftarKategori(kategoris);
  };

  const notifikasi = (teks: string) => {
    setPesanSukses(teks);
    setTimeout(() => setPesanSukses(''), 3000);
  };

  const handleChangeOutlet = (outletId: string) => {
    setOutletTerpilih(outletId);
    muatDataHarga(outletId);
  };

  // ── Simpan Harga Langsung dari Kartu ──
  const handleSimpanHargaKartu = async (produkId: string, namaProduk: string) => {
    if (!outletTerpilih) return;
    const nominalRaw = draftHarga[produkId];
    const isAktif = draftAktif[produkId] ?? true;

    const nominal = Number(nominalRaw);
    if (isNaN(nominal) || nominal < 0) {
      alert('Masukkan nominal harga yang valid.');
      return;
    }

    const item = produkList.find((p) => p.produk.id === produkId);
    await simpanHargaProdukPerOutlet(outletTerpilih, produkId, nominal, isAktif, item?.hppEfektif);
    notifikasi(`Harga "${namaProduk}" berhasil disimpan: ${formatRupiah(nominal)}`);
    await muatDataHarga(outletTerpilih);
  };

  // ── Toggle Modern Switch ON/OFF ──
  const handleToggleAktifSwitch = async (produkId: string, namaProduk: string) => {
    if (!outletTerpilih) return;
    const statusSaatIni = draftAktif[produkId] ?? true;
    const statusBaru = !statusSaatIni;

    setDraftAktif({ ...draftAktif, [produkId]: statusBaru });

    const item = produkList.find((p) => p.produk.id === produkId);
    const hargaPakai = draftHarga[produkId] ? Number(draftHarga[produkId]) : (item?.hargaEfektif || 0);

    await simpanHargaProdukPerOutlet(outletTerpilih, produkId, hargaPakai, statusBaru, item?.hppEfektif);
    notifikasi(`Status "${namaProduk}" diubah: ${statusBaru ? 'Menu Aktif' : 'Menu Tidak Aktif'}`);
    await muatDataHarga(outletTerpilih);
  };

  // ── Handler Upload & Kompresi Foto ke Kode Data Ringan ──
  const handlePilihFoto = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    setSedangKompres(true);
    try {
      const { kode, ukuranKb } = await kompresFotoKeKode(file);
      setFormMenuGambar(kode);
      setUkuranKodeKb(ukuranKb);
    } catch (err) {
      alert('Gagal memproses gambar. Pastikan format file gambar valid.');
    } finally {
      setSedangKompres(false);
      (e.target as HTMLInputElement).value = '';
    }
  };

  // ── Buka Modal Tambah Menu Baru ──
  const handleBukaTambahMenu = () => {
    setEditProdukId(null);
    setFormMenuNama('');
    setFormMenuKategori(daftarKategori[0]?.nama || 'Paket Ayam');
    setFormMenuGambar('');
    setUkuranKodeKb(0);
    setFormMenuHpp('');
    setFormMenuHarga('');
    setFormMenuIsi('');
    setFormMenuAktif(true);
    setTampilModalMenu(true);
  };

  // ── Buka Modal Edit Menu ──
  const handleBukaEditMenu = (item: ProdukDenganHargaOutlet) => {
    setEditProdukId(item.produk.id);
    setFormMenuNama(item.produk.paket);
    setFormMenuKategori(item.produk.kategori || item.produk.varian || daftarKategori[0]?.nama || 'Paket Ayam');
    const g = item.produk.gambar || '';
    setFormMenuGambar(g);
    setUkuranKodeKb(g.startsWith('data:') ? Math.max(1, Math.round((g.length * 0.75) / 1024)) : 0);
    setFormMenuHpp(item.hppEfektif);
    setFormMenuHarga(item.hargaEfektif);
    setFormMenuIsi(item.produk.isi || '');
    setFormMenuAktif(item.aktifDiOutlet);
    setTampilModalMenu(true);
  };

  // ── Simpan Form Menu (Tambah / Edit) ──
  const handleSimpanFormMenu = async (e: Event) => {
    e.preventDefault();
    if (!formMenuNama.trim() || formMenuHarga === '') {
      alert('Nama menu dan harga jual wajib diisi');
      return;
    }

    const kategoriObj = daftarKategori.find((k) => k.nama === formMenuKategori);
    const hargaNum = Number(formMenuHarga);
    const hppNum = formMenuHpp === '' ? Math.round(hargaNum * 0.6) : Number(formMenuHpp);
    const idProduk = editProdukId || crypto.randomUUID();

    const produkData: ProdukItem = {
      id: idProduk,
      varian: formMenuKategori,
      paket: formMenuNama.trim(),
      kategori: formMenuKategori,
      kategori_id: kategoriObj?.id || null,
      gambar: formMenuGambar || '',
      hpp: hppNum,
      harga: hargaNum,
      isi: formMenuIsi.trim(),
      urutan: editProdukId
        ? produkList.find((p) => p.produk.id === editProdukId)?.produk.urutan || 1
        : produkList.length + 1,
      aktif: formMenuAktif,
      diubah_pada: new Date().toISOString(),
    };

    // Simpan ke database produk dan harga khusus outlet
    await simpanProdukAdmin(produkData);
    if (outletTerpilih) {
      await simpanHargaProdukPerOutlet(outletTerpilih, idProduk, hargaNum, formMenuAktif, hppNum);
    }

    setTampilModalMenu(false);
    notifikasi(editProdukId ? `Menu "${produkData.paket}" berhasil diperbarui` : `Menu baru "${produkData.paket}" berhasil ditambahkan`);
    await muatDataHarga(outletTerpilih);
  };

  // ── Hapus Menu ──
  const handleHapusMenu = async (produkId: string, namaMenu: string) => {
    if (confirm(`Hapus menu "${namaMenu}" dari toko ini?`)) {
      await hapusProdukAdmin(produkId);
      notifikasi(`Menu "${namaMenu}" berhasil dihapus`);
      await muatDataHarga(outletTerpilih);
    }
  };

  // ── Reorder Kategori (Pindah Urutan) ──
  const handlePindahUrutan = async (dariIndex: number, keIndex: number) => {
    if (keIndex < 0 || keIndex >= daftarKategori.length || dariIndex === keIndex) return;

    const baru = [...daftarKategori];
    const [dipindah] = baru.splice(dariIndex, 1);
    baru.splice(keIndex, 0, dipindah);

    const listBaru = baru.map((k, idx) => ({ ...k, urutan: idx + 1 }));
    setDaftarKategori(listBaru);
    await simpanUrutanKategori(listBaru);
  };

  // ── Tambah Kategori Baru ──
  const handleTambahKategori = async (e: Event) => {
    e.preventDefault();
    const namaBersih = formNamaKategori.trim();
    if (!namaBersih) return;

    const sudahAda = daftarKategori.some((k) => k.nama.trim().toLowerCase() === namaBersih.toLowerCase());
    if (sudahAda) {
      alert(`Kategori "${namaBersih}" sudah ada.`);
      return;
    }

    const baru: KategoriItem = {
      id: crypto.randomUUID(),
      nama: namaBersih,
      urutan: daftarKategori.length + 1,
      aktif: true,
      diubah_pada: new Date().toISOString(),
    };

    await simpanKategoriAdmin(baru);
    setFormNamaKategori('');
    await refreshKategori();
    await muatDataHarga(outletTerpilih);
    notifikasi(`Kategori "${baru.nama}" berhasil ditambahkan`);
  };

  // ── Rename Kategori ──
  const handleSimpanRename = async (id: string) => {
    const namaBaru = editingNama.trim();
    if (!namaBaru) return;

    const kat = daftarKategori.find((k) => k.id === id);
    if (!kat) return;

    const updated: KategoriItem = {
      ...kat,
      nama: namaBaru,
      diubah_pada: new Date().toISOString(),
    };

    await simpanKategoriAdmin(updated);
    setEditingId(null);
    setEditingNama('');
    await refreshKategori();
    await muatDataHarga(outletTerpilih);
    notifikasi(`Kategori diubah menjadi "${namaBaru}"`);
  };

  // ── Hapus Kategori ──
  const handleHapusKategori = async (id: string, nama: string) => {
    const jumlahMenu = produkList.filter(({ produk }) => matchesKategori(produk, nama)).length;
    if (jumlahMenu > 0) {
      alert(`Kategori "${nama}" masih digunakan oleh ${jumlahMenu} menu. Ubah kategori menu terkait terlebih dahulu.`);
      return;
    }
    if (confirm(`Hapus kategori "${nama}"?`)) {
      await hapusKategoriAdmin(id);
      await refreshKategori();
      await muatDataHarga(outletTerpilih);
      notifikasi(`Kategori "${nama}" telah dihapus`);
    }
  };

  // Helper pencocokan kategori yang fleksibel & konsisten
  const matchesKategori = (produk: any, katNama: string) => {
    const k = produk.kategori || produk.varian || '';
    if (k.toLowerCase() === katNama.toLowerCase()) return true;
    if (katNama === 'Paket Ayam') {
      return !k || k === 'Original' || k === 'Spicy' || k.toLowerCase().includes('ayam') || produk.paket?.toLowerCase().includes('paket');
    }
    if (katNama === 'Minuman') {
      return k.toLowerCase().includes('minum') || produk.paket?.toLowerCase().includes('teh') || produk.paket?.toLowerCase().includes('jeruk');
    }
    if (katNama === 'Tambahan & Sambal') {
      return k.toLowerCase().includes('tambahan') || k.toLowerCase().includes('sambal') || produk.paket?.toLowerCase().includes('kremes');
    }
    return false;
  };

  // Helper render foto produk (Bebas dari emotikon)
  const renderVisualMenu = (gambar?: string) => {
    if (gambar && (gambar.startsWith('data:') || gambar.startsWith('http'))) {
      return <img src={gambar} alt="Menu" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
    }
    return <IconPiringSendok size={22} color="#64748b" />;
  };

  const outletObj = daftarOutlet.find((o) => o.id === outletTerpilih);

  // Filter daftar menu
  const listTersaring = produkList.filter(({ produk }) => {
    if (kategoriFilter === 'semua') return true;
    return matchesKategori(produk, kategoriFilter);
  });

  // Live calculation di Modal Menu
  const liveMenuJual = formMenuHarga === '' ? 0 : Number(formMenuHarga);
  const liveMenuHpp = formMenuHpp === '' ? 0 : Number(formMenuHpp);
  const liveMenuCalc = hitungKeuntungan(liveMenuJual, liveMenuHpp);

  return (
    <div
      style={{
        padding: '12px 14px 90px',
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        overflowX: 'hidden',
      }}
    >
      {/* ── Top Bar Navigasi ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <a
          href="#/kasir"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            fontSize: '0.8125rem',
            fontWeight: 600,
            color: '#64748b',
            textDecoration: 'none',
            padding: '4px 0',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          <span>Kembali ke Kasir</span>
        </a>

        <a
          href="#/outlet"
          style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: '#2563eb',
            textDecoration: 'none',
          }}
        >
          Daftar Toko ›
        </a>
      </div>

      {/* ── Header Halaman ── */}
      <div style={{ marginBottom: '14px' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 4px', color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1.25 }}>
          Kelola Menu & Harga Toko
        </h2>
        <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0, lineHeight: 1.4 }}>
          Atur menu, kategori, modal HPP, margin keuntungan, dan harga jual tiap toko
        </p>
      </div>

      {/* ── Alert Pesan Sukses ── */}
      {pesanSukses && (
        <div
          style={{
            padding: '9px 12px',
            background: '#f0fdf4',
            color: '#15803d',
            borderRadius: '8px',
            fontSize: '0.75rem',
            fontWeight: 600,
            marginBottom: '14px',
            border: '1px solid #bbf7d0',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>{pesanSukses}</span>
        </div>
      )}

      {daftarOutlet.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '30px 16px',
            background: '#ffffff',
            border: '1px dashed #cbd5e1',
            borderRadius: '12px',
          }}
        >
          <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>
            Belum ada cabang toko yang didaftarkan
          </p>
          <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0 0 14px', lineHeight: 1.4 }}>
            Daftarkan lokasi cabang toko terlebih dahulu sebelum mengatur menu dan harga.
          </p>
          <a
            href="#/outlet"
            style={{
              display: 'inline-flex',
              padding: '8px 16px',
              background: '#0f172a',
              color: '#ffffff',
              borderRadius: '8px',
              fontSize: '0.75rem',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            + Daftarkan Cabang Baru
          </a>
        </div>
      ) : (
        <>
          {/* ── 1. KOTAK PEMILIHAN CABANG TOKO ── */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '12px',
              marginBottom: '10px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              boxSizing: 'border-box',
              width: '100%',
              maxWidth: '100%',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                PILIH CABANG TOKO:
              </label>
              {outletObj?.kode && (
                <span style={{ fontSize: '0.625rem', fontWeight: 700, background: '#0f172a', color: '#ffffff', padding: '1px 6px', borderRadius: '4px' }}>
                  KODE: {outletObj.kode}
                </span>
              )}
            </div>

            <select
              value={outletTerpilih}
              onChange={(e) => handleChangeOutlet((e.target as HTMLSelectElement).value)}
              style={{
                width: '100%',
                maxWidth: '100%',
                padding: '10px',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                background: '#f8fafc',
                fontSize: '0.875rem',
                fontWeight: 700,
                color: '#0f172a',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            >
              {daftarOutlet.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nama} ({o.kode}) {o.sumber === 'presensi' ? '• Presensi' : ''} {o.id === outletAktifSignal.value?.id ? '★ Kasir Aktif' : ''}
                </option>
              ))}
            </select>

            <p style={{ fontSize: '0.6875rem', color: '#64748b', margin: '6px 0 0', lineHeight: 1.35 }}>
              💡 Menu dan harga diatur masing-masing secara independen untuk toko ini.
            </p>
          </div>

          {/* ── 2. TEPAT DI BAWAH PEMILIHAN CABANG: BARIS AKSI KATEGORI & FILTER ── */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '10px 12px',
              marginBottom: '14px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              boxSizing: 'border-box',
              width: '100%',
              maxWidth: '100%',
            }}
          >
            {/* Header Toolbar: Tombol Tambah Menu & Tombol Atur Kategori */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleBukaTambahMenu}
                style={{
                  flex: 1,
                  padding: '7px 12px',
                  background: '#0f172a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '7px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '5px',
                  minHeight: '34px',
                  minWidth: '120px',
                  whiteSpace: 'nowrap',
                }}
              >
                <span>+ Tambah Menu Baru</span>
              </button>

              <button
                type="button"
                onClick={() => setTampilModalKategori(true)}
                style={{
                  padding: '7px 12px',
                  background: '#f8fafc',
                  color: '#0f172a',
                  border: '1px solid #cbd5e1',
                  borderRadius: '7px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '5px',
                  minHeight: '34px',
                  minWidth: 'auto',
                  whiteSpace: 'nowrap',
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                  <line x1="7" y1="7" x2="7.01" y2="7" />
                </svg>
                <span>Atur Kategori</span>
              </button>
            </div>

            {/* Filter Bar Kategori (Pills Horizontal Smooth) */}
            <div
              style={{
                display: 'flex',
                gap: '6px',
                overflowX: 'auto',
                paddingBottom: '2px',
                width: '100%',
                maxWidth: '100%',
                scrollbarWidth: 'none',
                boxSizing: 'border-box',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              <button
                type="button"
                onClick={() => setKategoriFilter('semua')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '999px',
                  border: '1px solid',
                  borderColor: kategoriFilter === 'semua' ? '#0f172a' : '#cbd5e1',
                  background: kategoriFilter === 'semua' ? '#0f172a' : '#f8fafc',
                  color: kategoriFilter === 'semua' ? '#ffffff' : '#475569',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  minHeight: '28px',
                  flexShrink: 0,
                }}
              >
                Semua ({produkList.length})
              </button>
              {daftarKategori.map((k) => {
                const count = produkList.filter(({ produk }) => matchesKategori(produk, k.nama)).length;
                const isSelected = kategoriFilter === k.nama;
                return (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => setKategoriFilter(k.nama)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '999px',
                      border: '1px solid',
                      borderColor: isSelected ? '#0f172a' : '#cbd5e1',
                      background: isSelected ? '#0f172a' : '#f8fafc',
                      color: isSelected ? '#ffffff' : '#475569',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      minHeight: '28px',
                      flexShrink: 0,
                    }}
                  >
                    {k.nama} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── 3. DAFTAR MENU CABANG ── */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8', fontSize: '0.8125rem' }}>
              Memuat menu cabang...
            </div>
          ) : listTersaring.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '30px 16px',
                background: '#ffffff',
                border: '1px dashed #cbd5e1',
                borderRadius: '12px',
              }}
            >
              <p style={{ fontSize: '0.8125rem', color: '#64748b', margin: '0 0 10px' }}>
                Tidak ada menu pada kategori ini.
              </p>
              <button
                type="button"
                onClick={handleBukaTambahMenu}
                style={{
                  padding: '7px 14px',
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
              {listTersaring.map((item) => {
                const { produk, hppEfektif, hargaEfektif } = item;
                const nominalInput = draftHarga[produk.id] ?? String(hargaEfektif);
                const isAktifToko = draftAktif[produk.id] ?? true;

                // Live calculation dari input
                const hargaPakai = nominalInput.trim() !== '' ? Number(nominalInput) : hargaEfektif;
                const liveCalc = hitungKeuntungan(hargaPakai, hppEfektif);

                return (
                  <div
                    key={produk.id}
                    style={{
                      background: '#ffffff',
                      border: isAktifToko ? '1px solid #e2e8f0' : '1px dashed #cbd5e1',
                      borderRadius: '12px',
                      padding: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      opacity: isAktifToko ? 1 : 0.65,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                      width: '100%',
                      maxWidth: '100%',
                      boxSizing: 'border-box',
                    }}
                  >
                    {/* Baris 1: Ikon Kode / Foto + Header Menu + Kategori */}
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', width: '100%' }}>
                      <div
                        style={{
                          width: '46px',
                          height: '46px',
                          borderRadius: '8px',
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          overflow: 'hidden',
                          flexShrink: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {renderVisualMenu(produk.gambar)}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap', marginBottom: '2px' }}>
                          <span
                            style={{
                              fontSize: '0.625rem',
                              fontWeight: 700,
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              padding: '1px 5px',
                              borderRadius: '3px',
                              border: '1px solid #dbeafe',
                            }}
                          >
                            {produk.kategori || produk.varian || 'Menu'}
                          </span>
                          <h4 style={{ fontSize: '0.875rem', fontWeight: 700, margin: 0, color: '#0f172a', lineHeight: 1.3 }}>
                            {produk.paket}
                          </h4>
                        </div>

                        {produk.isi && (
                          <p style={{ fontSize: '0.6875rem', color: '#64748b', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {produk.isi}
                          </p>
                        )}
                      </div>

                      {/* Tombol Edit Menu Cepat */}
                      <button
                        type="button"
                        onClick={() => handleBukaEditMenu(item)}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '5px',
                          border: '1px solid #cbd5e1',
                          background: '#ffffff',
                          color: '#0f172a',
                          fontSize: '0.6875rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          minHeight: '26px',
                          minWidth: 'auto',
                          flexShrink: 0,
                        }}
                      >
                        Edit Menu
                      </button>
                    </div>

                    {/* Baris 2: Komparasi Finansial Mandiri (HPP Modal, Harga Jual Toko, Keuntungan) */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        padding: '6px 8px',
                        gap: '4px',
                        width: '100%',
                        boxSizing: 'border-box',
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: '0.625rem', color: '#64748b', fontWeight: 500 }}>
                          Modal HPP
                        </span>
                        <strong style={{ fontSize: '0.75rem', color: '#334155', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {formatRupiah(hppEfektif)}
                        </strong>
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: '0.625rem', color: '#64748b', fontWeight: 500 }}>
                          Harga Jual Toko
                        </span>
                        <strong style={{ fontSize: '0.75rem', color: '#0f172a', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {formatRupiah(hargaPakai)}
                        </strong>
                      </div>

                      <div style={{ minWidth: 0, textAlign: 'right' }}>
                        <span style={{ display: 'block', fontSize: '0.625rem', color: '#64748b', fontWeight: 500 }}>
                          Keuntungan
                        </span>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: liveCalc.laba >= 0 ? '#15803d' : '#b91c1c' }}>
                            +{formatRupiah(liveCalc.laba)}
                          </span>
                          <span
                            style={{
                              fontSize: '0.5625rem',
                              fontWeight: 700,
                              padding: '1px 3px',
                              borderRadius: '3px',
                              background: liveCalc.marginPersen >= 30 ? '#dcfce7' : liveCalc.marginPersen >= 10 ? '#fef9c3' : '#fee2e2',
                              color: liveCalc.marginPersen >= 30 ? '#15803d' : liveCalc.marginPersen >= 10 ? '#854d0e' : '#b91c1c',
                            }}
                          >
                            {liveCalc.marginPersen}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Baris 3: Input Cepat Ubah Harga Jual Toko */}
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', width: '100%', boxSizing: 'border-box' }}>
                      <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>
                          Rp
                        </span>
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="Masukkan harga jual toko..."
                          value={nominalInput}
                          onInput={(e) => {
                            const val = (e.target as HTMLInputElement).value.replace(/\D/g, '');
                            setDraftHarga({ ...draftHarga, [produk.id]: val });
                          }}
                          style={{
                            width: '100%',
                            maxWidth: '100%',
                            padding: '7px 8px 7px 28px',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            fontSize: '0.8125rem',
                            fontWeight: 700,
                            color: '#0f172a',
                            background: '#f8fafc',
                            boxSizing: 'border-box',
                            outline: 'none',
                          }}
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSimpanHargaKartu(produk.id, produk.paket)}
                        style={{
                          padding: '7px 12px',
                          background: '#0f172a',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          minHeight: '34px',
                          minWidth: 'auto',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                        }}
                      >
                        Simpan Harga
                      </button>
                    </div>

                    {/* Baris 4: Tombol ON/OFF Modern Switch & Status Menu */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingTop: '4px',
                        borderTop: '1px solid #f1f5f9',
                      }}
                    >
                      {/* Modern Toggle Switch ON/OFF */}
                      <button
                        type="button"
                        onClick={() => handleToggleAktifSwitch(produk.id, produk.paket)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 0,
                          minHeight: 'auto',
                          minWidth: 'auto',
                        }}
                      >
                        {/* Kapsul Switch */}
                        <div
                          style={{
                            width: '38px',
                            height: '22px',
                            borderRadius: '11px',
                            background: isAktifToko ? '#16a34a' : '#cbd5e1',
                            position: 'relative',
                            transition: 'background-color 0.2s ease',
                            flexShrink: 0,
                          }}
                        >
                          {/* Tombol Bulat Slider */}
                          <div
                            style={{
                              width: '18px',
                              height: '18px',
                              borderRadius: '50%',
                              background: '#ffffff',
                              position: 'absolute',
                              top: '2px',
                              left: isAktifToko ? '18px' : '2px',
                              transition: 'left 0.2s ease',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                            }}
                          />
                        </div>

                        {/* Note Status Jelas */}
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: isAktifToko ? '#15803d' : '#64748b',
                          }}
                        >
                          {isAktifToko ? 'Menu Aktif' : 'Menu Tidak Aktif'}
                        </span>
                      </button>

                      {/* Tombol Hapus Menu */}
                      <button
                        type="button"
                        onClick={() => handleHapusMenu(produk.id, produk.paket)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#dc2626',
                          fontSize: '0.6875rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          padding: '2px 4px',
                          minHeight: 'auto',
                          minWidth: 'auto',
                        }}
                      >
                        Hapus Menu
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ══════════════ MODAL EDIT / TAMBAH MENU TOKO (LENGKAP: GAMBAR KODE, KATEGORI, HPP, JUAL) ══════════════ */}
      {tampilModalMenu && (
        <div class="sheet-backdrop" onClick={() => setTampilModalMenu(false)}>
          <div
            class="sheet no-scrollbar"
            onClick={(e) => e.stopPropagation()}
            style={{
              padding: '16px 18px 24px',
              maxWidth: '460px',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              boxSizing: 'border-box',
              borderRadius: '24px 24px 0 0',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
          >
            {/* Drag Handle */}
            <div style={{ width: '40px', height: '4px', background: '#cbd5e1', borderRadius: '999px', margin: '0 auto 12px', flexShrink: 0 }} />

            {/* Header Modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px', flexShrink: 0 }}>
              <div>
                <h3 style={{ fontSize: '1.0625rem', fontWeight: 800, margin: '0 0 2px', color: '#0f172a' }}>
                  {editProdukId ? 'Edit Menu Toko' : 'Tambah Menu Baru Toko'}
                </h3>
                <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>
                  Atur nama, kategori, kode ikon menu, modal HPP, dan harga jual
                </p>
              </div>

              <button
                type="button"
                onClick={() => setTampilModalMenu(false)}
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  background: '#f1f5f9',
                  border: 'none',
                  color: '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  minHeight: '30px',
                  minWidth: '30px',
                  padding: 0,
                }}
              >
                ✕
              </button>
            </div>

            {/* Form Scrollable */}
            <form
              onSubmit={handleSimpanFormMenu}
              class="no-scrollbar"
              style={{
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                paddingRight: '2px',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
              }}
            >
              {/* 1. Upload Foto Menu (Dikonversi Otomatis ke Kode Ringan) */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '12px',
                  boxSizing: 'border-box',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0f172a' }}>
                    Foto Gambar Menu
                  </label>
                  <span
                    style={{
                      fontSize: '0.625rem',
                      fontWeight: 700,
                      color: '#15803d',
                      background: '#dcfce7',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      border: '1px solid #bbf7d0',
                    }}
                  >
                    ⚡ Disimpan sebagai Kode Ringan
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  {/* Box Preview Foto */}
                  <div
                    style={{
                      width: '68px',
                      height: '68px',
                      borderRadius: '10px',
                      background: '#ffffff',
                      border: '1.5px dashed #cbd5e1',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      flexShrink: 0,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    }}
                  >
                    {formMenuGambar && (formMenuGambar.startsWith('data:') || formMenuGambar.startsWith('http')) ? (
                      <img src={formMenuGambar} alt="Preview Menu" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <IconPiringSendok size={28} color="#94a3b8" />
                    )}
                  </div>

                  {/* Kontrol Upload File */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <input
                      type="file"
                      accept="image/*"
                      id="input-upload-foto-outlet"
                      onChange={handlePilihFoto}
                      style={{ display: 'none' }}
                    />

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <label
                        htmlFor="input-upload-foto-outlet"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '7px 12px',
                          background: '#0f172a',
                          color: '#ffffff',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                        }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="17 8 12 3 7 8" />
                          <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                        <span>{formMenuGambar ? 'Ganti Foto' : 'Pilih / Ambil Foto'}</span>
                      </label>

                      {formMenuGambar && (
                        <button
                          type="button"
                          onClick={() => {
                            setFormMenuGambar('');
                            setUkuranKodeKb(0);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#dc2626',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            padding: '4px 6px',
                          }}
                        >
                          Hapus Foto
                        </button>
                      )}
                    </div>

                    <p style={{ fontSize: '0.6875rem', color: '#64748b', margin: '6px 0 0', lineHeight: 1.35 }}>
                      {sedangKompres ? (
                        <span style={{ color: '#2563eb', fontWeight: 600 }}>⏳ Mengompres foto menjadi kode data ringan...</span>
                      ) : ukuranKodeKb > 0 ? (
                        <span style={{ color: '#15803d', fontWeight: 600 }}>
                          ✓ Foto berhasil dikonversi ke kode ultra-ringan (~{ukuranKodeKb} KB). Siap disimpan!
                        </span>
                      ) : (
                        'Foto yang Anda upload otomatis dikonversi ke format kode teks ringan (~5 KB) tanpa menyimpan file fisik berat, agar kasir tetap super cepat & responsif.'
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* 2. Nama Menu */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Nama Menu <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Misal: Paket Ayam Geprek, Es Teh Manis..."
                  value={formMenuNama}
                  onInput={(e) => setFormMenuNama((e.target as HTMLInputElement).value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    border: '1.5px solid #cbd5e1',
                    borderRadius: '8px',
                    fontSize: '0.8125rem',
                    background: '#ffffff',
                    fontWeight: 600,
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
              </div>

              {/* 3. Ikut Kategori Apa? */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155' }}>
                    Masuk ke Kategori Apa? <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setTampilModalMenu(false);
                      setTampilModalKategori(true);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#2563eb',
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    + Kategori Baru
                  </button>
                </div>
                <select
                  value={formMenuKategori}
                  onChange={(e) => setFormMenuKategori((e.target as HTMLSelectElement).value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    border: '1.5px solid #cbd5e1',
                    borderRadius: '8px',
                    background: '#ffffff',
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    color: '#0f172a',
                    boxSizing: 'border-box',
                  }}
                >
                  {daftarKategori.map((k) => (
                    <option key={k.id} value={k.nama}>
                      {k.nama}
                    </option>
                  ))}
                </select>
              </div>

              {/* 4. Modal HPP vs Harga Jual Toko */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Modal HPP (Rp) <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="Contoh: 10000"
                    value={formMenuHpp}
                    onInput={(e) => setFormMenuHpp(Number((e.target as HTMLInputElement).value))}
                    style={{
                      width: '100%',
                      padding: '9px 10px',
                      border: '1.5px solid #cbd5e1',
                      borderRadius: '8px',
                      fontSize: '0.8125rem',
                      background: '#ffffff',
                      fontWeight: 700,
                      boxSizing: 'border-box',
                    }}
                  />
                  <span style={{ fontSize: '0.625rem', color: '#64748b' }}>Biaya modal bahan per porsi</span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Harga Jual Toko (Rp) <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="Contoh: 16000"
                    value={formMenuHarga}
                    onInput={(e) => setFormMenuHarga(Number((e.target as HTMLInputElement).value))}
                    style={{
                      width: '100%',
                      padding: '9px 10px',
                      border: '1.5px solid #cbd5e1',
                      borderRadius: '8px',
                      fontSize: '0.8125rem',
                      background: '#ffffff',
                      fontWeight: 700,
                      color: '#0f172a',
                      boxSizing: 'border-box',
                    }}
                  />
                  <span style={{ fontSize: '0.625rem', color: '#64748b' }}>Harga jual ke pembeli</span>
                </div>
              </div>

              {/* 5. Live Box Kalkulator Keuntungan Toko */}
              <div
                style={{
                  background: liveMenuCalc.laba >= 0 ? '#f0fdf4' : '#fef2f2',
                  border: `1px solid ${liveMenuCalc.laba >= 0 ? '#bbf7d0' : '#fecaca'}`,
                  borderRadius: '8px',
                  padding: '10px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>
                    Estimasi Keuntungan Toko
                  </span>
                  <span
                    style={{
                      fontSize: '0.625rem',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: liveMenuCalc.marginPersen >= 30 ? '#dcfce7' : liveMenuCalc.marginPersen >= 10 ? '#fef9c3' : '#fee2e2',
                      color: liveMenuCalc.marginPersen >= 30 ? '#15803d' : liveMenuCalc.marginPersen >= 10 ? '#854d0e' : '#b91c1c',
                    }}
                  >
                    Margin: {liveMenuCalc.marginPersen}%
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 800, color: liveMenuCalc.laba >= 0 ? '#15803d' : '#b91c1c' }}>
                    +{formatRupiah(liveMenuCalc.laba)} per porsi
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Markup: {liveMenuCalc.markupPersen}%
                  </span>
                </div>
              </div>

              {/* 6. Isi / Komposisi Menu */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Isi / Komposisi Menu (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Misal: Nasi putih, ayam bakar paha/dada, sambal terasi..."
                  value={formMenuIsi}
                  onInput={(e) => setFormMenuIsi((e.target as HTMLInputElement).value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    border: '1.5px solid #cbd5e1',
                    borderRadius: '8px',
                    fontSize: '0.8125rem',
                    background: '#ffffff',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* 7. Status Keaktifan (Modern Switch) */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155' }}>
                  Status Menu di Kasir:
                </span>
                <button
                  type="button"
                  onClick={() => setFormMenuAktif(!formMenuAktif)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    minHeight: 'auto',
                    minWidth: 'auto',
                  }}
                >
                  <div
                    style={{
                      width: '38px',
                      height: '22px',
                      borderRadius: '11px',
                      background: formMenuAktif ? '#16a34a' : '#cbd5e1',
                      position: 'relative',
                      transition: 'background-color 0.2s ease',
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        background: '#ffffff',
                        position: 'absolute',
                        top: '2px',
                        left: formMenuAktif ? '18px' : '2px',
                        transition: 'left 0.2s ease',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                      }}
                    />
                  </div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: formMenuAktif ? '#15803d' : '#64748b' }}>
                    {formMenuAktif ? 'Menu Aktif' : 'Menu Tidak Aktif'}
                  </span>
                </button>
              </div>

              {/* Tombol Simpan */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setTampilModalMenu(false)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: '#f1f5f9',
                    color: '#475569',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: '#0f172a',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {editProdukId ? 'Simpan Perubahan' : 'Tambah Menu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════ POP-UP MODAL CANGGIH: ATUR KATEGORI (NO SCROLLBAR, AUTO REORDER, TANPA NOMOR MANUAL) ══════════════ */}
      {tampilModalKategori && (
        <div class="sheet-backdrop" onClick={() => setTampilModalKategori(false)}>
          <div
            class="sheet no-scrollbar"
            onClick={(e) => e.stopPropagation()}
            style={{
              padding: '16px 18px 24px',
              maxWidth: '440px',
              maxHeight: '82vh',
              display: 'flex',
              flexDirection: 'column',
              boxSizing: 'border-box',
              borderRadius: '24px 24px 0 0',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
          >
            {/* Handle Drag Sheet */}
            <div
              style={{
                width: '40px',
                height: '4px',
                background: '#cbd5e1',
                borderRadius: '999px',
                margin: '0 auto 12px',
                flexShrink: 0,
              }}
            />

            {/* Header Modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px', flexShrink: 0 }}>
              <div>
                <h3 style={{ fontSize: '1.0625rem', fontWeight: 800, margin: '0 0 2px', color: '#0f172a' }}>
                  Atur Kategori Menu
                </h3>
                <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>
                  Geser urutan tab atau buat kategori baru
                </p>
              </div>

              <button
                type="button"
                onClick={() => setTampilModalKategori(false)}
                aria-label="Tutup"
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  background: '#f1f5f9',
                  border: 'none',
                  color: '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  minHeight: '30px',
                  minWidth: '30px',
                  padding: 0,
                }}
              >
                ✕
              </button>
            </div>

            {/* Form Tambah Kategori (Otomatis & Elegan: Tanpa Input Angka Manual) */}
            <form
              onSubmit={handleTambahKategori}
              style={{
                display: 'flex',
                gap: '8px',
                marginBottom: '16px',
                flexShrink: 0,
              }}
            >
              <div style={{ flex: 1, position: 'relative' }}>
                <input
                  type="text"
                  required
                  placeholder="Ketik nama kategori baru..."
                  value={formNamaKategori}
                  onInput={(e) => setFormNamaKategori((e.target as HTMLInputElement).value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    border: '1.5px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '0.8125rem',
                    background: '#f8fafc',
                    boxSizing: 'border-box',
                    outline: 'none',
                    fontWeight: 600,
                    color: '#0f172a',
                  }}
                />
              </div>

              <button
                type="submit"
                style={{
                  padding: '9px 14px',
                  background: '#0f172a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  minHeight: '36px',
                  minWidth: 'auto',
                  flexShrink: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span>+ Tambah</span>
              </button>
            </form>

            {/* Sub-header Urutan Kategori */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexShrink: 0 }}>
              <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                URUTAN TAB KASIR ({daftarKategori.length}):
              </span>
              <span style={{ fontSize: '0.6875rem', color: '#94a3b8' }}>
                Gunakan ▲ ▼ untuk mengubah urutan
              </span>
            </div>

            {/* Container List Kategori (Scroll Halus Tanpa Scrollbar Kasar) */}
            <div
              class="no-scrollbar"
              style={{
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                paddingRight: '2px',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
              }}
            >
              {daftarKategori.map((k, index) => {
                const menuCount = produkList.filter(({ produk }) => matchesKategori(produk, k.nama)).length;
                const isEditing = editingId === k.id;
                const isFirst = index === 0;
                const isLast = index === daftarKategori.length - 1;

                return (
                  <div
                    key={k.id}
                    draggable={!isEditing}
                    onDragStart={() => setDraggedIndex(index)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (draggedIndex !== null) {
                        handlePindahUrutan(draggedIndex, index);
                        setDraggedIndex(null);
                      }
                    }}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '10px',
                      padding: '8px 10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                      transition: 'all 0.15s ease',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                    }}
                  >
                    {/* Sisi Kiri: Tombol Reorder ▲ ▼ + Badge Nomor Urut */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <button
                          type="button"
                          disabled={isFirst}
                          onClick={() => handlePindahUrutan(index, index - 1)}
                          title="Geser ke atas"
                          style={{
                            width: '22px',
                            height: '18px',
                            padding: 0,
                            borderRadius: '4px',
                            background: isFirst ? '#f8fafc' : '#f1f5f9',
                            color: isFirst ? '#cbd5e1' : '#0f172a',
                            border: 'none',
                            fontSize: '0.625rem',
                            fontWeight: 800,
                            cursor: isFirst ? 'default' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minHeight: '18px',
                            minWidth: '22px',
                          }}
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          disabled={isLast}
                          onClick={() => handlePindahUrutan(index, index + 1)}
                          title="Geser ke bawah"
                          style={{
                            width: '22px',
                            height: '18px',
                            padding: 0,
                            borderRadius: '4px',
                            background: isLast ? '#f8fafc' : '#f1f5f9',
                            color: isLast ? '#cbd5e1' : '#0f172a',
                            border: 'none',
                            fontSize: '0.625rem',
                            fontWeight: 800,
                            cursor: isLast ? 'default' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minHeight: '18px',
                            minWidth: '22px',
                          }}
                        >
                          ▼
                        </button>
                      </div>

                      <span
                        style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '6px',
                          background: '#0f172a',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          flexShrink: 0,
                        }}
                      >
                        {index + 1}
                      </span>
                    </div>

                    {/* Sisi Tengah: Nama Kategori (Bisa Edit In-Place) */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          <input
                            type="text"
                            value={editingNama}
                            onInput={(e) => setEditingNama((e.target as HTMLInputElement).value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSimpanRename(k.id);
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                            autoFocus
                            style={{
                              flex: 1,
                              padding: '4px 6px',
                              border: '1.5px solid #2563eb',
                              borderRadius: '4px',
                              fontSize: '0.8125rem',
                              fontWeight: 600,
                              outline: 'none',
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => handleSimpanRename(k.id)}
                            style={{
                              padding: '4px 8px',
                              background: '#15803d',
                              color: '#ffffff',
                              borderRadius: '4px',
                              border: 'none',
                              fontSize: '0.6875rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              minHeight: '26px',
                              minWidth: 'auto',
                            }}
                          >
                            ✓
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            style={{
                              padding: '4px 6px',
                              background: '#f1f5f9',
                              color: '#64748b',
                              borderRadius: '4px',
                              border: 'none',
                              fontSize: '0.6875rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              minHeight: '26px',
                              minWidth: 'auto',
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div>
                          <span
                            style={{
                              fontSize: '0.8125rem',
                              fontWeight: 700,
                              color: '#0f172a',
                              display: 'block',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {k.nama}
                          </span>
                          <span style={{ fontSize: '0.6875rem', color: '#64748b' }}>
                            {menuCount} menu terdaftar
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Sisi Kanan: Tombol Edit & Hapus */}
                    {!isEditing && (
                      <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(k.id);
                            setEditingNama(k.nama);
                          }}
                          title="Ubah nama kategori"
                          style={{
                            padding: '4px 8px',
                            borderRadius: '5px',
                            border: '1px solid #cbd5e1',
                            background: '#f8fafc',
                            color: '#334155',
                            fontSize: '0.6875rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            minHeight: '26px',
                            minWidth: 'auto',
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleHapusKategori(k.id, k.nama)}
                          title="Hapus kategori"
                          style={{
                            padding: '4px 8px',
                            borderRadius: '5px',
                            border: '1px solid #fecaca',
                            background: '#ffffff',
                            color: '#dc2626',
                            fontSize: '0.6875rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            minHeight: '26px',
                            minWidth: 'auto',
                          }}
                        >
                          Hapus
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
