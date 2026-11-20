/**
 * Utility kompresi gambar otomatis untuk menu kasir & QRIS
 * Memperkecil gambar kamera (3-15 MB) menjadi file WebP/JPEG ringan (~8-25 KB)
 * agar hemat kuota, tidak membebani database Supabase, dan cepat dimuat.
 */

export interface OpsiKompresiGambar {
  maxDimensi?: number; // Lebar/tinggi maksimal (default 280px)
  kualitas?: number;   // Nilai 0.1 - 1.0 (default 0.65)
  format?: 'image/webp' | 'image/jpeg';
}

export async function kompresGambar(
  sumber: File | Blob | string,
  opsi?: OpsiKompresiGambar,
): Promise<string> {
  const maxDim = opsi?.maxDimensi || 280;
  const kualitas = opsi?.kualitas ?? 0.65;
  const formatTarget = opsi?.format || 'image/webp';

  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      resolve(typeof sumber === 'string' ? sumber : '');
      return;
    }

    const img = new Image();

    const prosesCanvas = () => {
      try {
        let width = img.width;
        let height = img.height;

        if (!width || !height) {
          resolve('');
          return;
        }

        // Hitung skala aspect ratio
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve('');
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'medium';
        ctx.drawImage(img, 0, 0, width, height);

        // Prioritaskan WebP untuk kompresi maksimal (~70% lebih kecil dari JPEG)
        let dataUrl = '';
        try {
          dataUrl = canvas.toDataURL(formatTarget, kualitas);
          if (formatTarget === 'image/webp' && !dataUrl.startsWith('data:image/webp')) {
            dataUrl = canvas.toDataURL('image/jpeg', kualitas);
          }
        } catch {
          dataUrl = canvas.toDataURL('image/jpeg', 0.65);
        }

        resolve(dataUrl);
      } catch (err) {
        reject(err);
      }
    };

    img.onload = prosesCanvas;
    img.onerror = () => reject(new Error('Gagal memproses gambar'));

    if (typeof sumber === 'string') {
      img.src = sumber;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Gagal membaca file gambar'));
      reader.readAsDataURL(sumber);
    }
  });
}

/**
 * Hitung perkiraan ukuran data URL dalam KiloByte (KB)
 */
export function hitungUkuranKb(dataUrl: string): number {
  if (!dataUrl) return 0;
  const base64Length = dataUrl.length - (dataUrl.indexOf(',') + 1);
  const bytes = (base64Length * 3) / 4;
  return Math.round((bytes / 1024) * 10) / 10;
}
