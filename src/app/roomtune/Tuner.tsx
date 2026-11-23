"use client";

import { useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";
import { Choice } from "@/components/ui/Choice";
import { ConfirmForm } from "@/components/ui/forms";
import { analyzeFiles } from "@/lib/roomtune/recordings";
import {
  MIC_LABELS,
  analyze,
  eqText,
  fmtDb1,
  fmtHz,
  highOf,
  latestRound,
  lowOf,
  measureWidth,
  newId,
  roundRecLevel,
  snap,
  widthName,
  type Mic,
  type Round,
  type Setup,
} from "@/lib/roomtune/setup";
import { Chart, GainChips, Sliders, Stats } from "./ResultParts";
import { NoisePlayer } from "./NoisePlayer";
import { SetupLink } from "./SetupLink";
import { control } from "./SetupBuilder";
import { useSaver, type SaveState } from "./useSaver";
import { usePref } from "./usePref";
import { deleteSetupAction } from "./actions";


const MIC_NOTES: Record<Mic, string> = {
  phone: "Bass readings below about 150 Hz are treated with caution.",
  app: "Use an app that exports a WAV with its iPhone mic correction applied.",
  cal: "Apply the mic's calibration file in your recording software before uploading.",
};

const CHECKS: [string, string, string][] = [
  ["Audio Quality: Lossless", "On", "Settings › Apps › Voice Memos › Audio Quality, on the phone that records. AirDropping from Voice Memos can arrive compressed; save to Files and AirDrop from there, or upload from Phone B itself."],
  ["Spatial Audio (record Mono or Stereo instead)", "Off", "Newer iPhones record Spatial Audio by default. Switch to Mono or Stereo in Voice Memos' recording options. Lossless is only offered for Mono and Stereo."],
  ["Voice Isolation", "Off", "In Voice Memos' recording options. It filters out steady sound, which is exactly what you're measuring."],
  ["Enhance Recording and Studio Voice", "Off", "Never apply these to a measurement recording."],
  ["Do Not Disturb or Airplane Mode", "On", "Control Center. Stops notification sounds and vibrations from landing in the recording."],
  ["Bottom microphone uncovered", "Check", "A thick case lip over the bottom edge changes the treble."],
];

const when = (ms: number) => new Date(ms).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** Room Tuner for one setup: play, record, upload, read the fix, keep presets. */
export function Tuner({ initial, links, siteUrl }: { initial: Setup; links: { id: string; token: string }[]; siteUrl: string }) {
  const { setup: s, update, state, retry } = useSaver(initial);
  const [roundId, setRoundId] = useState<string | null>(null);
  const [during, setDuring] = useState<number[]>(() => initial.currentEq.slice());
  const [vol, setVol] = useState(initial.lastLevel.vol);
  const [spl, setSpl] = useState(initial.lastLevel.spl == null ? "" : String(initial.lastLevel.spl));
  const [micPref, setMicPref] = usePref("mic");
  const mic: Mic = micPref === "app" || micPref === "cal" ? micPref : "phone";
  const [status, setStatus] = useState("");
  const [problems, setProblems] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [entered, setEntered] = useState("");
  const [presetName, setPresetName] = useState<string | null>(null);
  const result = useRef<HTMLElement>(null);
  const files = useRef<HTMLInputElement>(null);
  const fileMode = useRef<{ mode: "new" | "add" | "replace"; roundId?: string }>({ mode: "new" });

  const a = useMemo(() => analyze(s, roundId), [s, roundId]);
  const latest = latestRound(s);
  const next = (latest?.n ?? 0) + 1;
  const rounds = [...s.rounds].sort((x, y) => y.n - x.n);
  const defaultPresetName = a.round ? `Round ${a.round.n} fit` : "";

  function pick(mode: "new" | "add" | "replace", id?: string) {
    fileMode.current = { mode, roundId: id };
    files.current?.click();
  }

  async function onFiles(list: FileList | null) {
    const picked = list ? [...list] : [];
    if (files.current) files.current.value = "";
    if (!picked.length) return;
    setBusy(true);
    setProblems([]);
    const { results, problems: notes } = await analyzeFiles(picked, setStatus);
    setBusy(false);
    if (!results.length) {
      setStatus("No recordings could be analyzed.");
      setProblems(notes);
      return;
    }
    const { mode, roundId: target } = fileMode.current;
    let shown = "";
    let message = "";
    update((cur) => {
      let rs = cur.rounds;
      let r: Round;
      let extra: Partial<Setup> = {};
      if (mode === "new" || !rs.length) {
        const n = (latestRound(cur)?.n ?? 0) + 1;
        const splNum = spl.trim() === "" ? null : Math.round(Number(spl));
        r = { id: newId("r"), n, date: Date.now(), eqDuring: cur.bands.map((_, i) => snap(cur, during[i] ?? 0, i)), mic, vol: vol.trim(), spl: Number.isFinite(splNum) ? splNum : null, pos: { ...cur.position }, files: results };
        rs = [...rs, r];
        extra = { lastLevel: { vol: r.vol, spl: r.spl }, currentEq: r.eqDuring.slice() };
        message = `Round ${r.n}: ${results.length} recording${results.length > 1 ? "s" : ""} analyzed.`;
      } else {
        const old = mode === "add" && !target ? latestRound(cur)! : rs.find((x) => x.id === target)!;
        r = { ...old, files: mode === "replace" ? results : [...old.files, ...results].slice(0, 12) };
        rs = rs.map((x) => (x.id === old.id ? r : x));
        message = `Round ${r.n}: ${mode === "replace" ? "recordings replaced" : "recordings added"}, ${r.files.length} in total. Its EQ and mic settings are unchanged.`;
      }
      const lv = roundRecLevel(r);
      const pr = rs.filter((x) => x.id !== r.id && roundRecLevel(x) != null).sort((x, y) => y.n - x.n)[0];
      const plv = pr ? roundRecLevel(pr) : null;
      if (pr && lv != null && plv != null && Math.abs(lv - plv) > 3)
        notes.push(
          `Round ${r.n} was recorded ${Math.abs(lv - plv).toFixed(0)} dB ${lv > plv ? "louder" : "quieter"} than Round ${pr.n}. If the speaker volume changed, its own volume-dependent EQ may have changed the bass too. Use the same volume for rounds you want to compare.`,
        );
      shown = r.id;
      return { ...cur, ...extra, rounds: rs };
    }, true);
    setRoundId(shown);
    setPresetName(null);
    setStatus(message);
    setProblems(notes);
    result.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function putOnSpeaker(gains: number[]) {
    update((cur) => ({ ...cur, currentEq: gains.slice() }), true);
    setDuring(gains.slice());
  }

  function enteredThese() {
    if (!a.round) return;
    const g = a.gains.slice();
    const n = a.round.n;
    update(
      (cur) => ({
        ...cur,
        currentEq: g,
        presets: cur.presets.some((p) => p.gains.every((v, i) => v === g[i])) ? cur.presets : [...cur.presets, { name: `Round ${n} fit`, gains: g, date: Date.now(), fit: true }],
      }),
      true,
    );
    setDuring(g);
    setEntered(`Step 3 is now set to these values for Round ${next}. Saved as the preset “Round ${n} fit”.`);
  }

  function savePreset(e: React.FormEvent) {
    e.preventDefault();
    if (!a.round) return;
    const name = (presetName ?? defaultPresetName).trim() || "Room fit";
    const g = a.gains.slice();
    update((cur) => ({ ...cur, presets: [...cur.presets, { name: name.slice(0, 60), gains: g, date: Date.now(), fit: true }] }), true);
    setPresetName(null);
  }

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-2">
        <Link href="/roomtune" className="min-h-11 content-center self-start text-accent underline-offset-4 hover:underline">
          ‹ Setups
        </Link>
        <h1 className="title break-words">{s.name}</h1>
        <p className="text-sm text-soft">
          {s.bands.length}-band EQ{s.bands.some((b) => b.sub) ? " with sub" : ""} ·{" "}
          {latest ? `${s.rounds.length} round${s.rounds.length > 1 ? "s" : ""}, latest ${when(latest.date)}` : "no rounds yet"}
        </p>
        <SaveStatus state={state} retry={retry} />
      </div>

      <Step n="1" title="Play the test signal" who="Phone A">
        <p>
          Connect this phone to the speaker over Bluetooth or AirPlay and play the noise. Set the speaker&apos;s volume so a meter reads about <b>75 dB</b> at your seat.
        </p>
        <More summary="How to set the level">
          <ol className="flex list-decimal flex-col gap-1.5 pl-5">
            <li>Keep this page&apos;s signal level where it is.</li>
            <li>With the noise playing, open a sound level meter app on Phone B at your seat. The free NIOSH SLM app is a good one. Use A-weighting if it asks.</li>
            <li>Adjust the speaker&apos;s volume in its own app until the meter reads about 75 dB. Note the volume number and enter it and the reading in step 3.</li>
          </ol>
          <p className="text-sm text-soft">
            Many speakers change their own EQ with volume, so measure every round at the same level. To tune a quiet preset, measure a separate round at about 55 dB.
          </p>
        </More>
        <NoisePlayer />
      </Step>

      <Step n="2" title="Record the room" who="Phone B">
        {s.notes && (
          <Alert tone="info">
            <b>Turn off while measuring:</b> {s.notes}
          </Alert>
        )}
        <p>Record 30 seconds at each of 3 marked spots around your seat, with the phone resting at ear height. Then upload the recordings together as one round.</p>
        <More summary="How the rounds work">
          <ol className="flex list-decimal flex-col gap-1.5 pl-5">
            <li>Round 1: set every slider in your speaker&apos;s app to 0 and record.</li>
            <li>Enter the suggested values in the app and tap “I&apos;ve entered these in the app”.</li>
            <li>Round 2: record again from the same spots. This shows what really changed.</li>
            <li>Repeat until the page says Good fit, usually 2 or 3 rounds. Changes of 1 dB are within measurement noise.</li>
          </ol>
        </More>
        <PhoneChecklist />
        <More summary="Where to put the phone">
          <ol className="flex list-decimal flex-col gap-1.5 pl-5">
            <li>Pick 3 spots: where your head is when you sit, about 18 inches to the left, and 18 inches to the right. Mark them with tape so every round uses the same spots.</li>
            <li>Measure from the front of the speaker to the center spot, and how high the phone sits off the floor. Enter both below; they&apos;re saved with each round.</li>
            <li>Rest the phone at ear height on something steady and open, like a tripod or a chair back. Not on a table or a wide stack of books: the surface right next to the mic causes false dips. Bottom edge toward the speaker, screen up.</li>
            <li>Start Phone A&apos;s noise, start a Voice Memos recording, sit still for 30 seconds, then stop. Repeat at each spot.</li>
            <li>Upload the 3 recordings together in step 3 as one round.</li>
          </ol>
          <p className="text-sm text-soft">Short on time? Use just the center spot, but then use it every round.</p>
        </More>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_1fr_2fr]">
          <Field
            label="Speaker to center spot (ft)"
            type="number"
            inputMode="decimal"
            step={0.5}
            value={s.position.dist ?? ""}
            onChange={(e) => update((cur) => ({ ...cur, position: { ...cur.position, dist: e.target.value === "" ? null : Number(e.target.value) } }))}
          />
          <Field
            label="Phone height (in)"
            type="number"
            inputMode="numeric"
            step={1}
            value={s.position.height ?? ""}
            onChange={(e) => update((cur) => ({ ...cur, position: { ...cur.position, height: e.target.value === "" ? null : Number(e.target.value) } }))}
          />
          <Field
            label="What the phone sits on"
            value={s.position.on}
            maxLength={120}
            placeholder="e.g. tripod behind the couch"
            onChange={(e) => update((cur) => ({ ...cur, position: { ...cur.position, on: e.target.value } }))}
          />
        </div>
      </Step>

      <Step n="3" title="Upload a round">
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-semibold">EQ on the speaker during this round (dB)</legend>
          <p className="text-sm text-soft">The tool takes this EQ back out of the recording to see the room itself.</p>
          <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${s.bands.length}, minmax(0, 1fr))` }}>
            {s.bands.map((b, i) => (
              <label key={i} className="flex flex-col items-center gap-1 text-sm text-soft">
                {b.label}
                <input
                  type="number"
                  inputMode="decimal"
                  min={lowOf(s, i)}
                  max={highOf(s, i)}
                  step={s.step}
                  value={during[i] ?? 0}
                  onChange={(e) => setDuring((d) => s.bands.map((_, j) => (j === i ? Number(e.target.value) || 0 : (d[j] ?? 0))))}
                  className={`${control} w-full px-1 text-center tabular-nums text-ink`}
                />
              </label>
            ))}
          </div>
          <div>
            <button type="button" onClick={() => setDuring(s.bands.map(() => 0))} className="min-h-11 text-accent underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-accent">
              Set all to 0
            </button>
          </div>
        </fieldset>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Speaker volume in its app" value={vol} maxLength={20} placeholder="e.g. 35%" onChange={(e) => setVol(e.target.value)} />
          <Field label="Meter reading at your seat (dB)" type="number" inputMode="decimal" value={spl} placeholder="e.g. 75" onChange={(e) => setSpl(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Choice
            legend="Recorded with"
            name="mic"
            value={mic}
            onChange={setMicPref}
            options={(Object.keys(MIC_LABELS) as Mic[]).map((m) => ({ value: m, label: MIC_LABELS[m] }))}
          />
          <p className="text-sm text-soft">{MIC_NOTES[mic]}</p>
        </div>
        <input ref={files} type="file" accept="audio/*,.m4a,.wav,.mp3,.caf,.aac" multiple hidden onChange={(e) => onFiles(e.target.files)} data-testid="round-files" />
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button disabled={busy} onClick={() => pick("new")}>
            Upload Round {next}
          </Button>
          {latest && (
            <Button variant="quiet" disabled={busy} onClick={() => pick("add")}>
              Add files to Round {latest.n}
            </Button>
          )}
        </div>
        <p className="text-sm text-soft">
          {latest
            ? `“Upload Round ${next}” starts a new round with the EQ above. “Add files to Round ${latest.n}” adds recordings to the last round, which used ${eqText(s, latest.eqDuring)}.`
            : "Select all the recordings from one round at once. They're averaged into one result."}
        </p>
        <p role="status" aria-live="polite" className="text-sm">
          {status}
        </p>
        {problems.length > 0 && (
          <div role="alert" className="flex flex-col gap-1 rounded-[var(--radius-control)] bg-red-50 px-4 py-3 text-sm text-red-800">
            {problems.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        )}
      </Step>

      <section ref={result} className="flex scroll-mt-4 flex-col gap-5" aria-labelledby="rt-result">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="rt-result" className="heading">
            <span className="mr-2 text-base text-soft tabular-nums">4</span>Your room and the fix
          </h2>
          {rounds.length > 1 && (
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Showing
              <select value={a.round?.id ?? ""} onChange={(e) => { setRoundId(e.target.value); setPresetName(null); }} className={control}>
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
        {!a.round && (
          <Alert tone="info">
            <b>Example only.</b> This is a made-up room so you can see how it works. Upload Round 1 in step 3 to replace it.
          </Alert>
        )}
        {a.good && (
          <Alert tone="info">
            <b>Good fit.</b>{" "}
            {a.good === "within-1db"
              ? `Round ${a.round!.n} is within 1 dB of the suggestion on every band, which is measurement noise. Keep the EQ that's on the speaker.`
              : `Round ${a.round!.n} is only ${a.devNow.toFixed(1)} dB off target, about as close as a phone measurement can tell. Keep the EQ that's on the speaker. The sliders below are optional fine-tuning.`}
          </Alert>
        )}
        {a.lowTrust && (
          <p className="text-sm text-soft">
            <b className="text-ink">Bass is approximate.</b> iPhone mics hear less deep bass than is really there, so the lowest band is held to small boosts and below 150 Hz counts for less. Trust your ears for the bass slider.
          </p>
        )}
        <Stats a={a} />
        <Chart a={a} />

        <More summary="Target sound">
          <p className="text-sm text-soft">
            Flat in a room sounds thin and bright, so the default target slopes down gently from bass to treble. Large boosts mostly make the speaker work harder, so they&apos;re capped. Narrow dips the room
            creates are mostly left alone, because EQ can&apos;t fill them.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Range label="Tilt" value={s.target.tilt} min={-1.6} max={0} step={0.1} show={(v) => `${fmtDb1(v)} dB/oct`} onChange={(v) => update((c) => ({ ...c, target: { ...c.target, tilt: v } }))} />
            <Range label="Extra bass" value={s.target.bass} min={-3} max={6} step={0.5} show={(v) => `${fmtDb1(v)} dB`} onChange={(v) => update((c) => ({ ...c, target: { ...c.target, bass: v } }))} />
            <Range label="Treble" value={s.target.treble} min={-4} max={3} step={0.5} show={(v) => `${fmtDb1(v)} dB`} onChange={(v) => update((c) => ({ ...c, target: { ...c.target, treble: v } }))} />
            <Range label="Max boost per band" value={s.target.maxBoost} min={0} max={12} step={1} show={(v) => `+${v} dB`} onChange={(v) => update((c) => ({ ...c, target: { ...c.target, maxBoost: v } }))} />
          </div>
        </More>

        <div className="flex flex-col gap-3">
          <h3 className="text-lg font-semibold">Set these in your speaker&apos;s app</h3>
          <Sliders s={s} gains={a.gains} during={a.during} showChange={a.followUp} />
          {a.followUp && (
            <p className="text-sm text-soft">
              Small numbers under each slider are the change from Round {a.round!.n}&apos;s EQ (· means no change). Changes are kept to half the full correction so rounds settle instead of overshooting.
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <div className="max-w-sm">
            <Button disabled={!a.round} onClick={enteredThese}>
              I&apos;ve entered these in the app
            </Button>
          </div>
          {entered && (
            <p role="status" className="text-sm text-soft">
              {entered}
            </p>
          )}
        </div>
        <form onSubmit={savePreset} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Field label="Preset name" value={presetName ?? defaultPresetName} maxLength={60} disabled={!a.round} onChange={(e) => setPresetName(e.target.value)} />
          </div>
          <Button type="submit" variant="quiet" disabled={!a.round}>
            Save as preset
          </Button>
        </form>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="rt-rounds">
        <h2 id="rt-rounds" className="heading">
          Rounds
        </h2>
        {rounds.length ? (
          <ul className="flex flex-col divide-y divide-line border-y border-line">
            {rounds.map((r) => (
              <RoundRow
                key={r.id}
                s={s}
                r={r}
                showing={r.id === a.round?.id}
                busy={busy}
                onShow={() => {
                  setRoundId(r.id);
                  setPresetName(null);
                  result.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                onPick={(mode) => pick(mode, r.id)}
                onDelete={() => {
                  update((cur) => ({ ...cur, rounds: cur.rounds.filter((x) => x.id !== r.id) }), true);
                  if (roundId === r.id) setRoundId(null);
                }}
              />
            ))}
          </ul>
        ) : (
          <p className="text-soft">Each upload in step 3 becomes a round, with its recordings and the EQ that was on the speaker.</p>
        )}
        {rounds.length > 0 && (
          <TwoTap
            label="Start over"
            confirm={`Tap again to clear all ${rounds.length} rounds`}
            hint="Presets and saved positions are kept. The next upload becomes Round 1."
            onConfirm={() => {
              update((cur) => ({ ...cur, rounds: [] }), true);
              setRoundId(null);
            }}
          />
        )}
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="rt-presets">
        <h2 id="rt-presets" className="heading">
          Presets
        </h2>
        {s.presets.length ? (
          <ul className="flex flex-col divide-y divide-line border-y border-line">
            {[...s.presets].reverse().map((p, ri) => {
              const i = s.presets.length - 1 - ri;
              const on = p.gains.every((g, j) => g === s.currentEq[j]);
              return (
                <li key={`${i}-${p.date}`} className="flex flex-col gap-2 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-semibold break-words">{p.name}</span>
                    <span className="text-sm text-soft">
                      {on ? "On the speaker · " : ""}
                      {new Date(p.date).toLocaleDateString()}
                    </span>
                  </div>
                  <GainChips s={s} gains={p.gains} />
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    {!on && (
                      <Button variant="quiet" onClick={() => putOnSpeaker(p.gains)}>
                        I put this on the speaker
                      </Button>
                    )}
                    <TwoTap label="Delete" confirm="Tap again to delete" onConfirm={() => update((cur) => ({ ...cur, presets: cur.presets.filter((_, j) => j !== i) }), true)} />
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-soft">Presets you save appear here, with the values to enter in the app.</p>
        )}
      </section>

      <details className="pt-2">
        <summary className="min-h-11 cursor-pointer content-center font-semibold">Manage</summary>
        <div className="mt-4 flex flex-col gap-8">
          <Field label="Name" value={s.name} maxLength={80} onChange={(e) => update((cur) => ({ ...cur, name: e.target.value }))} />
          <section className="flex flex-col gap-3">
            <h2 className="heading">EQ layout</h2>
            <p className="text-sm text-soft">
              {s.bands
                .map((b, i) => `${b.label} (${fmtHz(b.f)} Hz, ${b.sub ? "sub" : b.type === "peak" ? `peak, ${widthName(b.q)}` : b.type === "lowshelf" ? "bass shelf" : "treble shelf"}, ${lowOf(s, i)} to +${highOf(s, i)} dB)`)
                .join(", ")}
              . Steps of {s.step} dB.
            </p>
            <Link
              href={`/roomtune/${s.id}/bands`}
              className="inline-flex min-h-11 w-fit items-center text-accent underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-accent"
            >
              Edit EQ layout
            </Link>
          </section>
          <WidthTool s={s} onUse={(q) => update((cur) => ({ ...cur, bands: cur.bands.map((b) => (b.type === "peak" && !b.sub ? { ...b, q } : b)) }), true)} />
          <SetupLink setupId={s.id} links={links} siteUrl={siteUrl} />
          <section className="flex flex-col gap-3">
            <h2 className="heading">Delete</h2>
            <ConfirmForm action={deleteSetupAction} id={s.id} label="Delete setup" consequence={`“${s.name}” and all its rounds and presets will be gone for good. Its view link stops working.`} />
          </section>
        </div>
      </details>
    </div>
  );
}

function SaveStatus({ state, retry }: { state: SaveState; retry: () => void }) {
  if (state.kind === "error")
    return (
      <div className="flex flex-col gap-2">
        <Alert>{state.error ?? "Not saved."} Your changes are still on this page.</Alert>
        <div className="max-w-xs">
          <Button variant="quiet" onClick={retry}>
            Try again
          </Button>
        </div>
      </div>
    );
  return (
    <p role="status" className="text-sm text-soft">
      {state.kind === "saved" ? "Saved to your account ✓" : "Saving…"}
    </p>
  );
}

function Step({ n, title, who, children }: { n: string; title: string; who?: string; children: React.ReactNode }) {
  const id = useId();
  return (
    <section className="flex flex-col gap-4" aria-labelledby={id}>
      <h2 id={id} className="heading">
        <span className="mr-2 text-base text-soft tabular-nums">{n}</span>
        {title}
        {who && <span className="ml-2 font-sans text-base text-soft">· {who}</span>}
      </h2>
      {children}
    </section>
  );
}

function More({ summary, children, extra }: { summary: string; children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <details className="rounded-[var(--radius-control)] border border-line px-4 open:pb-4">
      <summary className="flex min-h-12 cursor-pointer flex-wrap items-center gap-2 font-semibold">
        {summary}
        {extra}
      </summary>
      <div className="flex flex-col gap-3">{children}</div>
    </details>
  );
}

function Range({ label, value, min, max, step, show, onChange }: { label: string; value: number; min: number; max: number; step: number; show: (v: number) => string; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="flex justify-between">
        <span className="font-semibold">{label}</span>
        <span className="tabular-nums text-soft">{show(value)}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="min-h-11 accent-ink" />
    </label>
  );
}

/** A delete that asks once, inline: the first tap arms it, the second does it. */
function TwoTap({ label, confirm, hint, onConfirm }: { label: string; confirm: string; hint?: string; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            if (armed) {
              setArmed(false);
              onConfirm();
            } else setArmed(true);
          }}
          className={`min-h-11 text-left underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-accent ${armed ? "font-semibold text-red-800" : "text-accent"}`}
        >
          {armed ? confirm : label}
        </button>
        {armed && (
          <button type="button" onClick={() => setArmed(false)} className="min-h-11 text-accent underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-accent">
            Cancel
          </button>
        )}
      </div>
      {armed && hint && <p className="text-sm text-soft">{hint}</p>}
    </div>
  );
}

function RoundRow({ s, r, showing, busy, onShow, onPick, onDelete }: { s: Setup; r: Round; showing: boolean; busy: boolean; onShow: () => void; onPick: (mode: "add" | "replace") => void; onDelete: () => void }) {
  const pos = r.pos && (r.pos.dist || r.pos.height) ? [r.pos.dist ? `${r.pos.dist} ft from speaker` : "", r.pos.height ? `${r.pos.height} in high` : "", r.pos.on].filter(Boolean).join(", ") : "";
  const lv = roundRecLevel(r);
  const level = [r.spl ? `${r.spl} dB at seat` : "", r.vol ? `volume ${r.vol}` : "", lv != null ? `recorded at ${Math.round(lv)} dBFS` : ""].filter(Boolean).join(", ");
  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-semibold">
          Round {r.n}
          {showing ? " · showing" : ""}
        </span>
        <span className="text-sm text-soft">{when(r.date)}</span>
      </div>
      <p className="text-sm">
        {[level, `EQ on speaker: ${eqText(s, r.eqDuring)}`, { phone: "iPhone mic", app: "measurement app", cal: "calibrated mic" }[r.mic], pos].filter(Boolean).join(" · ")}
      </p>
      <ul className="flex flex-col gap-0.5 text-sm text-soft">
        {r.files.map((f, i) => (
          <li key={i}>
            <span className="break-all text-ink">{f.name}</span> · {f.seconds} s · {f.keptPct}% used{f.codec ? ` · ${f.codec}` : ""}
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        {!showing && (
          <Button variant="quiet" onClick={onShow}>
            Show
          </Button>
        )}
        <Button variant="quiet" disabled={busy} onClick={() => onPick("add")}>
          Add recordings
        </Button>
        <Button variant="quiet" disabled={busy} onClick={() => onPick("replace")}>
          Replace recordings
        </Button>
        <TwoTap label="Delete round" confirm={`Tap again to delete Round ${r.n}`} onConfirm={onDelete} />
      </div>
    </li>
  );
}

function WidthTool({ s, onUse }: { s: Setup; onUse: (q: number) => void }) {
  const [out, setOut] = useState<React.ReactNode>(null);
  function run() {
    const m = measureWidth(s);
    if (m === "no-peaks") return setOut("This setup has no peak bands, so there's no width to measure.");
    if (m === "need-rounds") return setOut("Needs at least one round with every slider at 0 and one round with EQ on, recorded from the same spots.");
    if (m.currentMismatch - m.bestMismatch < 0.1) return setOut(`The current width (${widthName(m.current)}) already matches your rounds best. Mismatch ${m.currentMismatch.toFixed(2)} dB.`);
    setOut(
      <div className="flex flex-col gap-2">
        <p>
          Best match: {widthName(m.best)} (Q {m.best}). Mismatch drops from {m.currentMismatch.toFixed(2)} dB to {m.bestMismatch.toFixed(2)} dB, using {m.flat} flat and {m.eqd} EQ round
          {m.eqd > 1 ? "s" : ""}.
        </p>
        <div className="max-w-xs">
          <Button
            variant="quiet"
            onClick={() => {
              onUse(m.best);
              setOut(`Peak bands now use ${widthName(m.best)} width.`);
            }}
          >
            Use this width
          </Button>
        </div>
      </div>,
    );
  }
  return (
    <section className="flex flex-col gap-3">
      <h2 className="heading">Measure band width</h2>
      <p className="text-sm text-soft">Compares a round with every slider at 0 to rounds with EQ on, from the same spots, to see how wide each slider really acts.</p>
      <div className="max-w-xs">
        <Button variant="quiet" onClick={run}>
          Measure from my rounds
        </Button>
      </div>
      {out && (
        <div role="status" className="text-sm">
          {out}
        </div>
      )}
    </section>
  );
}

function PhoneChecklist() {
  const [saved, setSaved] = usePref("checklist");
  const done = CHECKS.map((_, i) => saved?.[i] === "1");
  const count = done.filter(Boolean).length;
  return (
    <More summary="Phone B settings" extra={<span className="text-sm font-normal text-soft">{count} of {CHECKS.length} checked</span>}>
      <ul className="flex flex-col divide-y divide-line">
        {CHECKS.map(([what, state, where], i) => (
          <li key={i}>
            <label className="flex cursor-pointer items-start gap-3 py-2">
              <input
                type="checkbox"
                checked={done[i]}
                onChange={(e) => setSaved(done.map((x, j) => ((j === i ? e.target.checked : x) ? "1" : "0")).join(""))}
                className="mt-1 size-5 shrink-0 accent-ink"
              />
              <span className="flex flex-1 flex-col">
                <span className={done[i] ? "text-soft line-through" : ""}>
                  {what}: <b>{state}</b>
                </span>
                <span className="text-sm text-soft">{where}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </More>
  );
}
