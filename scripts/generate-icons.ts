/**
 * Generates the PWA app icons from the same geometry as
 * src/components/logo.tsx, so the mark never drifts between the two.
 *
 * Run with: npm run icons
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

// --- Minimal PNG encoder (avoids an image dependency for three files) -------

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    let c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typed = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));
  return Buffer.concat([len, typed, crc]);
}

type Pixel = [number, number, number, number];

function png(size: number, pixel: (x: number, y: number) => Pixel): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1);
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y);
      const o = row + 1 + x * 4;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
      raw[o + 3] = a;
    }
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// --- The mark --------------------------------------------------------------

/** Distance from a point to a segment, which yields round-capped strokes. */
function distToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

const STROKE = 11;

/** Mirrors the paths in src/components/logo.tsx. */
const SEGMENTS: Array<[number, number, number, number]> = [
  [26, 18, 50, 86], // V, left arm
  [50, 86, 74, 18], // V, right arm
  [20, 30, 80, 30], // upper bar (₹)
  [20, 50, 80, 50], // lower bar (₹)
];

const BG: [number, number, number] = [79, 70, 229]; // brand-600
const FG: [number, number, number] = [255, 255, 255];

function render(size: number, maskable: boolean): Buffer {
  // Maskable icons need a larger safe zone because launchers crop them.
  const inset = maskable ? 0.28 : 0.2;
  const span = size * (1 - inset * 2);
  const origin = size * inset;
  const radius = size * 0.22;
  const SS = 4; // supersampling for smooth edges

  return png(size, (x, y) => {
    if (!maskable) {
      const rx = Math.min(x, size - 1 - x);
      const ry = Math.min(y, size - 1 - y);
      if (rx < radius && ry < radius && Math.hypot(radius - rx, radius - ry) > radius) {
        return [0, 0, 0, 0];
      }
    }

    let hits = 0;
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const nx = ((x + (sx + 0.5) / SS - origin) / span) * 100;
        const ny = ((y + (sy + 0.5) / SS - origin) / span) * 100;
        for (const [x1, y1, x2, y2] of SEGMENTS) {
          if (distToSegment(nx, ny, x1, y1, x2, y2) <= STROKE / 2) {
            hits++;
            break;
          }
        }
      }
    }

    const t = hits / (SS * SS);
    return [
      Math.round(BG[0] + (FG[0] - BG[0]) * t),
      Math.round(BG[1] + (FG[1] - BG[1]) * t),
      Math.round(BG[2] + (FG[2] - BG[2]) * t),
      255,
    ];
  });
}

mkdirSync("public/icons", { recursive: true });
writeFileSync("public/icons/icon-192.png", render(192, false));
writeFileSync("public/icons/icon-512.png", render(512, false));
writeFileSync("public/icons/icon-maskable.png", render(512, true));
console.log("Wrote icon-192.png, icon-512.png and icon-maskable.png");
