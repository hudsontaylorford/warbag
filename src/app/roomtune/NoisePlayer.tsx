"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { pinkNoise } from "@/lib/roomtune/dsp";
import { audioContext } from "@/lib/roomtune/recordings";

const dbToGain = (db: number) => Math.pow(10, (db + 20) / 20);

/**
 * Plays looping pink noise until stopped, with a level control. Needs a
 * tap to start (browser autoplay rules) and keeps the screen awake.
 */
export function NoisePlayer() {
  const [playing, setPlaying] = useState(false);
  const [secs, setSecs] = useState(0);
  const [level, setLevel] = useState(-20);
  const [error, setError] = useState("");
  const nodes = useRef<{ src: AudioBufferSourceNode; gain: GainNode; tick: number; lock: WakeLockSentinel | null } | null>(null);
  const buffer = useRef<AudioBuffer | null>(null);

  function stop() {
    const n = nodes.current;
    if (!n) return;
    const c = audioContext();
    try {
      n.gain.gain.setTargetAtTime(0, c.currentTime, 0.05);
      const src = n.src;
      setTimeout(() => {
        try {
          src.stop();
        } catch {}
      }, 250);
    } catch {}
    clearInterval(n.tick);
    n.lock?.release().catch(() => {});
    nodes.current = null;
    setPlaying(false);
    setSecs(0);
  }

  useEffect(() => stop, []);

  async function start() {
    setError("");
    try {
      const nav = navigator as Navigator & { audioSession?: { type: string } };
      if (nav.audioSession) nav.audioSession.type = "playback";
    } catch {}
    try {
      const c = audioContext();
      await c.resume().catch(() => {});
      if (!buffer.current) {
        const n = 1 << 18;
        buffer.current = c.createBuffer(1, n, c.sampleRate);
        buffer.current.getChannelData(0).set(pinkNoise(c.sampleRate, n, 0.1));
      }
      const gain = c.createGain();
      gain.gain.value = 0;
      gain.connect(c.destination);
      const src = c.createBufferSource();
      src.buffer = buffer.current;
      src.loop = true;
      src.connect(gain);
      src.start();
      gain.gain.setTargetAtTime(dbToGain(level), c.currentTime, 0.15);
      const t0 = Date.now();
      const tick = window.setInterval(() => setSecs(Math.floor((Date.now() - t0) / 1000)), 250);
      let lock: WakeLockSentinel | null = null;
      try {
        lock = (await navigator.wakeLock?.request("screen")) ?? null;
      } catch {}
      nodes.current = { src, gain, tick, lock };
      setPlaying(true);
    } catch {
      setError("This browser couldn't play the noise. Try Safari or Chrome, and turn off Silent Mode.");
    }
  }

  function changeLevel(v: number) {
    setLevel(v);
    const n = nodes.current;
    if (n) n.gain.gain.setTargetAtTime(dbToGain(v), audioContext().currentTime, 0.05);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4">
        <div className="w-full sm:w-auto">
          <Button onClick={playing ? stop : start}>{playing ? "Stop" : "Play pink noise"}</Button>
        </div>
        <span className="text-2xl font-semibold tabular-nums" aria-label="Playing time">
          {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")}
        </span>
        <label className="flex min-w-48 flex-1 flex-col gap-1 text-sm">
          <span className="flex justify-between">
            <span className="font-semibold">Signal level</span>
            <span className="tabular-nums text-soft">−{Math.abs(level)} dBFS</span>
          </span>
          <input type="range" min={-32} max={-12} step={1} value={level} onChange={(e) => changeLevel(Number(e.target.value))} className="min-h-11 accent-ink" />
        </label>
      </div>
      {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
      <p className="text-sm text-soft">No sound? Turn off Silent Mode. Keep this screen open; the noise loops until you stop it.</p>
    </div>
  );
}
