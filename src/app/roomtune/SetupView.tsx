"use client";

import { useMemo, useState } from "react";
import { analyze, eqText, latestRound, type Setup } from "@/lib/roomtune/setup";
import { Chart, GainChips, Sliders, Stats } from "./ResultParts";
import { control } from "./SetupBuilder";

/** Read-only view of a setup, for its view link. Nothing here saves. */
export function SetupView({ setup: s }: { setup: Setup }) {
  const [roundId, setRoundId] = useState<string | null>(null);
  const a = useMemo(() => analyze(s, roundId), [s, roundId]);
  const rounds = [...s.rounds].sort((x, y) => y.n - x.n);
  const latest = latestRound(s);
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="title break-words">{s.name}</h1>
        <p className="text-sm text-soft">
          {s.bands.length}-band EQ · {s.rounds.length ? `${s.rounds.length} round${s.rounds.length > 1 ? "s" : ""}` : "no rounds yet"} · on the speaker now: {eqText(s, s.currentEq)}
        </p>
      </div>
      {latest ? (
        <section className="flex flex-col gap-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="heading">Room and fix</h2>
            {rounds.length > 1 && (
              <label className="flex flex-col gap-1 text-sm font-semibold">
                Showing
                <select value={a.round?.id ?? ""} onChange={(e) => setRoundId(e.target.value)} className={control}>
                  {rounds.map((r, i) => (
                    <option key={r.id} value={r.id}>
                      Round {r.n}
                      {i === 0 ? " (latest)" : ""}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <Stats a={a} />
          <Chart a={a} />
          <h3 className="text-lg font-semibold">Suggested slider values</h3>
          <Sliders s={s} gains={a.gains} during={a.during} showChange={a.followUp} />
        </section>
      ) : (
        <p className="text-soft">No rounds measured yet.</p>
      )}
      <section className="flex flex-col gap-3">
        <h2 className="heading">Presets</h2>
        {s.presets.length ? (
          <ul className="flex flex-col divide-y divide-line border-y border-line">
            {[...s.presets].reverse().map((p, i) => (
              <li key={i} className="flex flex-col gap-2 py-3">
                <span className="font-semibold break-words">{p.name}</span>
                <GainChips s={s} gains={p.gains} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-soft">No presets saved.</p>
        )}
      </section>
    </div>
  );
}
