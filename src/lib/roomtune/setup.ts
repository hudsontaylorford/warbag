/**
 * Room Tuner's data model: one Setup per speaker and room, holding its EQ
 * layout, rounds of measurements and saved presets. Pure code, shared by
 * the page and the server. The server runs every saved or imported setup
 * through `cleanSetup`, so nothing malformed is stored.
 *
 * Raw audio is never kept: each recording becomes 55 numbers (its level on
 * the 1/6-octave GRID).
 */
import { InputError } from "../errors";
import { GRID, deviation, eqCurve, fit, normalize, smooth, targetCurve, biquadDb, type Band, type BandType } from "./dsp";

export type SetupBand = Band & {
  /** The subwoofer level control, modeled as a low shelf at the crossover. */
  sub?: boolean;
  /** Per-band range in dB, overriding the setup's. */
  min?: number;
  max?: number;
};

export type Mic = "phone" | "app" | "cal";

export type Position = { dist: number | null; height: number | null; on: string };

export type RoundFile = {
  name: string;
  seconds: number;
  keptPct: number;
  codec: string;
  /** Median recording level in dBFS. */
  rec: number | null;
  levels: number[];
};

export type Round = {
  id: string;
  n: number;
  date: number;
  /** The EQ that was on the speaker while recording. */
  eqDuring: number[];
  mic: Mic;
  vol: string;
  spl: number | null;
  pos: Position | null;
  files: RoundFile[];
};

export type TargetSettings = { tilt: number; bass: number; treble: number; maxBoost: number };

export type Preset = { name: string; gains: number[]; date: number; fit: boolean };

export type Setup = {
  id: string;
  name: string;
  bands: SetupBand[];
  min: number;
  max: number;
  step: number;
  notes: string;
  /** What is on the speaker now. */
  currentEq: number[];
  target: TargetSettings;
  position: Position;
  lastLevel: { vol: string; spl: number | null };
  rounds: Round[];
  presets: Preset[];
};

/** The parts of a setup the person edits; the server keeps id and timestamps. */
export type SetupDoc = Omit<Setup, "id">;

export const DEFAULT_TARGET: TargetSettings = { tilt: -0.8, bass: 2, treble: 0, maxBoost: 6 };
export const KINDS: Record<BandType, string> = { lowshelf: "Bass shelf", peak: "Peak", highshelf: "Treble shelf" };
export const MIC_LABELS: Record<Mic, string> = {
  phone: "iPhone mic (Voice Memos)",
  app: "Measurement app with mic correction",
  cal: "Calibrated measurement mic",
};
export const STEPS = [0.5, 1, 2] as const;
/** Band width choices for peak bands: Q values and what they mean. */
export const WIDTHS = [
  { q: 3, label: "Narrow, each slider covers about ½ octave" },
  { q: 1.4, label: "Medium, about 1 octave" },
  { q: 0.8, label: "Wide, about 2 octaves" },
] as const;
export const widthName = (q: number) => (q >= 2.5 ? "narrow" : q >= 1.2 ? "medium" : "wide");

type Template = { label: string; range: number; step: number; bands: SetupBand[] };

export const TEMPLATES: Record<string, Template> = {
  jbl7: {
    label: "JBL One app · 7 bands, ±12 dB",
    range: 12,
    step: 1,
    // Peak width (Q 3) measured on a JBL Authentics 500: flat vs EQ'd rounds.
    bands: [
      { label: "≤125", f: 150, type: "lowshelf", q: 0.707 },
      { label: "250", f: 250, type: "peak", q: 3 },
      { label: "500", f: 500, type: "peak", q: 3 },
      { label: "1k", f: 1000, type: "peak", q: 3 },
      { label: "2k", f: 2000, type: "peak", q: 3 },
      { label: "4k", f: 4000, type: "peak", q: 3 },
      { label: "≥8k", f: 6500, type: "highshelf", q: 0.707 },
    ],
  },
  g10: {
    label: "10-band graphic EQ, ±12 dB",
    range: 12,
    step: 1,
    bands: [31, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000].map((f) => ({
      label: f >= 1000 ? `${f / 1000}k` : String(f),
      f,
      type: "peak" as const,
      q: 1.4,
    })),
  },
  b5: {
    label: "5-band EQ, ±10 dB",
    range: 10,
    step: 1,
    bands: [
      { label: "100", f: 100, type: "lowshelf", q: 0.707 },
      { label: "300", f: 300, type: "peak", q: 1.4 },
      { label: "1k", f: 1000, type: "peak", q: 1.4 },
      { label: "3k", f: 3000, type: "peak", q: 1.4 },
      { label: "10k", f: 10000, type: "highshelf", q: 0.707 },
    ],
  },
  bt: {
    label: "Bass and treble only, ±10 dB",
    range: 10,
    step: 1,
    bands: [
      { label: "Bass", f: 120, type: "lowshelf", q: 0.707 },
      { label: "Treble", f: 6000, type: "highshelf", q: 0.707 },
    ],
  },
  bmt: {
    label: "Bass, mid and treble, ±10 dB",
    range: 10,
    step: 1,
    bands: [
      { label: "Bass", f: 120, type: "lowshelf", q: 0.707 },
      { label: "Mid", f: 1000, type: "peak", q: 0.7 },
      { label: "Treble", f: 6000, type: "highshelf", q: 0.707 },
    ],
  },
  custom: { label: "Blank, I'll enter the bands", range: 10, step: 1, bands: [] },
};

// ------------------------------------------------------------ small helpers

export const lowOf = (s: Pick<Setup, "bands" | "min">, i: number) => s.bands[i].min ?? s.min;
export const highOf = (s: Pick<Setup, "bands" | "max">, i: number) => s.bands[i].max ?? s.max;
export const boundsOf = (s: Pick<Setup, "bands" | "min" | "max">): [number, number][] =>
  s.bands.map((_, i) => [lowOf(s, i), highOf(s, i)]);

/** Rounds a value to the setup's step and clamps it to the band's range. */
export function snap(s: Pick<Setup, "bands" | "min" | "max" | "step">, v: number, i: number): number {
  const step = s.step || 1;
  return +Math.max(lowOf(s, i), Math.min(highOf(s, i), Math.round(v / step) * step)).toFixed(2) || 0;
}

/** "+3", "−2", "0" with a real minus sign. */
export const fmtDb = (v: number) => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v);
export const fmtDb1 = (v: number) => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(1);
export const fmtHz = (f: number) => (f >= 1000 ? `${+(f / 1000).toFixed(1)}k` : String(Math.round(f)));

/** "≤125", "1k", "≥8k": the label a band gets when nobody typed one. */
export const autoLabel = (f: number, type: BandType) =>
  f ? (type === "lowshelf" ? "≤" : type === "highshelf" ? "≥" : "") + fmtHz(f) : "";

export const eqText = (s: Pick<Setup, "bands">, g: number[]) =>
  g.every((v) => !v) ? "all at 0" : g.map((v, i) => `${s.bands[i]?.label ?? i + 1} ${fmtDb(v)}`).join(", ");

export function latestRound(s: Pick<Setup, "rounds">): Round | null {
  return s.rounds.reduce<Round | null>((a, r) => (!a || r.n > a.n ? r : a), null);
}

export function prevRound(s: Pick<Setup, "rounds">, r: Round): Round | null {
  return s.rounds.filter((x) => x.n < r.n).reduce<Round | null>((a, x) => (!a || x.n > a.n ? x : a), null);
}

/** A round's spectrum: its recordings averaged, weighted by length. */
export function roundLevels(r: Pick<Round, "files">): number[] {
  const w = (f: RoundFile) => Math.max(1, f.seconds || 1);
  const W = r.files.reduce((a, f) => a + w(f), 0);
  return GRID.map((_, k) => r.files.reduce((a, f) => a + f.levels[k] * w(f), 0) / W);
}

/** Median recording level of a round in dBFS, or null if unknown. */
export function roundRecLevel(r: Pick<Round, "files">): number | null {
  const fs = r.files.filter((f) => f.rec != null);
  return fs.length ? fs.reduce((a, f) => a + (f.rec ?? 0), 0) / fs.length : null;
}

export const newId = (prefix: string) => prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export function setupFromTemplate(name: string, key: keyof typeof TEMPLATES): SetupDoc {
  const t = TEMPLATES[key];
  return blankSetup(name, t.bands.map((b) => ({ ...b })), -t.range, t.range, t.step);
}

export function blankSetup(name: string, bands: SetupBand[], min: number, max: number, step: number, notes = ""): SetupDoc {
  return {
    name,
    bands,
    min,
    max,
    step,
    notes,
    currentEq: bands.map(() => 0),
    target: { ...DEFAULT_TARGET },
    position: { dist: null, height: null, on: "" },
    lastLevel: { vol: "", spl: null },
    rounds: [],
    presets: [],
  };
}

// ------------------------------------------------------------ analysis

/** A made-up room, so a new setup shows how the result looks before Round 1. */
export function exampleLevels(): number[] {
  const parts: [BandType, number, number, number][] = [
    ["peak", 55, 7, 2],
    ["peak", 110, -6, 5],
    ["peak", 220, 2.5, 1.2],
    ["peak", 3000, 2, 1.5],
    ["highshelf", 9000, -3, 0.707],
    ["lowshelf", 40, -8, 0.707],
  ];
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  return normalize(GRID.map((f) => parts.reduce((s, p) => s + biquadDb(p[0], p[1], p[2], p[3], f), 0) + (rnd() - 0.5) * 1.2));
}

export type Analysis = {
  /** The round shown, or null for the example. */
  round: Round | null;
  prev: Round | null;
  target: number[];
  recorded: number[];
  predicted: number[];
  prevRecorded: number[] | null;
  /** Suggested slider values. */
  gains: number[];
  during: number[];
  /** iPhone mic: bass is approximate. */
  lowTrust: boolean;
  /** Recorded with EQ on: suggestions move halfway, so rounds settle. */
  followUp: boolean;
  /** Lowest frequency the off-target numbers cover. */
  devLo: 100 | 200;
  devNow: number;
  devAfter: number;
  devPrev: number | null;
  maxChange: number;
  /** "Good fit": keep what's on the speaker. */
  good: "within-1db" | "close" | null;
};

function levelAt(arr: number[], target: number[]) {
  let a = 0;
  let c = 0;
  GRID.forEach((f, k) => {
    if (f >= 250 && f <= 2000) {
      a += arr[k] - target[k];
      c++;
    }
  });
  return a / c;
}

/** Everything the result panel shows, for one round (or the example). */
export function analyze(s: Setup, roundId: string | null): Analysis {
  const round = s.rounds.find((r) => r.id === roundId) ?? latestRound(s);
  const t = s.target;
  const recorded = smooth(round ? roundLevels(round) : exampleLevels());
  const during = round ? round.eqDuring : s.bands.map(() => 0);
  const duringCurve = eqCurve(s.bands, during, GRID);
  const room = recorded.map((v, k) => v - duringCurve[k]);
  const target = targetCurve(t, GRID);
  const lowTrust = !!round && round.mic === "phone";
  const raw = fit(GRID, room, target, s.bands, { range: Math.max(-s.min, s.max), bounds: boundsOf(s), maxBoost: t.maxBoost, step: s.step, lowTrust });
  const followUp = !!round && during.some((v) => v);
  const gains = followUp ? raw.map((g, i) => snap(s, (during[i] || 0) + 0.5 * (g - (during[i] || 0)), i)) : raw;
  const eq = eqCurve(s.bands, gains, GRID);
  const pred = room.map((v, k) => v + eq[k]);
  const align = (arr: number[]) => {
    const o = levelAt(arr, target);
    return arr.map((v) => v - o);
  };
  const prev = round ? prevRound(s, round) : null;
  const prevRec = prev ? smooth(roundLevels(prev)) : null;
  const devLo = lowTrust ? 200 : 100;
  const devNow = deviation(GRID, recorded, target, devLo);
  const maxChange = Math.max(0, ...gains.map((g, i) => Math.abs(g - (during[i] || 0))));
  const isLatest = !!round && round.id === latestRound(s)?.id;
  const good =
    isLatest && round!.n >= 2 && maxChange <= 1
      ? "within-1db"
      : isLatest && during.some((v) => v) && devNow <= 1.5
        ? "close"
        : null;
  return {
    round,
    prev,
    target,
    recorded: align(recorded),
    predicted: align(pred),
    prevRecorded: prevRec ? align(prevRec) : null,
    gains,
    during,
    lowTrust,
    followUp,
    devLo,
    devNow,
    devAfter: deviation(GRID, pred, target, devLo),
    devPrev: prevRec ? deviation(GRID, prevRec, target, devLo) : null,
    maxChange,
    good,
  };
}

/**
 * Measure band width: which peak width explains the change between flat
 * rounds and EQ'd rounds best. Null when there aren't both kinds of round.
 */
export function measureWidth(s: Setup): { best: number; bestMismatch: number; current: number; currentMismatch: number; flat: number; eqd: number } | "need-rounds" | "no-peaks" {
  const flat = s.rounds.filter((r) => r.eqDuring.every((v) => !v));
  const eqd = s.rounds.filter((r) => r.eqDuring.some((v) => v));
  const curQ = s.bands.find((b) => b.type === "peak" && !b.sub)?.q;
  if (!curQ) return "no-peaks";
  if (!flat.length || !eqd.length) return "need-rounds";
  const flatLv = flat.map((r) => smooth(roundLevels(r)));
  const base = GRID.map((_, k) => flatLv.reduce((a, lv) => a + lv[k], 0) / flat.length);
  const idx = GRID.map((_, k) => k).filter((k) => GRID[k] >= 200 && GRID[k] <= 10000);
  const resid = (q: number) => {
    const bands = s.bands.map((b) => (b.type === "peak" && !b.sub ? { ...b, q } : b));
    let tot = 0;
    for (const r of eqd) {
      const lv = smooth(roundLevels(r));
      const eq = eqCurve(bands, r.eqDuring, GRID);
      const dd = idx.map((k) => lv[k] - base[k]);
      const ee = idx.map((k) => eq[k]);
      const md = dd.reduce((a, b) => a + b) / dd.length;
      const me = ee.reduce((a, b) => a + b) / ee.length;
      tot += Math.sqrt(dd.reduce((a, v, i) => a + (v - md - (ee[i] - me)) ** 2, 0) / dd.length);
    }
    return tot / eqd.length;
  };
  const opts = [0.7, 1, 1.4, 2, 3, 4].map((q) => ({ q, r: resid(q) })).sort((a, b) => a.r - b.r);
  return { best: opts[0].q, bestMismatch: opts[0].r, current: curQ, currentMismatch: resid(curQ), flat: flat.length, eqd: eqd.length };
}

// ------------------------------------------------------------ validation

const MAX_BANDS = 16;
const MAX_ROUNDS = 40;
const MAX_FILES = 12;
const MAX_PRESETS = 40;

type Raw = Record<string, unknown>;
const obj = (v: unknown): Raw => (v && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max) : "");
const roundTo = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;
const shortId = (v: unknown, prefix: string) => {
  const s = typeof v === "string" ? v : "";
  return /^[A-Za-z0-9_-]{1,40}$/.test(s) ? s : newId(prefix);
};
const date = (v: unknown) => {
  const n = num(v);
  // 2020 to 2100; anything else becomes now.
  return n && n > 1577836800000 && n < 4102444800000 ? Math.round(n) : Date.now();
};

function cleanBand(v: unknown): SetupBand {
  const b = obj(v);
  const type: BandType = b.type === "lowshelf" || b.type === "highshelf" ? b.type : "peak";
  const f = clamp(num(b.f) ?? 1000, 20, 20000);
  const q = clamp(num(b.q) ?? (type === "peak" ? 1.4 : 0.707), 0.3, 10);
  const out: SetupBand = { label: str(b.label, 12) || autoLabel(f, type), f, type, q };
  if (b.sub === true) out.sub = true;
  const min = num(b.min);
  const max = num(b.max);
  if (min != null) out.min = clamp(min, -30, 0);
  if (max != null) out.max = clamp(max, 0, 30);
  return out;
}

function gainsFor(v: unknown, s: Pick<Setup, "bands" | "min" | "max" | "step">): number[] {
  const g = arr(v);
  return s.bands.map((_, i) => clamp(num(g[i]) ?? 0, lowOf(s, i), highOf(s, i)));
}

function cleanPosition(v: unknown): Position {
  const p = obj(v);
  const d = num(p.dist);
  const h = num(p.height);
  return { dist: d == null ? null : clamp(d, 0, 200), height: h == null ? null : clamp(h, 0, 200), on: str(p.on, 120) };
}

function cleanFile(v: unknown): RoundFile | null {
  const f = obj(v);
  const levels = arr(f.levels).map(num);
  if (levels.length !== GRID.length || levels.some((x) => x == null)) return null;
  const rec = num(f.rec);
  return {
    name: str(f.name, 120) || "Recording",
    seconds: clamp(Math.round(num(f.seconds) ?? 0), 0, 3600),
    keptPct: clamp(Math.round(num(f.keptPct) ?? 100), 0, 100),
    codec: ["Lossless", "Compressed", "WAV"].includes(f.codec as string) ? (f.codec as string) : "",
    rec: rec == null ? null : roundTo(clamp(rec, -200, 10), 1),
    levels: (levels as number[]).map((x) => roundTo(clamp(x, -120, 120), 2)),
  };
}

function cleanRound(v: unknown, s: Pick<Setup, "bands" | "min" | "max" | "step">): Round | null {
  const r = obj(v);
  let files = arr(r.files).slice(0, MAX_FILES).map(cleanFile).filter((f): f is RoundFile => !!f);
  // Older exports kept one averaged spectrum on the round itself.
  if (!files.length) {
    const only = cleanFile({ name: "Earlier recordings", seconds: 0, keptPct: 100, levels: r.levels });
    if (only) files = [only];
  }
  if (!files.length) return null;
  const spl = num(r.spl);
  return {
    id: shortId(r.id, "r"),
    n: clamp(Math.round(num(r.n) ?? 1), 1, 1000),
    date: date(r.date),
    eqDuring: gainsFor(r.eqDuring, s),
    mic: r.mic === "app" || r.mic === "cal" ? r.mic : "phone",
    vol: str(r.vol, 20),
    spl: spl == null ? null : clamp(Math.round(spl), 0, 150),
    pos: r.pos ? cleanPosition(r.pos) : null,
    files,
  };
}

/**
 * A safe, complete setup from anything (a save from the page, an import,
 * an older export). Throws InputError when it can't be a setup at all.
 */
export function cleanSetup(v: unknown): SetupDoc {
  const s = obj(v);
  const bands = arr(s.bands).slice(0, MAX_BANDS + 1).map(cleanBand);
  if (!bands.length) throw new InputError("A setup needs at least one band.");
  if (bands.length > MAX_BANDS) throw new InputError(`A setup can have at most ${MAX_BANDS} bands.`);
  const range = num(s.range);
  const min = clamp(num(s.min) ?? (range != null ? -Math.abs(range) : -12), -30, -0.5);
  const max = clamp(num(s.max) ?? (range != null ? Math.abs(range) : 12), 0.5, 30);
  const stepIn = num(s.step);
  const step = STEPS.includes(stepIn as (typeof STEPS)[number]) ? (stepIn as number) : 1;
  const shape = { bands, min, max, step };
  const t = obj(s.target);
  const lastLevel = obj(s.lastLevel);
  const lastSpl = num(lastLevel.spl);
  const rounds = arr(s.rounds)
    .slice(0, MAX_ROUNDS)
    .map((r) => cleanRound(r, shape))
    .filter((r): r is Round => !!r);
  // Round numbers stay unique: a duplicate gets the next free number.
  const seen = new Set<number>();
  for (const r of rounds.sort((a, b) => a.n - b.n)) {
    while (seen.has(r.n)) r.n++;
    seen.add(r.n);
  }
  const ids = new Set<string>();
  for (const r of rounds) {
    if (ids.has(r.id)) r.id = newId("r");
    ids.add(r.id);
  }
  return {
    name: str(s.name, 80) || "Untitled setup",
    bands,
    min,
    max,
    step,
    notes: str(s.notes, 300),
    currentEq: gainsFor(s.currentEq, shape),
    target: {
      tilt: clamp(num(t.tilt) ?? DEFAULT_TARGET.tilt, -1.6, 0),
      bass: clamp(num(t.bass) ?? DEFAULT_TARGET.bass, -3, 6),
      treble: clamp(num(t.treble) ?? DEFAULT_TARGET.treble, -4, 3),
      maxBoost: clamp(num(t.maxBoost) ?? DEFAULT_TARGET.maxBoost, 0, 12),
    },
    position: cleanPosition(s.position),
    lastLevel: { vol: str(lastLevel.vol, 20), spl: lastSpl == null ? null : clamp(Math.round(lastSpl), 0, 150) },
    rounds,
    presets: arr(s.presets)
      .slice(0, MAX_PRESETS)
      .map((p) => {
        const o = obj(p);
        return { name: str(o.name, 60) || "Preset", gains: gainsFor(o.gains, shape), date: date(o.date), fit: o.fit === true };
      }),
  };
}

/**
 * The setups in an export file: Room Tuner's own export
 * (`{ format: "room-tuner-setups", setups: {...} }`), a list, an id → setup
 * map, or a single setup. Each still goes through `cleanSetup`.
 */
export function setupsInFile(text: string): unknown[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new InputError("That file isn't a Room Tuner export. Pick the .json file the export made.");
  }
  const o = obj(data);
  const inner = o.format === "room-tuner-setups" || "setups" in o ? o.setups : data;
  const list = Array.isArray(inner) ? inner : inner && typeof inner === "object" ? ("bands" in (inner as Raw) ? [inner] : Object.values(inner as Raw)) : [];
  if (!list.length) throw new InputError("No setups found in that file.");
  if (list.length > 50) throw new InputError("That file has more than 50 setups. Import at most 50 at a time.");
  return list;
}
