import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Generate placeholder app icons and splash images.
 *
 * These exist so the project builds end to end before a designer has supplied
 * real artwork — `eas build` fails outright on a missing icon, which is a
 * frustrating way to discover the problem twenty minutes into a build. Replace
 * every file here before shipping to a store.
 *
 * Written with only Node built-ins (zlib for the deflate stream, a hand-rolled
 * CRC-32) so the repository needs no image toolchain to bootstrap itself.
 */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let crc = -1;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** Solid-colour RGBA PNG at the given size. */
function solidPng(size, [r, g, b, a = 255]) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  // 10-12 stay zero: deflate compression, adaptive filtering, no interlace.

  // Each scanline is prefixed with a filter byte; 0 means "no filter".
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0;
    for (let x = 0; x < size; x += 1) {
      const p = rowStart + 1 + x * 4;
      raw[p] = r;
      raw[p + 1] = g;
      raw[p + 2] = b;
      raw[p + 3] = a;
    }
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const BRAND = [11, 87, 208, 255]; // #0B57D0
const LIGHT = [251, 248, 255, 255]; // surface, light
const DARK = [18, 19, 24, 255]; // surface, dark
const WHITE = [255, 255, 255, 255];

const assets = [
  // 1024 is the App Store requirement; Expo downsizes from here.
  ['icon.png', 1024, BRAND],
  ['adaptive-icon.png', 1024, BRAND],
  // Android monochrome icons are a single-colour mask; the system tints it.
  ['adaptive-icon-monochrome.png', 1024, WHITE],
  // Android notification icons must be white-on-transparent.
  ['notification-icon.png', 96, [255, 255, 255, 255]],
  ['splash.png', 512, LIGHT],
  ['splash-dark.png', 512, DARK],
  ['favicon.png', 48, BRAND],
];

const outDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'assets');
mkdirSync(outDir, { recursive: true });

for (const [name, size, colour] of assets) {
  writeFileSync(resolve(outDir, name), solidPng(size, colour));
  console.log(`  ${name} (${size}x${size})`);
}

console.log('\nPlaceholders written. Replace them with real artwork before release.');
