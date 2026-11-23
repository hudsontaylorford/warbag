import { describe, expect, it } from "vitest";
import { GRID, analyze as analyzeAudio, deviation, eqCurve, fit, targetCurve } from "@/lib/roomtune/dsp";
import {
  TEMPLATES,
  analyze,
  cleanSetup,
  measureWidth,
  setupFromTemplate,
  setupsInFile,
  snap,
  type Round,
  type Setup,
} from "@/lib/roomtune/setup";
import { InputError } from "@/lib/errors";
import { ROOM, SR, exportFile, recording, roomLevels, type Filter } from "../support/roomtune";

const jbl = TEMPLATES.jbl7.bands;
const asSetup = (doc: ReturnType<typeof cleanSetup>): Setup => ({ ...doc, id: "s1" });
const round = (n: number, levels: number[], eqDuring: number[], extra: Partial<Round> = {}): Round => ({
  id: `r${n}`,
  n,
  date: 1795286058285 + n,
  eqDuring,
  mic: "cal",
  vol: "",
  spl: null,
  pos: null,
  files: [{ name: `r${n}.wav`, seconds: 30, keptPct: 100, codec: "WAV", rec: -30, levels }],
  ...extra,
});

describe("analysis of simulated recordings", () => {
  it("recovers a simulated room and its EQ", () => {
    const a = analyzeAudio(recording({ seconds: 30 }), SR);
    const expected = roomLevels();
    const err = (lo: number, hi: number) => Math.max(...GRID.map((f, k) => (f > lo && f <= hi ? Math.abs(a.levels[k] - expected[k]) : 0)));
    expect(err(100, 16000)).toBeLessThan(0.6);
    expect(err(35, 100)).toBeLessThan(1.2);
  });

  it("fits per-band bounds and improves the match", () => {
    const room = analyzeAudio(recording(), SR).levels;
    const T = targetCurve({ tilt: -0.8, bass: 2, treble: 0 }, GRID);
    const g = fit(GRID, room, T, jbl, { range: 12, bounds: jbl.map(() => [-3, 3]), maxBoost: 6, step: 1 });
    g.forEach((v) => expect(Math.abs(v)).toBeLessThanOrEqual(3));
    const pred = room.map((v, k) => v + eqCurve(jbl, g, GRID)[k]);
    expect(deviation(GRID, pred, T)).toBeLessThan(deviation(GRID, room, T));
  });
});

describe("rounds", () => {
  it("shows the example until Round 1, then suggests a fix", () => {
    const s = asSetup(setupFromTemplate("Test", "jbl7"));
    const ex = analyze(s, null);
    expect(ex.round).toBeNull();
    expect(ex.good).toBeNull();
    s.rounds = [round(1, roomLevels(), [0, 0, 0, 0, 0, 0, 0])];
    const a = analyze(s, null);
    expect(a.round?.n).toBe(1);
    expect(a.gains).toHaveLength(7);
    expect(a.devAfter).toBeLessThan(a.devNow);
    expect(a.followUp).toBe(false);
  });

  it("moves halfway after an EQ'd round and calls a settled round a good fit", () => {
    const s = asSetup(setupFromTemplate("Test", "jbl7"));
    s.rounds = [round(1, roomLevels(), [0, 0, 0, 0, 0, 0, 0])];
    const g1 = analyze(s, null).gains;
    // Round 2: the speaker really applied g1 on top of the room.
    const eq: Filter[] = jbl.map((b, i) => [b.type, b.f, g1[i], b.q]);
    s.rounds.push(round(2, roomLevels([...ROOM, ...eq]), g1));
    const a = analyze(s, null);
    expect(a.followUp).toBe(true);
    // A model that matches the speaker leaves little to change: within 1 dB, or close to target.
    expect(a.maxChange).toBeLessThanOrEqual(1);
    expect(a.good).toBe("within-1db");
    // Showing Round 1 again is not "latest", so no good-fit message.
    expect(analyze(s, "r1").good).toBeNull();
  });

  it("holds iPhone-mic bass to small boosts", () => {
    const s = asSetup(setupFromTemplate("Test", "jbl7"));
    s.rounds = [round(1, roomLevels([["lowshelf", 120, -10, 0.707]]), [0, 0, 0, 0, 0, 0, 0], { mic: "phone" })];
    const a = analyze(s, null);
    expect(a.lowTrust).toBe(true);
    expect(a.gains[0]).toBeLessThanOrEqual(2);
    expect(a.devLo).toBe(200);
  });

  it("measures the real band width from a flat and an EQ'd round", () => {
    const s = asSetup(setupFromTemplate("Test", "jbl7"));
    s.bands = s.bands.map((b) => (b.type === "peak" ? { ...b, q: 1.4 } : b));
    const g = [0, 2, -3, 4, -2, -5, 0];
    const real: Filter[] = jbl.map((b, i) => [b.type, b.f, g[i], b.q]); // the speaker's real Q is 3
    s.rounds = [round(1, roomLevels(), [0, 0, 0, 0, 0, 0, 0]), round(2, roomLevels([...ROOM, ...real]), g)];
    const m = measureWidth(s);
    if (typeof m === "string") throw new Error(m);
    expect(m.best).toBe(3);
    expect(m.bestMismatch).toBeLessThan(m.currentMismatch);
    expect(measureWidth({ ...s, rounds: s.rounds.slice(0, 1) })).toBe("need-rounds");
  });

  it("snaps to the step and the band's range", () => {
    const s = asSetup(setupFromTemplate("Test", "b5"));
    expect(snap(s, 3.4, 0)).toBe(3);
    expect(snap(s, 14, 0)).toBe(10);
    expect(snap({ ...s, step: 0.5 }, 3.3, 1)).toBe(3.5);
  });
});

describe("cleanSetup", () => {
  it("keeps a good setup as it is", () => {
    const doc = setupFromTemplate("Den", "jbl7");
    expect(cleanSetup(JSON.parse(JSON.stringify(doc)))).toEqual(doc);
  });

  it("refuses something with no bands", () => {
    expect(() => cleanSetup({ name: "x" })).toThrow(InputError);
    expect(() => cleanSetup("nope")).toThrow(InputError);
  });

  it("clamps, trims and fills in what's missing", () => {
    const s = cleanSetup({
      name: "  " + "n".repeat(200),
      bands: [{ f: 5, type: "weird", q: 99 }, { label: "Bass", f: 120, type: "lowshelf" }],
      range: 12,
      step: 3,
      currentEq: [40, "x"],
      target: { tilt: 5 },
      rounds: [{ n: 1, eqDuring: [0, 0], files: [{ name: "a", levels: [1, 2] }] }],
      presets: [{ gains: [1, 2, 3] }],
      extra: "<script>",
    });
    expect(s.name).toHaveLength(80);
    expect(s.bands[0]).toMatchObject({ f: 20, type: "peak", q: 10, label: "20" });
    expect([s.min, s.max, s.step]).toEqual([-12, 12, 1]);
    expect(s.currentEq).toEqual([12, 0]);
    expect(s.target.tilt).toBe(0);
    // A round with no usable spectrum is dropped rather than stored broken.
    expect(s.rounds).toEqual([]);
    expect(s.presets[0]).toMatchObject({ name: "Preset", gains: [1, 2] });
    expect(s).not.toHaveProperty("extra");
  });

  it("keeps round numbers and ids unique", () => {
    const levels = roomLevels();
    const r = { id: "same", n: 1, eqDuring: [0], files: [{ name: "a", seconds: 30, levels }] };
    const s = cleanSetup({ bands: [{ f: 1000 }], rounds: [r, r] });
    expect(s.rounds.map((x) => x.n)).toEqual([1, 2]);
    expect(new Set(s.rounds.map((x) => x.id)).size).toBe(2);
  });

  it("turns an older single-spectrum round into one recording", () => {
    const s = cleanSetup({ bands: [{ f: 1000 }], rounds: [{ n: 1, eqDuring: [0], levels: roomLevels() }] });
    expect(s.rounds[0].files).toHaveLength(1);
    expect(s.rounds[0].files[0].name).toBe("Earlier recordings");
  });
});

describe("setupsInFile", () => {
  it("reads Room Tuner's export format", () => {
    const list = setupsInFile(exportFile());
    expect(list).toHaveLength(1);
    const s = cleanSetup(list[0]);
    expect(s.name).toBe("Example speaker · Test room");
    expect(s.rounds).toHaveLength(1);
    expect(s.presets[0].name).toBe("Evening");
    expect([s.min, s.max]).toEqual([-10, 10]);
  });

  it("reads a list or a single setup too", () => {
    const one = JSON.parse(exportFile()).setups.ex1;
    expect(setupsInFile(JSON.stringify([one, one]))).toHaveLength(2);
    expect(setupsInFile(JSON.stringify(one))).toHaveLength(1);
  });

  it("explains a file that isn't an export", () => {
    expect(() => setupsInFile("not json")).toThrow(/isn't a Room Tuner export/);
    expect(() => setupsInFile("{}")).toThrow(/No setups/);
  });
});
