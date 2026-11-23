"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";
import { Choice } from "@/components/ui/Choice";
import type { BandType } from "@/lib/roomtune/dsp";
import {
  KINDS,
  STEPS,
  TEMPLATES,
  WIDTHS,
  autoLabel,
  blankSetup,
  fmtDb,
  fmtHz,
  snap,
  type Setup,
  type SetupBand,
} from "@/lib/roomtune/setup";
import { createSetupAction, readEqAction, saveSetupAction } from "./actions";

/** Same look as Field's input, for selects and compact inputs. */
export const control =
  "min-h-12 min-w-0 rounded-[var(--radius-control)] border border-line bg-field px-3 text-base " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent disabled:opacity-50";

/** A band row. `value` is the setting read from a screenshot, carried with its row. */
type Row = { key: number; label: string; f: string; type: BandType; q: number | null; auto: boolean; value?: number };

let keys = 0;
const toRow = (b: Partial<SetupBand> & { value?: number }): Row => ({ key: keys++, label: b.label ?? "", f: b.f ? String(b.f) : "", type: b.type ?? "peak", q: b.q ?? null, auto: !b.label, value: b.value });

/** Phone screenshots can be large: send a JPEG at most 1600 px on its long side. */
async function shrink(file: File, maxSide = 1600): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k);
    c.height = Math.round(bmp.height * k);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise((res) => c.toBlob((b) => res(b ?? file), "image/jpeg", 0.88));
  } catch {
    return file;
  }
}

const widthOf = (q: number) => (q >= 2.5 ? 3 : q >= 1.2 ? 1.4 : 0.8);

/**
 * The EQ layout of a setup: bands low to high as the speaker's app labels
 * them, the slider range and step, band width, a sub level control, and
 * what to turn off while measuring. New setups can start from a template.
 * When a setup has rounds, bands can't be added or removed.
 */
export function SetupBuilder({ setup, canReadScreenshots = false }: { setup?: Setup; canReadScreenshots?: boolean }) {
  const router = useRouter();
  const editing = !!setup;
  const locked = !!setup && setup.rounds.length > 0;
  const plain = setup?.bands.filter((b) => !b.sub) ?? [];
  const sub = setup?.bands.find((b) => b.sub);
  const peak = plain.find((b) => b.type === "peak");

  const [name, setName] = useState(setup?.name ?? "");
  const [tpl, setTpl] = useState("custom");
  const [rows, setRows] = useState<Row[]>(() => (setup ? plain.map(toRow) : [toRow({}), toRow({})]));
  const [min, setMin] = useState(String(setup?.min ?? -10));
  const [max, setMax] = useState(String(setup?.max ?? 10));
  const [step, setStep] = useState(String(setup?.step ?? 1));
  const [width, setWidth] = useState(String(peak ? widthOf(peak.q) : 1.4));
  const [hasSub, setHasSub] = useState(sub ? "level" : "none");
  const [subMin, setSubMin] = useState(String(sub?.min ?? -10));
  const [subMax, setSubMax] = useState(String(sub?.max ?? 10));
  const [subXo, setSubXo] = useState(String(sub?.f ?? 80));
  const [notes, setNotes] = useState(setup?.notes ?? "");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [shot, setShot] = useState<{ busy: boolean; text: string; error: boolean }>({ busy: false, text: "", error: false });
  const [subValue, setSubValue] = useState<number | null>(null);
  const ids = { tpl: useId(), step: useId(), width: useId() };

  function pickTemplate(key: string) {
    setTpl(key);
    const t = TEMPLATES[key];
    setRows(t.bands.length ? t.bands.map(toRow) : [toRow({}), toRow({})]);
    setMin(String(-t.range));
    setMax(String(t.range));
    setStep(String(t.step));
    const p = t.bands.find((b) => b.type === "peak");
    setWidth(String(p ? widthOf(p.q) : 1.4));
  }

  async function readShot(file: File | undefined) {
    if (!file) return;
    setShot({ busy: true, text: "Reading the screenshot… this can take up to a minute.", error: false });
    const form = new FormData();
    form.set("image", await shrink(file), "eq.jpg");
    let r: Awaited<ReturnType<typeof readEqAction>>;
    try {
      r = await readEqAction(form);
    } catch {
      r = { error: "Couldn't read that screenshot right now. Enter the bands by hand." };
    }
    const p = r.draft;
    if (!p) return setShot({ busy: false, text: r.error ?? "Couldn't read that screenshot. Enter the bands by hand.", error: true });
    setTpl("custom");
    setRows(p.bands.map((b) => toRow({ label: b.label.slice(0, 12), f: Math.max(20, Math.min(20000, b.f)), type: b.type, value: b.value })));
    if (!name.trim() && p.name) setName(p.name.slice(0, 80));
    const ext = Math.max(...p.bands.map((b) => Math.abs(b.value)), 6);
    setMin(String(p.min ?? -Math.max(10, ext)));
    setMax(String(p.max ?? Math.max(10, ext)));
    if (p.step && (STEPS as readonly number[]).includes(p.step)) setStep(String(p.step));
    setHasSub(p.sub ? "level" : "none");
    if (p.sub) {
      if (p.sub.min != null) setSubMin(String(p.sub.min));
      if (p.sub.max != null) setSubMax(String(p.sub.max));
      if (p.sub.crossover) setSubXo(String(p.sub.crossover));
      setSubValue(p.sub.value);
    } else setSubValue(null);
    const how = { high: "values printed on screen", medium: "read from slider positions", low: "rough estimate, check every value" }[p.confidence];
    setShot({
      busy: false,
      error: false,
      text:
        `Filled in ${p.bands.length} band${p.bands.length > 1 ? "s" : ""}${p.sub ? " and a sub" : ""} (${how}). Current values: ${p.bands.map((b) => `${b.label} ${fmtDb(b.value)}`).join(", ")}. They become a “From screenshot” preset.` +
        (p.min == null ? " The range wasn't visible, so check the lowest and highest settings." : "") +
        (p.unclear ? ` Note: ${p.unclear}` : ""),
    });
  }

  function setRow(key: number, patch: Partial<Row>) {
    setRows((rs) =>
      rs.map((r) => {
        if (r.key !== key) return r;
        const next = { ...r, ...patch };
        if (next.auto && ("f" in patch || "type" in patch)) next.label = autoLabel(Number(next.f), next.type);
        return next;
      }),
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const lo = Number(min);
    const hi = Number(max);
    const q = Number(width);
    if (!(lo < 0) || !(hi > 0)) return setError("Enter the lowest setting as a negative number and the highest as a positive number, for example −12 and 12.");
    const bands: (SetupBand & { value?: number })[] = [];
    for (const r of rows) {
      const f = Number(r.f);
      if (!(f >= 20 && f <= 20000)) return setError("Every band needs a frequency between 20 and 20000 Hz.");
      // Keep a measured width unless the width menu was changed.
      const keep = r.q && editing && widthOf(r.q) === q ? r.q : q;
      bands.push({ label: r.label.trim() || fmtHz(f), f, type: r.type, q: r.type === "peak" ? keep : 0.707, value: r.value });
    }
    if (!bands.length) return setError("Add at least one band.");
    bands.sort((a, b) => a.f - b.f);
    if (hasSub === "level") {
      const smin = Number(subMin);
      const smax = Number(subMax);
      const xo = Number(subXo);
      if (!(smin < 0) || !(smax > 0) || !(xo >= 40 && xo <= 200))
        return setError("For the sub, enter a negative lowest level, a positive highest level and a crossover between 40 and 200 Hz.");
      bands.unshift({ label: "Sub", f: xo, type: "lowshelf", q: 0.707, sub: true, min: smin, max: smax, value: subValue ?? undefined });
    }
    if (locked && bands.length !== setup!.bands.length)
      return setError(`This setup has rounds recorded, so it has to keep ${setup!.bands.length} bands (counting the sub). Make a new setup for a different layout.`);

    // Values read from a screenshot travel with their rows; they become what's on the speaker plus a preset.
    const shotValues = bands.some((b) => b.value != null) ? bands.map((b) => b.value ?? 0) : null;
    const clean: SetupBand[] = bands.map((b) => {
      const out: SetupBand & { value?: number } = { ...b };
      delete out.value;
      return out;
    });

    setPending(true);
    if (setup) {
      const changedCount = bands.length !== setup.bands.length;
      const doc = {
        ...setup,
        name: name.trim() || setup.name,
        bands: clean,
        min: lo,
        max: hi,
        step: Number(step),
        notes: notes.trim(),
        ...(changedCount ? { currentEq: clean.map(() => 0), presets: [] } : {}),
      };
      const r = await saveSetupAction(setup.id, doc);
      if (r.error) {
        setPending(false);
        return setError(r.error);
      }
      router.push(`/roomtune/${setup.id}`);
      router.refresh();
    } else {
      const doc = blankSetup(name.trim() || "New setup", clean, lo, hi, Number(step), notes.trim());
      if (shotValues) {
        const g = shotValues.map((v, i) => snap(doc, v, i));
        doc.currentEq = g.slice();
        doc.presets.push({ name: "From screenshot", gains: g, date: Date.now(), fit: false });
      }
      const r = await createSetupAction(doc);
      if (!r.id) {
        setPending(false);
        return setError(r.error ?? "Something went wrong and nothing was saved. Try again.");
      }
      router.push(`/roomtune/${r.id}`);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
      <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. TV soundbar · Den" maxLength={80} />

      {!editing && canReadScreenshots && (
        <div className="flex flex-col gap-2 rounded-[var(--radius-control)] border border-dashed border-line p-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">Fill from a screenshot</span>
            <input
              type="file"
              accept="image/*"
              disabled={shot.busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                void readShot(f);
              }}
              className="min-h-12 rounded-[var(--radius-control)] border border-line bg-field px-3 py-2.5 text-base file:mr-3 file:rounded-[var(--radius-control)] file:border-0 file:bg-wash file:px-3 file:py-1"
            />
          </label>
          <p role="status" aria-live="polite" className={`text-sm ${shot.error ? "text-red-800" : "text-soft"}`}>
            {shot.text || "A screenshot of the app's EQ screen fills in the bands, range and current values below for you to check."}
          </p>
        </div>
      )}

      {!editing && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.tpl} className="text-sm font-semibold">
            Start from
          </label>
          <select id={ids.tpl} value={tpl} onChange={(e) => pickTemplate(e.target.value)} className={control}>
            {Object.entries(TEMPLATES).map(([k, t]) => (
              <option key={k} value={k}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-semibold">Bands, low to high, with the labels your app shows</legend>
        <p className="text-sm text-soft">
          A bass shelf moves everything below its frequency, a peak moves the area around it, and a treble shelf moves everything above it. Use a shelf for bands
          labeled like “≤125” or “Bass”.
        </p>
        <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(4.5rem,1fr)_minmax(0,1.3fr)_auto] gap-2 text-sm text-soft" aria-hidden>
          <span>Label</span>
          <span>Hz</span>
          <span>Kind</span>
          <span className="w-11" />
        </div>
        <ul className="flex flex-col gap-2">
          {rows.map((r, i) => (
            <li key={r.key} className="grid grid-cols-[minmax(0,0.9fr)_minmax(4.5rem,1fr)_minmax(0,1.3fr)_auto] items-center gap-2">
              <input aria-label={`Band ${i + 1} label`} value={r.label} maxLength={12} onChange={(e) => setRow(r.key, { label: e.target.value, auto: false })} className={control} />
              <input
                aria-label={`Band ${i + 1} frequency in Hz`}
                type="number"
                inputMode="numeric"
                min={20}
                max={20000}
                value={r.f}
                onChange={(e) => setRow(r.key, { f: e.target.value })}
                className={`${control} tabular-nums`}
              />
              <select aria-label={`Band ${i + 1} kind`} value={r.type} onChange={(e) => setRow(r.key, { type: e.target.value as BandType })} className={control}>
                {Object.entries(KINDS).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
              {locked ? (
                <span className="w-11" />
              ) : (
                <button
                  type="button"
                  onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                  aria-label={`Remove band ${i + 1}`}
                  className="min-h-11 min-w-11 rounded-[var(--radius-control)] text-accent underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-accent"
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
        {locked ? (
          <p className="text-sm text-soft">This setup has rounds recorded, so bands can&apos;t be added or removed. Frequencies and kinds can still change.</p>
        ) : (
          <div className="max-w-xs">
            <Button variant="quiet" onClick={() => setRows((rs) => [...rs, toRow({})])}>
              Add band
            </Button>
          </div>
        )}
      </fieldset>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Lowest setting (dB)" type="number" inputMode="decimal" step={0.5} value={min} onChange={(e) => setMin(e.target.value)} />
        <Field label="Highest setting (dB)" type="number" inputMode="decimal" step={0.5} value={max} onChange={(e) => setMax(e.target.value)} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.step} className="text-sm font-semibold">
            Step
          </label>
          <select id={ids.step} value={step} onChange={(e) => setStep(e.target.value)} className={control}>
            {STEPS.map((s) => (
              <option key={s} value={s}>
                {s} dB
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.width} className="text-sm font-semibold">
          Band width
        </label>
        <select id={ids.width} value={width} onChange={(e) => setWidth(e.target.value)} className={control}>
          {WIDTHS.map((w) => (
            <option key={w.q} value={w.q}>
              {w.q === 1.4 && !editing ? "Not sure (medium, about 1 octave)" : w.label}
            </option>
          ))}
        </select>
        <p className="text-sm text-soft">How much of the spectrum each slider moves. After a flat round and an EQ round, Measure band width under Manage finds the real value.</p>
      </div>

      <div className="flex flex-col gap-3">
        <Choice
          legend="Subwoofer"
          name="sub"
          value={hasSub}
          onChange={setHasSub}
          options={[
            { value: "none", label: "No sub, or no level control" },
            { value: "level", label: "Sub with a level control" },
          ]}
        />
        {hasSub === "level" && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Sub lowest (dB)" type="number" step={0.5} value={subMin} onChange={(e) => setSubMin(e.target.value)} />
            <Field label="Sub highest (dB)" type="number" step={0.5} value={subMax} onChange={(e) => setSubMax(e.target.value)} />
            <Field label="Crossover (Hz)" type="number" step={10} min={40} max={200} value={subXo} onChange={(e) => setSubXo(e.target.value)} />
          </div>
        )}
      </div>

      <Field
        label="Turn off while measuring"
        value={notes}
        maxLength={300}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="e.g. night mode, dialogue boost, auto volume"
      />

      {error && <Alert>{error}</Alert>}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : editing ? "Save changes" : "Create setup"}
        </Button>
        <a
          href={setup ? `/roomtune/${setup.id}` : "/roomtune"}
          className="inline-flex min-h-12 items-center px-2 text-accent underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-accent"
        >
          Cancel
        </a>
      </div>
    </form>
  );
}
