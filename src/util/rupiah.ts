const formatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatRupiah(amount: number): string {
  return formatter.format(amount || 0).replace('Rp', 'Rp ');
}


