import { GRID, biquadDb, normalize, pinkNoise, type BandType } from "@/lib/roomtune/dsp";

/**
 * Simulated rooms for Room Tuner tests: pink noise through a made-up
 * room (and an optional EQ), as samples or a WAV file. No real recordings.
 */
export const SR = 48000;
export type Filter = [BandType, number, number, number];
/** A made-up room: a bass boom, a low-mid bump, some presence and soft treble. */
export const ROOM: Filter[] = [
  ["peak", 60, 6, 2],
  ["peak", 220, 3, 1.2],
  ["peak", 3000, 2.5, 1.5],
  ["highshelf", 9000, -3, 0.707],
];

function coeffs([type, f0, gain, Q]: Filter) {
  const A = 10 ** (gain / 40);
  const w0 = (2 * Math.PI * f0) / SR;
  const cw = Math.cos(w0);
  const al = Math.sin(w0) / (2 * Q);
  const sA = 2 * Math.sqrt(A) * al;
  let b0, b1, b2, a0, a1, a2;
  if (type === "peak") [b0, b1, b2, a0, a1, a2] = [1 + al * A, -2 * cw, 1 - al * A, 1 + al / A, -2 * cw, 1 - al / A];
  else if (type === "lowshelf")
    [b0, b1, b2, a0, a1, a2] = [A * (A + 1 - (A - 1) * cw + sA), 2 * A * (A - 1 - (A + 1) * cw), A * (A + 1 - (A - 1) * cw - sA), A + 1 + (A - 1) * cw + sA, -2 * (A - 1 + (A + 1) * cw), A + 1 + (A - 1) * cw - sA];
  else
    [b0, b1, b2, a0, a1, a2] = [A * (A + 1 + (A - 1) * cw + sA), -2 * A * (A - 1 + (A + 1) * cw), A * (A + 1 + (A - 1) * cw - sA), A + 1 - (A - 1) * cw + sA, 2 * (A - 1 - (A + 1) * cw), A + 1 - (A - 1) * cw - sA];
  return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
}

function filter(x: Float32Array, c: number[]) {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  const y = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) {
    const v = c[0] * x[i] + c[1] * x1 + c[2] * x2 - c[3] * y1 - c[4] * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}

/** A recording of pink noise in a room, with an optional EQ on top. */
export function recording({ seconds = 30, room = ROOM, eq = [] as Filter[], gain = 0.5 } = {}): Float32Array {
  const p = pinkNoise(SR);
  let x = new Float32Array(SR * seconds);
  for (let i = 0; i < x.length; i++) x[i] = p[i % p.length] * gain;
  for (const f of [...room, ...eq]) if (f[2]) x = filter(x, coeffs(f));
  return x;
}

/** The room's response on the analysis grid, normalized like `analyze`. */
export function roomLevels(room = ROOM): number[] {
  return normalize(GRID.map((f) => room.reduce((s, r) => s + biquadDb(r[0], r[1], r[2], r[3], f), 0)));
}

/** 16-bit mono WAV bytes. */
export function wav(x: Float32Array): Buffer {
  const n = x.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write("WAVEfmt ", 8); buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, x[i])) * 32767), 44 + i * 2);
  return buf;
}

/** A made-up export file in Room Tuner's own format: one 5-band setup with one round. */
export function exportFile(name = "Example speaker · Test room"): string {
  const levels = roomLevels().map((v) => Math.round(v * 100) / 100);
  return JSON.stringify({
    format: "room-tuner-setups",
    version: 1,
    exported: "2026-11-22",
    setups: {
      ex1: {
        id: "ex1",
        name,
        template: "b5",
        bands: [
          { label: "100", f: 100, type: "lowshelf", q: 0.707 },
          { label: "300", f: 300, type: "peak", q: 1.4 },
          { label: "1k", f: 1000, type: "peak", q: 1.4 },
          { label: "3k", f: 3000, type: "peak", q: 1.4 },
          { label: "10k", f: 10000, type: "highshelf", q: 0.707 },
        ],
        range: 10,
        step: 1,
        currentEq: [0, 0, 0, 0, 0],
        target: { tilt: -0.8, bass: 2, treble: 0, maxBoost: 6 },
        position: { dist: 8, height: 40, on: "tripod" },
        rounds: [{ id: "rx1", n: 1, date: 1795286058285, eqDuring: [0, 0, 0, 0, 0], mic: "phone", files: [{ name: "spot1.m4a", seconds: 30, keptPct: 100, codec: "Lossless", rec: -30, levels }] }],
        presets: [{ name: "Evening", gains: [0, 1, -1, 2, -2], date: 1795281172813, fit: false }],
        updatedAt: 1795287196159,
      },
    },
  });
}
