"use client";

import { useEffect, useRef, useState } from "react";
import { GRID } from "@/lib/roomtune/dsp";
import { fmtDb, highOf, lowOf, type Analysis, type Setup } from "@/lib/roomtune/setup";

/**
 * The frequency chart: what was recorded, the round before (if any), the
 * target and the prediction with the suggested EQ. Sized to its column so
 * labels stay readable on a phone.
 */
export function Chart({ a }: { a: Analysis }) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(680);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(300, Math.min(760, Math.round(el.clientWidth)))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const H = w < 500 ? 240 : 300;
  const L = 34;
  const R = 8;
  const T = 18;
  const B = 28;
  const x0 = Math.log10(30);
  const x1 = Math.log10(16500);
  const vis = (arr: number[]) => arr.filter((_, k) => GRID[k] > 35);
  const lo = Math.max(-30, Math.floor(Math.min(-12, ...vis(a.recorded), ...(a.prevRecorded ? vis(a.prevRecorded) : [])) / 6) * 6);
  const hi = Math.min(24, Math.ceil(Math.max(12, ...vis(a.recorded), ...a.target) / 6) * 6);
  const X = (f: number) => L + ((Math.log10(f) - x0) / (x1 - x0)) * (w - L - R);
  const Y = (v: number) => T + ((hi - v) / (hi - lo)) * (H - T - B);
  const path = (arr: number[]) =>
    arr
      .map((v, k) => (GRID[k] < 33 ? null : [X(GRID[k]), Y(Math.max(lo, Math.min(hi, v)))]))
      .filter((p): p is number[] => !!p)
      .map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`)
      .join("");
  const ticks: number[] = [];
  for (let v = lo; v <= hi; v += 6) ticks.push(v);
  const freqs: [number, string][] = [[50, "50"], [100, "100"], [200, "200"], [500, "500"], [1000, "1k"], [2000, "2k"], [5000, "5k"], [10000, "10k"]];
  const label = "fill-soft text-[11px] tabular-nums";
  const name = a.round ? `Round ${a.round.n}` : "Example room";

  return (
    <figure className="flex flex-col gap-2">
      <div ref={box} className="w-full">
        <svg viewBox={`0 0 ${w} ${H}`} width="100%" role="img" aria-label={`${name}: frequency response from 30 Hz to 16 kHz, with the target and the prediction with the suggested EQ`}>
          {ticks.map((v) => (
            <g key={v}>
              <line x1={L} x2={w - R} y1={Y(v)} y2={Y(v)} className="stroke-line" strokeDasharray={v === 0 ? undefined : "3 4"} />
              <text x={L - 5} y={Y(v) + 4} textAnchor="end" className={label}>
                {v > 0 ? `+${v}` : v}
              </text>
            </g>
          ))}
          {freqs.map(([f, l]) => (
            <g key={f}>
              <line x1={X(f)} x2={X(f)} y1={T} y2={H - B} className="stroke-line" strokeDasharray="3 4" />
              <text x={X(f)} y={H - B + 16} textAnchor="middle" className={label}>
                {l}
              </text>
            </g>
          ))}
          <text x={w - R} y={H - 2} textAnchor="end" className="fill-soft text-[10px]">
            Hz
          </text>
          <text x={2} y={10} className="fill-soft text-[10px]">
            dB
          </text>
          <path d={path(a.target)} fill="none" className="stroke-target" strokeWidth={2} strokeDasharray="7 5" />
          {a.prevRecorded && <path d={path(a.prevRecorded)} fill="none" className="stroke-soft" strokeWidth={1.8} opacity={0.7} />}
          <path d={path(a.recorded)} fill="none" className="stroke-measured" strokeWidth={2.4} strokeLinejoin="round" />
          <path d={path(a.predicted)} fill="none" className="stroke-predicted" strokeWidth={2.4} strokeLinejoin="round" />
        </svg>
      </div>
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-soft">
        <Key className="bg-measured">{a.round ? `Round ${a.round.n}, as recorded` : "Recorded"}</Key>
        {a.prev && <Key className="bg-soft">Round {a.prev.n}, as recorded</Key>}
        <Key className="bg-predicted">Predicted with suggested EQ</Key>
        <Key className="bg-target">Target</Key>
      </figcaption>
    </figure>
  );
}

function Key({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2">
      <i aria-hidden className={`inline-block h-[3px] w-5 rounded-full ${className}`} />
      {children}
    </span>
  );
}

/** The off-target numbers: before, now and predicted. */
export function Stats({ a }: { a: Analysis }) {
  const range = a.devLo === 200 ? "200 Hz to 10 kHz" : "100 Hz to 10 kHz";
  const items: [string, string, string][] = [];
  if (a.prev && a.devPrev != null) items.push([`Round ${a.prev.n}`, `${a.devPrev.toFixed(1)} dB`, `off target, ${range}`]);
  items.push([a.round ? `Round ${a.round.n}` : "Off target now", `${a.devNow.toFixed(1)} dB`, `off target, ${range}`]);
  items.push(["With suggested EQ", `${a.devAfter.toFixed(1)} dB`, "predicted"]);
  return (
    <dl className="grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-3">
      {items.map(([k, v, sub]) => (
        <div key={k} className="flex flex-col rounded-[var(--radius-control)] border border-line px-3 py-2">
          <dt className="text-sm text-soft">{k}</dt>
          <dd className="text-2xl font-semibold tabular-nums">{v}</dd>
          <dd className="text-sm text-soft">{sub}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The suggested values drawn like the speaker app's sliders, so they're
 * easy to copy. Under each, the change from the EQ the round used.
 */
export function Sliders({ s, gains, during, showChange }: { s: Pick<Setup, "bands" | "min" | "max">; gains: number[]; during?: number[]; showChange?: boolean }) {
  return (
    <ol className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${s.bands.length}, minmax(0, 1fr))` }} aria-label="Suggested slider values">
      {s.bands.map((b, i) => {
        const span = Math.max(-lowOf(s, i), highOf(s, i)) || 1;
        const v = gains[i] ?? 0;
        const pct = 50 - (v / span) * 50 * 0.88;
        const d = +(v - (during?.[i] ?? 0)).toFixed(2);
        return (
          <li key={i} className="flex flex-col items-center gap-1.5">
            <span className="text-base font-semibold tabular-nums sm:text-lg">{fmtDb(v)}</span>
            <span aria-hidden className="relative h-40 w-6 rounded-full bg-wash sm:h-48 sm:w-7">
              <span className="absolute inset-x-[-4px] top-1/2 border-t border-dashed border-soft/60" />
              <span className="absolute inset-x-0 rounded-full bg-ink/85" style={{ top: `${Math.min(50, pct)}%`, height: `${Math.abs(50 - pct)}%` }} />
              <span className="absolute left-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-ink bg-page motion-safe:transition-[top]" style={{ top: `${pct}%` }} />
            </span>
            <span className="text-sm text-soft">
              <span className="sr-only">Band </span>
              {b.label}
            </span>
            {showChange && <span className="min-h-5 text-xs text-soft tabular-nums">{d ? fmtDb(d) : "·"}</span>}
          </li>
        );
      })}
    </ol>
  );
}

/** A preset's values as small chips: "250 +1". */
export function GainChips({ s, gains }: { s: Pick<Setup, "bands">; gains: number[] }) {
  return (
    <span className="flex flex-wrap gap-1">
      {gains.map((g, i) => (
        <span key={i} className="rounded-[var(--radius-control)] bg-wash px-1.5 py-0.5 text-sm tabular-nums">
          {s.bands[i]?.label} {fmtDb(g)}
        </span>
      ))}
    </span>
  );
}
