const formatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatRupiah(amount: number): string {
  return formatter.format(amount).replace('Rp', 'Rp ');
}

