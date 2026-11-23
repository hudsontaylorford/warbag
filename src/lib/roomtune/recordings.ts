/**
 * Turns uploaded recordings into spectra, in the browser. Audio never
 * leaves the device: only the 55-number result per file is saved.
 * Apple Lossless is decoded here (Chrome and Firefox can't); everything
 * else goes through the browser's own decoder.
 */
import { AnalysisError, analyze } from "./dsp";
import { decode as decodeAlac, demux } from "./alac";
import type { RoundFile } from "./setup";

let ctx: AudioContext | null = null;
export function audioContext(): AudioContext {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
  }
  return ctx;
}

function browserDecode(buf: ArrayBuffer): Promise<AudioBuffer> {
  return new Promise((resolve, reject) => {
    const p = audioContext().decodeAudioData(buf, resolve, reject);
    if (p && typeof p.then === "function") p.then(resolve, reject);
  });
}

function codecOf(buf: ArrayBuffer, name: string): string {
  if (/\.wav$/i.test(name)) return "WAV";
  try {
    const d = demux(buf);
    return d.codec === "alac" ? "Lossless" : d.codec === "mp4a" ? "Compressed" : "";
  } catch {
    return "";
  }
}

/** Analyzes each file; returns the usable ones and plain notes about the rest. */
export async function analyzeFiles(files: File[], onProgress: (text: string) => void): Promise<{ results: RoundFile[]; problems: string[] }> {
  const results: RoundFile[] = [];
  const problems: string[] = [];
  for (const [i, f] of files.entries()) {
    onProgress(`Analyzing ${i + 1} of ${files.length}…`);
    await new Promise((r) => setTimeout(r, 30));
    let codec = "";
    try {
      const raw = await f.arrayBuffer();
      codec = codecOf(raw, f.name);
      let pcm: { x: Float32Array; sr: number } | null = null;
      if (codec === "Lossless") {
        try {
          const d = decodeAlac(raw);
          if (d) pcm = { x: d.channel, sr: d.sampleRate };
        } catch {
          pcm = null;
        }
      }
      if (!pcm) {
        const ab = await browserDecode(raw.slice(0));
        pcm = { x: ab.getChannelData(0), sr: ab.sampleRate };
      }
      const r = analyze(pcm.x, pcm.sr);
      const keptPct = Math.round((r.kept / r.total) * 100);
      if (r.seconds < 10) {
        problems.push(`${f.name} is only ${Math.round(r.seconds)} seconds, so it was skipped. Record at least 30 seconds.`);
        continue;
      }
      results.push({
        name: f.name.slice(0, 120),
        seconds: Math.round(r.seconds),
        keptPct,
        codec,
        rec: Math.round(r.medDb * 10) / 10,
        levels: r.levels.map((v) => Math.round(v * 100) / 100),
      });
      if (r.seconds < 25) problems.push(`${f.name} is short. 30 seconds gives a steadier result.`);
      if (keptPct < 60) problems.push(`${f.name} had a lot of level jumps, so much of it was skipped. Record again if the speaker volume was changing.`);
      if (r.peakDb > -1) problems.push(`${f.name} may be clipping. Turn the speaker down a little.`);
      if (codec === "Compressed")
        problems.push(`${f.name} was recorded as Compressed. That's fine for this, but Lossless is a little more accurate. The setting is on the phone that recorded.`);
    } catch (err) {
      const code = err instanceof AnalysisError ? err.code : "";
      problems.push(
        code === "silent"
          ? `${f.name} is nearly silent. Check the speaker was playing.`
          : code === "too_short"
            ? `${f.name} is too short to analyze.`
            : `Couldn't read ${f.name}${codec ? ` (${codec})` : ""}. Make sure it's a Voice Memos recording in Mono or Stereo, not Spatial Audio. If it still fails, try uploading it from the iPhone in Safari.`,
      );
    }
  }
  return { results, problems };
}
