import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import { cfg } from '../config.js';
import { q } from './db.js';
import { bad } from './util.js';
import { getConfig } from './moduleStore.js';

export const publicDir = path.join(cfg.uploadDir, 'public');
export const privateDir = path.join(cfg.uploadDir, 'private');
const tmpDir = path.join(os.tmpdir(), 'school-cms-uploads');
for (const dir of [publicDir, privateDir, tmpDir]) fsSync.mkdirSync(dir, { recursive: true });

// sharp is an optional native module. If a host cannot run it, uploads still work, just unoptimised.
let sharp = null;
try {
  sharp = (await import('sharp')).default;
  sharp.concurrency(1); // be polite on shared hosting
  sharp.cache(false);
} catch {
  console.warn('sharp is unavailable: images will be stored without optimisation.');
}
export const imageOptimiserAvailable = () => Boolean(sharp);

// Decides the type from the file's own bytes. The browser-supplied name and MIME type are never trusted.
function sniff(buf) {
  const hex = buf.subarray(0, 12).toString('hex');
  const ascii = buf.subarray(0, 12).toString('latin1');
  if (hex.startsWith('ffd8ff')) return { kind: 'image', mime: 'image/jpeg', ext: 'jpg' };
  if (hex.startsWith('89504e470d0a1a0a')) return { kind: 'image', mime: 'image/png', ext: 'png' };
  if (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP') return { kind: 'image', mime: 'image/webp', ext: 'webp' };
  if (ascii.startsWith('%PDF-')) return { kind: 'pdf', mime: 'application/pdf', ext: 'pdf' };
  if (hex.startsWith('00000100')) return { kind: 'icon', mime: 'image/x-icon', ext: 'ico' };
  if (ascii.slice(4, 8) === 'ftyp') return { kind: 'video', mime: 'video/mp4', ext: 'mp4' };
  if (hex.startsWith('1a45dfa3')) return { kind: 'video', mime: 'video/webm', ext: 'webm' };
  if (ascii.startsWith('ID3') || /^fff[23ab]/.test(hex)) return { kind: 'audio', mime: 'audio/mpeg', ext: 'mp3' };
  return null;
}

const PURPOSES = {
  image: { kinds: ['image'], label: 'JPG, PNG or WebP image' },
  notice: { kinds: ['image', 'pdf'], label: 'PDF, JPG, JPEG or PNG file' },
  video: { kinds: ['video'], label: 'MP4 or WebM video' },
  audio: { kinds: ['audio'], label: 'MP3 audio file' },
  logo: { kinds: ['image'], label: 'JPG, PNG or WebP image', keepPng: 512 },
  favicon: { kinds: ['image', 'icon'], label: 'PNG, JPG or ICO image', keepPng: 192 },
  document: { kinds: ['image', 'pdf'], label: 'PDF, JPG or PNG file' },
};

export async function uploader(field, maxMb) {
  return multer({ dest: tmpDir, limits: { fileSize: maxMb * 1024 * 1024, files: 1 } }).single(field);
}

const newName = (ext) => `${crypto.randomBytes(16).toString('hex')}.${ext}`;

async function readHead(file) {
  const fh = await fs.open(file, 'r');
  try {
    const { buffer } = await fh.read(Buffer.alloc(16), 0, 16, 0);
    return buffer;
  } finally {
    await fh.close();
  }
}

// Validates and optimises one uploaded temp file, then moves it into `dir`.
export async function processFile(tmpPath, purpose, dir, urlPrefix) {
  const rule = PURPOSES[purpose];
  if (!rule) throw bad('Unknown upload type.');
  const type = sniff(await readHead(tmpPath));
  if (!type || !rule.kinds.includes(type.kind)) throw bad(`Please upload a ${rule.label}.`);

  const { size: originalSize } = await fs.stat(tmpPath);
  const out = { kind: type.kind, mime: type.mime, originalSize, size: originalSize, width: null, height: null, url: null, thumb: null };

  if (type.kind === 'image' && sharp) {
    const c = await getConfig('media');
    const maxWidth = rule.keepPng || Number(c.max_image_width) || 1920;
    const quality = Number(c.image_quality) || 80;
    try {
      const base = () => sharp(tmpPath, { limitInputPixels: 80_000_000 }).rotate().resize({ width: maxWidth, height: maxWidth * 2, fit: 'inside', withoutEnlargement: true });
      // Logos stay PNG because many email clients do not show WebP. Metadata such as GPS is dropped.
      const name = newName(rule.keepPng ? 'png' : 'webp');
      const info = rule.keepPng
        ? await base().png({ compressionLevel: 9 }).toFile(path.join(dir, name))
        : await base().webp({ quality }).toFile(path.join(dir, name));
      Object.assign(out, { mime: rule.keepPng ? 'image/png' : 'image/webp', size: info.size, width: info.width, height: info.height, url: `${urlPrefix}/${name}` });
      if (!rule.keepPng) {
        const thumbName = newName('webp');
        await sharp(tmpPath, { limitInputPixels: 80_000_000 }).rotate()
          .resize({ width: Number(c.thumb_width) || 480, withoutEnlargement: true })
          .webp({ quality: Math.min(quality, 75) })
          .toFile(path.join(dir, thumbName));
        out.thumb = `${urlPrefix}/${thumbName}`;
      }
      await fs.rm(tmpPath, { force: true });
      return out;
    } catch {
      await fs.rm(tmpPath, { force: true });
      throw bad('That image could not be read. It may be damaged.');
    }
  }

  const name = newName(type.ext);
  await fs.copyFile(tmpPath, path.join(dir, name));
  await fs.rm(tmpPath, { force: true });
  out.url = `${urlPrefix}/${name}`;
  return out;
}

export async function storePublic(file, purpose, req) {
  try {
    const f = await processFile(file.path, purpose, publicDir, '/uploads');
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8').slice(0, 255);
    const r = await q(
      'INSERT INTO media (kind, url, thumb_url, original_name, mime, size, original_size, width, height, uploaded_by) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [f.kind, f.url, f.thumb, originalName, f.mime, f.size, f.originalSize, f.width, f.height, req.user?.id || null],
    );
    return { id: r.insertId, kind: f.kind, url: f.url, thumb_url: f.thumb, original_name: originalName, mime: f.mime, size: f.size, original_size: f.originalSize, width: f.width, height: f.height };
  } finally {
    await fs.rm(file.path, { force: true });
  }
}

export async function deleteStored(url) {
  if (!url || !url.startsWith('/uploads/')) return;
  await fs.rm(path.join(publicDir, path.basename(url)), { force: true });
}
