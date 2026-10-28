// লোগো-ফাইল → ছোট স্কোয়ার data-URL (ফোনেই)। মাঝখান থেকে স্কোয়ার ক্রপ, ~৯৬px WebP (≈১০KB);
// বড় হলে ধাপে ছোট। firestore.rules-এর সীমা (≤৪০০০০ অক্ষর) থেকে নিরাপদ দূরত্বে (≤৩০০০০) রাখা।
import { safeLogo } from '../../../validation/investmentCompanySchema';

const MAX_INPUT_BYTES = 15 * 1024 * 1024;
const TARGET_CHARS = 30000;
const ATTEMPTS: readonly (readonly [number, number])[] = [
  [96, 0.8],
  [96, 0.6],
  [72, 0.6],
  [56, 0.5],
];

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('bad-image'));
    img.src = url;
  });
}

export type LogoError = 'not-image' | 'too-big' | 'bad-image' | 'too-large';

export async function fileToLogoDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('not-image' satisfies LogoError);
  if (file.size > MAX_INPUT_BYTES) throw new Error('too-big' satisfies LogoError);
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    if (!side) throw new Error('bad-image' satisfies LogoError);
    const sx = (img.naturalWidth - side) / 2;
    const sy = (img.naturalHeight - side) / 2;
    for (const [px, quality] of ATTEMPTS) {
      const canvas = document.createElement('canvas');
      canvas.width = px;
      canvas.height = px;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('bad-image' satisfies LogoError);
      ctx.fillStyle = '#ffffff'; // স্বচ্ছ ব্যাকগ্রাউন্ড ডার্ক মোডে মিশে না যেতে
      ctx.fillRect(0, 0, px, px);
      ctx.drawImage(img, sx, sy, side, side, 0, 0, px, px);
      const out = canvas.toDataURL('image/webp', quality);
      if (out.length <= TARGET_CHARS && safeLogo(out) !== null) return out;
    }
    throw new Error('too-large' satisfies LogoError);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function logoErrorMessage(e: unknown): string {
  switch (e instanceof Error ? e.message : '') {
    case 'not-image':
      return 'Please choose an image file.';
    case 'too-big':
      return 'Image is too large (max 15 MB).';
    case 'too-large':
      return 'Could not shrink this image enough. Try a simpler one.';
    default:
      return 'Could not read this image.';
  }
}
