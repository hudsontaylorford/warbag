/**
 * Room Tuner sound analysis. Pure functions, no browser or server APIs, so
 * the same code runs in the page and in tests.
 *
 * Ported from the standalone Room Tuner (dsp.js) without changing the math.
 */

export type BandType = "lowshelf" | "peak" | "highshelf";

export type Band = {
  label: string;
  /** Center or corner frequency in Hz. */
  f: number;
  type: BandType;
  q: number;
};

export type Target = { tilt: number; bass: number; treble: number };

export type FitOptions = {
  /** Largest cut or boost the app allows, in dB (used when `bounds` is absent). */
  range: number;
  /** Cap on any boost, in dB. */
  maxBoost: number;
  /** Per-band [lowest, highest] in dB, overrides `range`. */
  bounds?: [number, number][];
  /** Round results to this dB step. */
  step?: number;
  /** iPhone mic: trust the deep bass less and hold the bass band to small boosts. */
  lowTrust?: boolean;
};

export type Analysis = {
  /** Level per GRID frequency, in dB, normalized to 0 over 250 Hz to 2 kHz. */
  levels: number[];
  kept: number;
  total: number;
  seconds: number;
  peakDb: number;
  medDb: number;
};

const tables: Record<number, { c: Float64Array; s: Float64Array }> = {};

function trig(n: number) {
  if (!tables[n]) {
    const c = new Float64Array(n / 2);
    const s = new Float64Array(n / 2);
    for (let k = 0; k < n / 2; k++) {
      c[k] = Math.cos((2 * Math.PI * k) / n);
      s[k] = Math.sin((2 * Math.PI * k) / n);
    }
    tables[n] = { c, s };
  }
  return tables[n];
}

/** In-place radix-2 FFT (forward, e^{-j}). Length must be a power of 2. */
export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  const { c, s } = trig(n);
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i];
      re[i] = re[j];
      re[j] = t;
      t = im[i];
      im[i] = im[j];
      im[j] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1;
    const step = n / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < half; k++) {
        const a = i + k;
        const b = a + half;
        const wr = c[k * step];
        const wi = -s[k * step];
        const xr = re[b] * wr - im[b] * wi;
        const xi = re[b] * wi + im[b] * wr;
        re[b] = re[a] - xr;
        im[b] = im[a] - xi;
        re[a] += xr;
        im[a] += xi;
      }
    }
  }
}

/** Periodic pink noise, 20 Hz to 20 kHz, exact -3 dB/octave, at the given RMS. */
export function pinkNoise(sr: number, n = 1 << 18, rms = 0.1, random = Math.random): Float32Array {
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let k = 1; k < n / 2; k++) {
    const f = (k * sr) / n;
    if (f < 20 || f > 20000) continue;
    const m = 1 / Math.sqrt(f);
    const p = random() * 2 * Math.PI;
    re[k] = m * Math.cos(p);
    im[k] = m * Math.sin(p);
    re[n - k] = re[k];
    im[n - k] = -im[k];
  }
  fft(re, im); // real-symmetric spectrum -> real signal (time-reversed, irrelevant for noise)
  let sum = 0;
  for (let i = 0; i < n; i++) sum += re[i] * re[i];
  const g = rms / Math.sqrt(sum / n);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = re[i] * g;
  return out;
}

/** 1/6-octave grid, 31 Hz to 16 kHz. */
export const GRID: readonly number[] = Array.from({ length: 55 }, (_, i) => 1000 * Math.pow(2, (i - 30) / 6));

export class AnalysisError extends Error {
  constructor(public code: "too_short" | "silent") {
    super(code);
  }
}

/** Long-term spectrum of a recording of pink noise, skipping frames whose level jumps. */
export function analyze(x: Float32Array | Float64Array, sr: number): Analysis {
  const N = 16384;
  const hop = N / 2;
  const skip = Math.floor(1.5 * sr);
  const start = x.length > 2 * skip + 4 * N ? skip : 0;
  const end = x.length - start;
  const frames: { i: number; db: number }[] = [];
  for (let i = start; i + N <= end; i += hop) {
    let s = 0;
    for (let j = 0; j < N; j++) s += x[i + j] * x[i + j];
    frames.push({ i, db: 10 * Math.log10(s / N + 1e-20) });
  }
  if (frames.length < 4) throw new AnalysisError("too_short");
  const sorted = frames.map((f) => f.db).sort((a, b) => a - b);
  const med = sorted[sorted.length >> 1];
  if (med < -85) throw new AnalysisError("silent");
  const kept = frames.filter((f) => Math.abs(f.db - med) <= 4);
  const win = new Float64Array(N);
  for (let j = 0; j < N; j++) win[j] = 0.5 - 0.5 * Math.cos((2 * Math.PI * j) / N);
  const P = new Float64Array(N / 2);
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  for (const f of kept) {
    for (let j = 0; j < N; j++) {
      re[j] = x[f.i + j] * win[j];
      im[j] = 0;
    }
    fft(re, im);
    for (let k = 0; k < N / 2; k++) P[k] += re[k] * re[k] + im[k] * im[k];
  }
  const bin = sr / N;
  const levels: number[] = [];
  for (const fc of GRID) {
    const lo = fc * Math.pow(2, -1 / 12);
    const hi = fc * Math.pow(2, 1 / 12);
    let s = 0;
    let c = 0;
    for (let k = Math.ceil(lo / bin); k < hi / bin && k < N / 2; k++) {
      s += P[k];
      c++;
    }
    if (!c) {
      const k = Math.min(N / 2 - 1, Math.round(fc / bin));
      s = P[k];
      c = 1;
    }
    levels.push(10 * Math.log10((s / c) * (hi - lo) + 1e-30));
  }
  return {
    levels: normalize(levels),
    kept: kept.length,
    total: frames.length,
    seconds: x.length / sr,
    peakDb: sorted[sorted.length - 1],
    medDb: med,
  };
}

/** Shift levels so 250 Hz to 2 kHz averages 0 dB. */
export function normalize(levels: number[]): number[] {
  let s = 0;
  let c = 0;
  GRID.forEach((f, i) => {
    if (f >= 250 && f <= 2000) {
      s += levels[i];
      c++;
    }
  });
  return levels.map((v) => v - s / c);
}

export function smooth(v: number[]): number[] {
  return v.map((x, i) => {
    const a = v[Math.max(0, i - 1)];
    const b = v[Math.min(v.length - 1, i + 1)];
    return 0.25 * a + 0.5 * x + 0.25 * b;
  });
}

/** RBJ biquad magnitude in dB at frequency f. */
export function biquadDb(type: BandType, f0: number, gain: number, Q: number, f: number, fs = 48000): number {
  if (!gain) return 0;
  const A = Math.pow(10, gain / 40);
  const w0 = (2 * Math.PI * f0) / fs;
  const cw = Math.cos(w0);
  const al = Math.sin(w0) / (2 * Q);
  const sA = 2 * Math.sqrt(A) * al;
  let b0: number, b1: number, b2: number, a0: number, a1: number, a2: number;
  if (type === "peak") {
    b0 = 1 + al * A;
    b1 = -2 * cw;
    b2 = 1 - al * A;
    a0 = 1 + al / A;
    a1 = -2 * cw;
    a2 = 1 - al / A;
  } else if (type === "lowshelf") {
    b0 = A * (A + 1 - (A - 1) * cw + sA);
    b1 = 2 * A * (A - 1 - (A + 1) * cw);
    b2 = A * (A + 1 - (A - 1) * cw - sA);
    a0 = A + 1 + (A - 1) * cw + sA;
    a1 = -2 * (A - 1 + (A + 1) * cw);
    a2 = A + 1 + (A - 1) * cw - sA;
  } else {
    b0 = A * (A + 1 + (A - 1) * cw + sA);
    b1 = -2 * A * (A - 1 + (A + 1) * cw);
    b2 = A * (A + 1 + (A - 1) * cw - sA);
    a0 = A + 1 - (A - 1) * cw + sA;
    a1 = 2 * (A - 1 - (A + 1) * cw);
    a2 = A + 1 - (A - 1) * cw - sA;
  }
  const w = (2 * Math.PI * f) / fs;
  const c1 = Math.cos(w);
  const s1 = Math.sin(w);
  const c2 = Math.cos(2 * w);
  const s2 = Math.sin(2 * w);
  const nr = b0 + b1 * c1 + b2 * c2;
  const ni = -(b1 * s1 + b2 * s2);
  const dr = a0 + a1 * c1 + a2 * c2;
  const di = -(a1 * s1 + a2 * s2);
  return 10 * Math.log10((nr * nr + ni * ni) / (dr * dr + di * di));
}

/** Combined response of every band at its gain, in dB, at each frequency. */
export function eqCurve(bands: Band[], gains: number[], freqs: readonly number[]): number[] {
  return freqs.map((f) => bands.reduce((s, b, i) => s + biquadDb(b.type, b.f, gains[i] || 0, b.q, f), 0));
}

export function targetCurve(t: Target, freqs: readonly number[]): number[] {
  return freqs.map(
    (f) =>
      t.tilt * Math.log2(f / 1000) +
      biquadDb("lowshelf", 105, t.bass, 0.707, f) +
      biquadDb("highshelf", 6000, t.treble, 0.707, f),
  );
}

function weight(f: number): number {
  if (f < 35 || f > 14000) return 0;
  if (f < 50) return 0.25;
  if (f < 90) return 0.6;
  if (f > 10000) return 0.5;
  return 1;
}

/**
 * Band gains so that room + EQ follows the target. Deep narrow dips count
 * for less (EQ can't fill them), boosts are capped and results are rounded
 * to the app's step.
 */
export function fit(
  freqs: readonly number[],
  room: number[],
  target: number[],
  bands: Band[],
  opt: FitOptions,
): number[] {
  const n = bands.length;
  const K = freqs.length;
  const A = bands.map((b) => freqs.map((f) => biquadDb(b.type, b.f, 6, b.q, f) / 6));
  const wide = room.map((_, k) => {
    let s = 0;
    let c = 0;
    for (let j = Math.max(0, k - 6); j <= Math.min(K - 1, k + 6); j++) {
      s += room[j];
      c++;
    }
    return s / c;
  });
  const w = freqs.map(
    (f, k) => weight(f) * (room[k] < wide[k] - 3 ? 0.3 : 1) * (opt.lowTrust && f < 150 ? 0.2 : 1),
  );
  const W = w.reduce((a, b) => a + b, 0);
  const lam = (0.04 * W) / n;
  const g = new Array<number>(n).fill(0);
  let c = 0;
  const Bd = bands.map((b, i): [number, number] => {
    const lo = opt.bounds ? opt.bounds[i][0] : -opt.range;
    let hi = Math.min(opt.bounds ? opt.bounds[i][1] : opt.range, opt.maxBoost);
    if (opt.lowTrust && b.f <= 160) hi = Math.min(hi, 2);
    return [lo, Math.max(lo, hi)];
  });
  const pred = (k: number) => room[k] + c + g.reduce((s, gi, i) => s + gi * A[i][k], 0) - target[k];
  for (let it = 0; it < 400; it++) {
    let s = 0;
    for (let k = 0; k < K; k++) s += w[k] * (pred(k) - c);
    c = -s / W;
    for (let i = 0; i < n; i++) {
      let num = 0;
      let den = lam;
      for (let k = 0; k < K; k++) {
        if (!w[k]) continue;
        const r = pred(k) - g[i] * A[i][k];
        num += w[k] * A[i][k] * r;
        den += w[k] * A[i][k] * A[i][k];
      }
      g[i] = Math.max(Bd[i][0], Math.min(Bd[i][1], -num / den));
    }
  }
  const step = opt.step || 1;
  return g.map((v, i) => {
    const r = Math.round(v / step) * step;
    return +Math.max(Bd[i][0], Math.min(Bd[i][1], r)).toFixed(2) || 0;
  });
}

/** RMS deviation from target over `lo` Hz to 10 kHz, after removing the level offset. */
export function deviation(freqs: readonly number[], curve: number[], target: number[], lo = 100): number {
  const d: number[] = [];
  freqs.forEach((f, k) => {
    if (f >= lo && f <= 10000) d.push(curve[k] - target[k]);
  });
  const m = d.reduce((a, b) => a + b, 0) / d.length;
  return Math.sqrt(d.reduce((a, b) => a + (b - m) * (b - m), 0) / d.length);
}
