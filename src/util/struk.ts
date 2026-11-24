import type { PesananItem, ItemPesananDetail } from '../data/db.js';
import { formatRupiah } from './rupiah.js';
import { formatNomorAntrean } from '../data/outbox.js';
import { getProfilOutlet, type ProfilStrukOutlet } from '../data/outlet.js';
import { formatStrukWaktu } from './tanggal.js';

export function formatTeksStruk(
  pesanan: PesananItem,
  items: ItemPesananDetail[],
  namaKasir = 'Kasir',
  profilKustom?: ProfilStrukOutlet,
): string {
  const profil = profilKustom || getProfilOutlet();
  const nomorAntrean = formatNomorAntrean(pesanan.kode_perangkat, pesanan.nomor);
  const tanggalFormat = formatStrukWaktu(pesanan.waktu);

  const garisPanjang = '================================';
  const garisPutus = '--------------------------------';
  let lines: string[] = [];

  lines.push(garisPanjang);
  lines.push(`     ${(profil.namaToko || 'AYAM GORENG MITARASA').toUpperCase()}`);
  if (profil.slogan) {
    lines.push(`     ${profil.slogan}`);
  }
  if (profil.alamat) {
    lines.push(`     ${profil.alamat}`);
  }
  if (profil.telepon) {
    lines.push(`     Telp: ${profil.telepon}`);
  }
  lines.push(garisPanjang);

  lines.push(`No. Antrean : ${nomorAntrean}`);
  if (pesanan.kode_transaksi) lines.push(`ID Transaksi: ${pesanan.kode_transaksi}`);
  lines.push(`Tanggal     : ${tanggalFormat}`);
  lines.push(`Kasir       : ${namaKasir}`);
  lines.push(garisPutus);

  for (const it of items) {
    const totalTambahan = it.tambahan.reduce((sum, t) => sum + t.harga * t.qty, 0);
    const subtotal = (it.harga_satuan + totalTambahan) * it.qty;

    lines.push(`${it.qty}x ${it.nama_produk}`);
    for (const t of it.tambahan) {
      lines.push(`   + ${t.nama} (${formatRupiah(t.harga)})`);
    }
    lines.push(`   Subtotal: ${formatRupiah(subtotal)}`);
  }

  lines.push(garisPutus);
  lines.push(`TOTAL       : ${formatRupiah(pesanan.total)}`);
  lines.push(`Metode      : ${pesanan.metode.toUpperCase()}`);
  lines.push(`Bayar       : ${formatRupiah(pesanan.bayar)}`);
  lines.push(`Kembalian   : ${formatRupiah(pesanan.kembalian)}`);

  if (pesanan.catatan) {
    lines.push(`Catatan     : ${pesanan.catatan}`);
  }

  lines.push(garisPutus);
  if (profil.pesanFooter) {
    lines.push(`  ${profil.pesanFooter}`);
  }
  if (profil.instagram) {
    lines.push(`  IG: ${profil.instagram}`);
  }
  if (profil.wifiInfo) {
    lines.push(`  WiFi: ${profil.wifiInfo}`);
  }
  lines.push('  Selamat Menikmati Hidangan!');
  lines.push(garisPanjang);

  return lines.join('\n');
}

export async function bagikanStruk(
  teks: string,
  nomorAntrean: string,
): Promise<'share' | 'clipboard'> {
  if (navigator.share) {
    try {
      await navigator.share({
        title: `Struk Mitarasa - Antrean ${nomorAntrean}`,
        text: teks,
      });
      return 'share';
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return 'share';
      }
    }
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(teks);
    return 'clipboard';
  }

  return 'clipboard';
}

