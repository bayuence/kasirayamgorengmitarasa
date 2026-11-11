import { signal, computed } from '@preact/signals';

export interface ItemKeranjang {
  produkId: string;
  varian: string;
  paket: string;
  harga: number;
  qty: number;
  tambahan: Array<{ nama: string; harga: number; qty: number }>;
}

// Jenis pesanan tidak lagi ditampilkan; nilai tetap dipakai agar kompatibel dengan kolom database.
export const jenisPesananSignal = signal<'makan_di_tempat' | 'bawa_pulang'>('makan_di_tempat');
export const catatanPesananSignal = signal<string>('');
export const itemKeranjangSignal = signal<ItemKeranjang[]>([]);
export const itemTerakhirDihapusSignal = signal<{
  item: ItemKeranjang;
  index: number;
} | null>(null);

export function setJenisPesanan(jenis: 'makan_di_tempat' | 'bawa_pulang') {
  jenisPesananSignal.value = jenis;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('mitarasa_last_jenis_pesanan', jenis);
  }
}

export const totalHargaSignal = computed(() => {
  return itemKeranjangSignal.value.reduce((total, item) => {
    const totalTambahan = item.tambahan.reduce(
      (sum, t) => sum + t.harga * t.qty,
      0,
    );
    return total + (item.harga + totalTambahan) * item.qty;
  }, 0);
});

export const totalQtySignal = computed(() => {
  return itemKeranjangSignal.value.reduce((sum, item) => sum + item.qty, 0);
});

export function hapusItem(produkId: string) {
  const index = itemKeranjangSignal.value.findIndex(
    (i) => i.produkId === produkId,
  );
  if (index !== -1) {
    const item = itemKeranjangSignal.value[index];
    itemTerakhirDihapusSignal.value = { item, index };
    itemKeranjangSignal.value = itemKeranjangSignal.value.filter(
      (i) => i.produkId !== produkId,
    );
  }
}

export function batalkanHapusItem() {
  if (itemTerakhirDihapusSignal.value) {
    const { item, index } = itemTerakhirDihapusSignal.value;
    const items = [...itemKeranjangSignal.value];
    items.splice(index, 0, item);
    itemKeranjangSignal.value = items;
    itemTerakhirDihapusSignal.value = null;
  }
}

export function bersihkanUndo() {
  itemTerakhirDihapusSignal.value = null;
}

export function resetKeranjang() {
  itemKeranjangSignal.value = [];
  catatanPesananSignal.value = '';
  itemTerakhirDihapusSignal.value = null;
}
