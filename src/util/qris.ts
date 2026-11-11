import jsQR from 'jsqr';
import QRCode from 'qrcode';

const decodeQR: any = (jsQR as any).default || jsQR;

/**
 * Utilitas QRIS (Quick Response Code Indonesian Standard) - EMVCo Standard
 * Mengubah QRIS Statis menjadi QRIS Dinamis dengan menyuntikkan Tag 54 (Nominal)
 * dan menghitung ulang Checksum CRC16-CCITT (Tag 63).
 */

export interface ParsedQrisInfo {
  isValid: boolean;
  isStatic: boolean;
  merchantName?: string;
  merchantCity?: string;
  mcc?: string;
  currency?: string;
  rawPayload: string;
}

/**
 * Menghitung CRC16-CCITT (Polynomial 0x1021, Initial 0xFFFF)
 * Sesuai spesifikasi resmi EMVCo QR Code & Bank Indonesia QRIS
 */
export function hitungCRC16(str: string): string {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    crc ^= (code << 8) & 0xffff;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Parsing payload string QRIS (EMVCo TLV - Tag Length Value)
 */
export function parseQrisPayload(raw: string): ParsedQrisInfo {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('000201')) {
    return { isValid: false, isStatic: false, rawPayload: trimmed };
  }

  let index = 0;
  const tags: Record<string, string> = {};

  while (index < trimmed.length - 4) {
    const tag = trimmed.substring(index, index + 2);
    const lenStr = trimmed.substring(index + 2, index + 4);
    const len = parseInt(lenStr, 10);
    if (isNaN(len) || len < 0) break;

    const val = trimmed.substring(index + 4, index + 4 + len);
    tags[tag] = val;
    index = index + 4 + len;
  }

  const isStatic = tags['01'] === '11' || tags['01'] === '0211' || trimmed.includes('010211');

  return {
    isValid: true,
    isStatic,
    merchantName: tags['59'],
    merchantCity: tags['60'],
    mcc: tags['52'],
    currency: tags['53'],
    rawPayload: trimmed,
  };
}

/**
 * Mengubah QRIS Statis menjadi QRIS Dinamis dengan menyuntikkan nominal tag 54
 * dan menghitung kembali CRC16 pada tag 63.
 */
export function generateQrisDinamis(rawStaticPayload: string, nominal: number): string {
  let raw = rawStaticPayload.trim();
  if (!raw) return '';

  // 1. Potong CRC lama (biasanya 8 karakter terakhir e.g. 6304XXXX)
  const crcIndex = raw.lastIndexOf('6304');
  if (crcIndex !== -1) {
    raw = raw.substring(0, crcIndex);
  }

  // 2. Ubah Point of Initiation Method dari Statis (010211) menjadi Dinamis (010212)
  raw = raw.replace('010211', '010212');

  // 3. Format Tag 54 (Transaction Amount): Tag '54' + Length (2 digit) + Nominal (integer tanpa desimal)
  const amountStr = Math.round(nominal).toString();
  const tag54 = '54' + amountStr.length.toString().padStart(2, '0') + amountStr;

  // 4. Masukkan Tag 54 sebelum Tag 58 (Country Code '5802ID') sesuai struktur EMVCo
  const tag58Index = raw.indexOf('5802');
  if (tag58Index !== -1) {
    raw = raw.substring(0, tag58Index) + tag54 + raw.substring(tag58Index);
  } else {
    raw = raw + tag54;
  }

  // 5. Tambahkan tag CRC16 (6304) lalu hitung dan tempelkan checksum 4 digit hex
  const toCheck = raw + '6304';
  const newCrc = hitungCRC16(toCheck);
  return toCheck + newCrc;
}

/**
 * Membaca payload QRIS dari file gambar menggunakan HTML5 Canvas dan jsQR
 */
export async function decodeQrisFromImage(
  file: File,
): Promise<{ payload: string; merchantName?: string; merchantCity?: string; previewUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Gagal menginisialisasi canvas pemrosesan gambar'));
          return;
        }

        // Tentukan resolusi optimal
        let width = img.width;
        let height = img.height;
        const maxDim = 1200;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        const imgData = ctx.getImageData(0, 0, width, height);
        const code = decodeQR(imgData.data, imgData.width, imgData.height, {
          inversionAttempts: 'attemptBoth',
        });

        if (code && code.data) {
          const parsed = parseQrisPayload(code.data);
          resolve({
            payload: code.data,
            merchantName: parsed.merchantName,
            merchantCity: parsed.merchantCity,
            previewUrl: e.target?.result as string,
          });
        } else {
          reject(
            new Error(
              'Kode QR tidak terdeteksi pada gambar. Pastikan gambar QRIS fokus, tidak terpotong, dan memiliki pencahayaan cukup.',
            ),
          );
        }
      };

      img.onerror = () => {
        reject(new Error('Gagal memuat file gambar'));
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = () => {
      reject(new Error('Gagal membaca file'));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Menghasilkan Data URL gambar barcode QR Code dari teks payload
 */
export async function generateQrCodeDataUrl(payload: string): Promise<string> {
  if (!payload) return '';
  return QRCode.toDataURL(payload, {
    width: 280,
    margin: 2,
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
    errorCorrectionLevel: 'M',
  });
}
