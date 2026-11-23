import { describe, expect, it } from "vitest";
import {
  AnalysisError,
  GRID,
  analyze,
  biquadDb,
  deviation,
  eqCurve,
  fft,
  fit,
  pinkNoise,
  targetCurve,
  type Band,
} from "@/lib/roomtune/dsp";

/** Small seeded generator so noise-based tests are repeatable. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const graphic10: Band[] = [31, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000].map((f) => ({
  label: String(f),
  f,
  type: "peak",
  q: 1.4,
}));

describe("fft", () => {
  it("puts a pure tone in its bin", () => {
    const n = 1024;
    const re = new Float64Array(n);
    const im = new Float64Array(n);
    for (let i = 0; i < n; i++) re[i] = Math.cos((2 * Math.PI * 37 * i) / n);
    fft(re, im);
    const mag = Array.from({ length: n / 2 }, (_, k) => Math.hypot(re[k], im[k]));
    expect(mag.indexOf(Math.max(...mag))).toBe(37);
    expect(mag[37]).toBeCloseTo(n / 2, 6);
  });
});

describe("GRID", () => {
  it("runs 1/6 octave from about 31 Hz to 16 kHz through 1 kHz", () => {
    expect(GRID).toHaveLength(55);
    expect(GRID[0]).toBeCloseTo(31.25, 2);
    expect(GRID[30]).toBe(1000);
    expect(GRID[54]).toBeCloseTo(16000, 0);
  });
});

describe("pink noise and analysis", () => {
  const sr = 48000;
  const noise = pinkNoise(sr, 1 << 18, 0.1, seeded(1));

  it("has the requested level", () => {
    const rms = Math.sqrt(noise.reduce((s, v) => s + v * v, 0) / noise.length);
    expect(rms).toBeCloseTo(0.1, 6);
  });

  it("analyzes as flat, because pink noise has equal energy per octave", () => {
    const a = analyze(noise, sr);
    expect(a.kept).toBe(a.total);
    GRID.forEach((f, i) => {
      // Low bands hold only a few FFT bins, so they wander more.
      if (f >= 250 && f <= 16000) expect(Math.abs(a.levels[i])).toBeLessThan(0.75);
      else if (f >= 63) expect(Math.abs(a.levels[i])).toBeLessThan(2);
    });
  });

  it("sees an EQ'd recording's shape", () => {
    // A 6 dB step in level above 1 kHz: filter in the frequency domain.
    const n = noise.length;
    const re = Float64Array.from(noise);
    const im = new Float64Array(n);
    fft(re, im);
    for (let k = 1; k < n; k++) {
      const f = (Math.min(k, n - k) * sr) / n;
      if (f > 1000) {
        re[k] *= 2;
        im[k] *= 2;
      }
    }
    // Inverse via conj-FFT-conj.
    for (let k = 0; k < n; k++) im[k] = -im[k];
    fft(re, im);
    const shaped = Float32Array.from(re, (v) => v / n);
    const a = analyze(shaped, sr);
    const at = (hz: number) => a.levels[GRID.findIndex((f) => f >= hz)];
    expect(at(4000) - at(250)).toBeGreaterThan(5);
    expect(at(4000) - at(250)).toBeLessThan(7);
  });

  it("refuses recordings that are too short or silent", () => {
    expect(() => analyze(new Float32Array(20000), sr)).toThrow(AnalysisError);
    try {
      analyze(new Float32Array(sr * 5), sr);
      throw new Error("expected a throw");
    } catch (e) {
      expect((e as AnalysisError).code).toBe("silent");
    }
  });
});

describe("biquadDb", () => {
  it("is 0 dB with no gain", () => {
    expect(biquadDb("peak", 1000, 0, 1.4, 1000)).toBe(0);
  });

  it("gives a peak its full gain at its center and little far away", () => {
    expect(biquadDb("peak", 1000, 6, 1.4, 1000)).toBeCloseTo(6, 6);
    expect(Math.abs(biquadDb("peak", 1000, 6, 1.4, 100))).toBeLessThan(0.2);
  });

  it("moves everything below a low shelf and above a high shelf", () => {
    expect(biquadDb("lowshelf", 150, -4, 0.707, 40)).toBeCloseTo(-4, 0);
    expect(Math.abs(biquadDb("lowshelf", 150, -4, 0.707, 4000))).toBeLessThan(0.1);
    expect(biquadDb("highshelf", 6500, 3, 0.707, 16000)).toBeCloseTo(3, 0);
  });
});

describe("fit", () => {
  const flat = { tilt: 0, bass: 0, treble: 0 };

  it("undoes a room that is a known EQ", () => {
    const applied = [0, 0, 3, -4, 0, 2, 0, -3, 0, 0];
    const room = eqCurve(graphic10, applied, GRID);
    const target = targetCurve(flat, GRID);
    const g = fit(GRID, room, target, graphic10, { range: 12, maxBoost: 12, step: 0.5 });
    // The middle bands are weighted fully; they should come back close to the opposite.
    for (let i = 2; i <= 7; i++) expect(Math.abs(g[i] + applied[i])).toBeLessThanOrEqual(1);
    const after = room.map((v, k) => v + eqCurve(graphic10, g, GRID)[k]);
    expect(deviation(GRID, after, target)).toBeLessThan(deviation(GRID, room, target) / 3);
  });

  it("keeps to the app's range, the boost cap and the step", () => {
    const room = GRID.map((f) => (f > 2000 ? -15 : 0));
    const g = fit(GRID, room, targetCurve(flat, GRID), graphic10, { range: 12, maxBoost: 4, step: 1 });
    for (const v of g) {
      expect(v).toBeLessThanOrEqual(4);
      expect(v).toBeGreaterThanOrEqual(-12);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it("holds the bass band to small boosts for an iPhone mic", () => {
    const room = GRID.map((f) => (f < 120 ? -10 : 0));
    const g = fit(GRID, room, targetCurve(flat, GRID), graphic10, { range: 12, maxBoost: 12, lowTrust: true });
    expect(g[0]).toBeLessThanOrEqual(2);
    expect(g[1]).toBeLessThanOrEqual(2);
    expect(g[2]).toBeLessThanOrEqual(2);
  });
});

describe("deviation", () => {
  it("ignores a constant level offset", () => {
    const t = targetCurve({ tilt: -0.8, bass: 2, treble: 0 }, GRID);
    expect(deviation(GRID, t.map((v) => v + 5), t)).toBeCloseTo(0, 10);
  });
});
