/**
 * Dev-only asset alpha audit for public/assets.
 * Reports dimensions, mode, alpha presence, opaque corner pixels.
 *
 * Usage: node scripts/audit-assets.mjs
 * Exit 1 if any character/object sprite has opaque near-white corners.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const ASSETS = path.join(ROOT, "public", "assets");

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (entry.name.endsWith(".png")) acc.push(full);
  }
  return acc;
}

/** Minimal PNG IHDR + optional tRNS / color type reader (no decode of pixels for jpg). */
function readPngMeta(filePath) {
  const buf = fs.readFileSync(filePath);
  if (buf.toString("ascii", 0, 8) !== "\u0089PNG\r\n\u001a\n" && buf[0] !== 0x89) {
    // fallback magic
  }
  if (buf[0] !== 0x89 || buf[1] !== 0x50) {
    return { error: "not png" };
  }
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const bitDepth = buf[24];
  const colorType = buf[25];
  const modeMap = {
    0: "Gray",
    2: "RGB",
    3: "Indexed",
    4: "Gray+Alpha",
    6: "RGBA",
  };
  const hasAlpha = colorType === 4 || colorType === 6 || colorType === 3;
  return {
    width,
    height,
    bitDepth,
    colorType,
    mode: modeMap[colorType] ?? `ct${colorType}`,
    hasAlphaChannel: hasAlpha,
  };
}

/**
 * Decode PNG to RGBA for corner sampling. Uses zlib inflate of IDAT.
 * Supports color type 6 (RGBA) and 2 (RGB) 8-bit only — enough for our pack.
 */
function decodePngRgba(filePath) {
  const buf = fs.readFileSync(filePath);
  if (buf[0] !== 0x89) throw new Error("not png");
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const colorType = buf[25];
  const bitDepth = buf[24];
  if (bitDepth !== 8 || (colorType !== 6 && colorType !== 2 && colorType !== 4)) {
    return { width, height, colorType, pixels: null, note: "unsupported for pixel audit" };
  }

  const idats = [];
  let offset = 8;
  while (offset < buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.toString("ascii", offset + 4, offset + 8);
    const data = buf.subarray(offset + 8, offset + 8 + len);
    if (type === "IDAT") idats.push(data);
    if (type === "IEND") break;
    offset += 12 + len;
  }
  const inflated = zlib.inflateSync(Buffer.concat(idats));
  const bpp = colorType === 6 ? 4 : colorType === 4 ? 2 : 3;
  const stride = width * bpp;
  const raw = Buffer.alloc(height * stride);
  let ip = 0;
  let op = 0;
  const prev = Buffer.alloc(stride);

  for (let y = 0; y < height; y++) {
    const filter = inflated[ip++];
    const row = inflated.subarray(ip, ip + stride);
    ip += stride;
    const out = Buffer.alloc(stride);
    for (let i = 0; i < stride; i++) {
      const x = row[i];
      const a = i >= bpp ? out[i - bpp] : 0;
      const b = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      let val = x;
      if (filter === 1) val = (x + a) & 255;
      else if (filter === 2) val = (x + b) & 255;
      else if (filter === 3) val = (x + Math.floor((a + b) / 2)) & 255;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        val = (x + pr) & 255;
      }
      out[i] = val;
    }
    out.copy(raw, op);
    out.copy(prev);
    op += stride;
  }

  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0, p = 0; i < width * height; i++) {
    if (colorType === 6) {
      rgba[p++] = raw[i * 4];
      rgba[p++] = raw[i * 4 + 1];
      rgba[p++] = raw[i * 4 + 2];
      rgba[p++] = raw[i * 4 + 3];
    } else if (colorType === 2) {
      rgba[p++] = raw[i * 3];
      rgba[p++] = raw[i * 3 + 1];
      rgba[p++] = raw[i * 3 + 2];
      rgba[p++] = 255;
    } else {
      const g = raw[i * 2];
      const a = raw[i * 2 + 1];
      rgba[p++] = g;
      rgba[p++] = g;
      rgba[p++] = g;
      rgba[p++] = a;
    }
  }
  return { width, height, colorType, pixels: rgba };
}

function cornerReport(decoded) {
  if (!decoded.pixels) return { corners: null, note: decoded.note };
  const { width: w, height: h, pixels } = decoded;
  const pts = [
    [0, 0],
    [w - 1, 0],
    [0, h - 1],
    [w - 1, h - 1],
  ];
  const corners = pts.map(([x, y]) => {
    const i = (y * w + x) * 4;
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const a = pixels[i + 3];
    return {
      x,
      y,
      rgba: [r, g, b, a],
      opaqueNearWhite: a > 200 && r > 240 && g > 240 && b > 240,
    };
  });
  return { corners };
}

function main() {
  const files = walk(ASSETS);
  let failures = 0;
  const rows = [];

  for (const file of files.sort()) {
    const rel = path.relative(ROOT, file).replaceAll("\\", "/");
    const meta = readPngMeta(file);
    if (meta.error) {
      rows.push({ file: rel, error: meta.error });
      continue;
    }
    let corners = null;
    let bad = false;
    const critical =
      rel.includes("/npc/") ||
      rel.includes("/player/") ||
      rel.includes("/objects/");

    if (critical) {
      try {
        const decoded = decodePngRgba(file);
        const report = cornerReport(decoded);
        corners = report.corners;
        bad = Boolean(corners?.some((c) => c.opaqueNearWhite));
      } catch (e) {
        rows.push({ file: rel, ...meta, decodeError: String(e) });
        continue;
      }
    }

    const row = {
      file: rel,
      dimensions: `${meta.width}x${meta.height}`,
      mode: meta.mode,
      hasAlpha: meta.hasAlphaChannel,
      corners,
      FAIL_white_corners: bad || undefined,
    };
    rows.push(row);
    if (bad) {
      failures += 1;
      console.error(`FAIL opaque near-white corners: ${rel}`);
    }
  }

  console.log(JSON.stringify({ count: rows.length, failures, assets: rows }, null, 2));
  if (failures > 0) {
    process.exitCode = 1;
  }
}

main();
