const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { STORAGE_DIR } = require('../db');

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

function saveUpload({ file_data, mime_type, original_file_name, file_size_bytes }) {
  if (typeof file_data !== 'string') throw new Error('file_data is required.');
  if (!ALLOWED_TYPES.has(mime_type)) throw new Error('Unsupported file type. Use PDF, JPEG, PNG or WebP.');

  const match = file_data.match(/^data:([^;]+);base64,(.+)$/s);
  if (!match || match[1] !== mime_type) throw new Error('file_data must be a matching base64 data URL.');

  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length || buffer.length > MAX_FILE_SIZE) throw new Error('File must be between 1 byte and 10 MB.');
  if (file_size_bytes != null && Number(file_size_bytes) !== buffer.length) {
    throw new Error('file_size_bytes does not match the uploaded file.');
  }

  const extension = {
    'application/pdf': '.pdf',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
  }[mime_type];
  const storage_key = `${crypto.randomUUID()}${extension}`;
  fs.writeFileSync(path.join(STORAGE_DIR, storage_key), buffer, { flag: 'wx' });
  return { storage_key, file_size_bytes: buffer.length };
}

function filePath(storageKey) {
  if (!/^[a-f0-9-]+\.(pdf|jpg|png|webp)$/.test(storageKey)) throw new Error('Invalid storage key.');
  return path.join(STORAGE_DIR, storageKey);
}

module.exports = { MAX_FILE_SIZE, saveUpload, filePath };
