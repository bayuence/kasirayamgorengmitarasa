import type { PesananItem, ItemPesananDetail } from '../data/db.js';
import { formatRupiah } from './rupiah.js';
import { formatNomorAntrean } from '../data/outbox.js';

export function formatTeksStruk(
  pesanan: PesananItem,
  items: ItemPesananDetail[],
  namaKasir = 'Kasir',
): string {
  const nomorAntrean = formatNomorAntrean(pesanan.kode_perangkat, pesanan.nomor);
  const tanggalFormat = new Date(pesanan.waktu).toLocaleString('id-ID', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  let lines: string[] = [];
  lines.push('================================');
  lines.push('     AYAM GORENG MITARASA');
  lines.push('================================');
  lines.push(`No. Antrean : ${nomorAntrean}`);
  lines.push(`Tanggal     : ${tanggalFormat}`);
  lines.push(`Kasir       : ${namaKasir}`);
  lines.push('--------------------------------');

  for (const it of items) {
    const totalTambahan = it.tambahan.reduce((sum, t) => sum + t.harga * t.qty, 0);
    const subtotal = (it.harga_satuan + totalTambahan) * it.qty;

    lines.push(`${it.qty}x ${it.nama_produk}`);
    lines.push(`   ${formatRupiah(subtotal)}`);
    for (const t of it.tambahan) {
      lines.push(`   + ${t.nama} (${formatRupiah(t.harga)})`);
    }
  }

  lines.push('--------------------------------');
  lines.push(`Total       : ${formatRupiah(pesanan.total)}`);
  lines.push(`Metode      : ${pesanan.metode.toUpperCase()}`);
  lines.push(`Bayar       : ${formatRupiah(pesanan.bayar)}`);
  lines.push(`Kembalian   : ${formatRupiah(pesanan.kembalian)}`);

  if (pesanan.catatan) {
    lines.push(`Catatan     : ${pesanan.catatan}`);
  }

  lines.push('--------------------------------');
  lines.push('     Terima Kasih Banyak!');
  lines.push('  Selamat Menikmati Hidangan');
  lines.push('================================');

  return lines.join('\n');
}

export async function bagikanStruk(
  teks: string,
  nomorAntrean: string,
): Promise<'share' | 'clipboard'> {
  if (navigator.share) {
    try {
      await navigator.share({
        title: `Struk Kasir Mitarasa - ${nomorAntrean}`,
        text: teks,
      });
      return 'share';
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return 'share';
      }
      // Fallback ke clipboard jika share gagal
    }
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(teks);
    return 'clipboard';
  }

  return 'clipboard';
}

