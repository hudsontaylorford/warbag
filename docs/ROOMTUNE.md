# Room Tuner

Measure a speaker in its room with two phones, and get slider values for the speaker's own EQ app. Phone A plays pink noise through the speaker; Phone B records 30 seconds at a few spots; the page analyzes the recordings, compares the room to a target curve and fits the speaker's own EQ bands to close the gap. Works with any EQ layout: graphic, shelf, bass/treble, with or without a sub.

Built as a standalone page in November 2026 and moved into warbag on 2026-11-23 (decision in DECISIONS.md). This file is Room Tuner's own README, measurement notes and roadmap in one place; warbag's ROADMAP.md only points here.

## Where the code is

| File | What it is |
|---|---|
| `src/lib/roomtune/dsp.ts` | Pink noise, FFT, analysis, biquad model, target curve, fit. Pure; runs in the browser and tests. |
| `src/lib/roomtune/alac.ts` | MP4 demuxer and Apple Lossless decoder (Chrome and Firefox can't decode ALAC). Bit-exact vs ffmpeg. |
| `src/lib/roomtune/setup.ts` | The Setup document, templates, the analysis behind the result panel, measure band width, and `cleanSetup` (the server's check on every save and import). |
| `src/lib/roomtune/recordings.ts` | Reads uploaded recordings in the browser. Audio never leaves the device. |
| `src/lib/roomtune/setups.ts` | Server: who may open, save, import, delete and link a setup. |
| `src/lib/roomtune/eq-ai.ts` | Server: reads an EQ screenshot with Claude (the image isn't kept). |
| `src/app/roomtune/` | The pages. `/rt/[token]` is a setup's view link. |
| `tests/unit/roomtune-*.test.ts`, `tests/db/roomtune.test.ts`, `e2e/roomtune.spec.ts` | Tests; `tests/support/roomtune.ts` simulates rooms. |

## Data

One row per setup in `roomtune_setups`, the setup itself as one JSON document: bands (low to high; a sub first if there is one), range and step, what's on the speaker now, target settings, position, rounds (each with the EQ that was on during it, the mic, level, and one 55-number spectrum per recording) and presets. Raw audio is never stored. Older exports with a single `measurement` or a round-level `levels` are read as one recording.

## How a measurement works

1. **Signal.** Phone A plays periodic pink noise (exactly −3 dB/octave, 20 Hz to 20 kHz) through the speaker.
   Pink noise has equal energy in every fraction of an octave, so a perfectly flat system records flat on a
   fractional-octave grid. Latency doesn't matter, which is why Bluetooth and AirPlay are fine.
2. **Recording.** Phone B records 30 s per spot in Voice Memos (or any WAV/MP3/M4A). Several spots make one *round*.
3. **Analysis** (`src/lib/roomtune/dsp.ts`, `analyze`): 16384-point Hann-windowed FFT frames with 50% overlap. Frames more than
   4 dB from the median level are dropped (volume jumps, bumps). Power is summed into a 1/6-octave grid from
   31 Hz to 16 kHz and normalized to the 250 Hz–2 kHz average. Files in a round are averaged, weighted by length.
4. **Room estimate.** The EQ that was on the speaker during the round is subtracted, using the band model.
5. **Target.** A gentle downward tilt (default −0.8 dB/octave), a bass shelf (+2 dB at 105 Hz) and a treble shelf
   (0 dB at 6 kHz). Adjustable on the page.
6. **Fit** (`dsp.ts`, `fit`): weighted least squares with box constraints (coordinate descent), one gain per band
   plus a free overall level. Bands are modeled as RBJ biquads (low shelf, peak, high shelf). Narrow dips more than
   3 dB below the local average get 30% weight, because EQ can't fill room cancellations. A small penalty keeps
   gains modest. Results are rounded to the app's step and clamped to each band's range and the max-boost setting.
7. **Phone-mic caution.** With the iPhone mic, frequencies below 150 Hz get 20% weight and bands at or below 160 Hz
   are held to +2 dB, because phone mics under-read deep bass. The good-fit score then starts at 200 Hz.
8. **Rounds converge.** After a round recorded with EQ on, suggestions move only halfway toward the new fit, so
   rounds settle instead of overshooting. "Good fit" means every change is ≤1 dB, or the round is ≤1.5 dB RMS off target.

## Known limits

- **Phone mics.** iPhone mics roll off deep bass and are processed by iOS. Bass readings below ~150 Hz are
  approximate. A calibrated USB mic with its correction file (roadmap) fixes this.
- **Band shapes are models.** Each app's EQ is approximated with standard filters. The JBL One app's peak
  width was measured (see Measurement notes below); other apps start at "medium" until measured with *Measure band width*.
- **Room modes.** Narrow bass peaks (like a 50–63 Hz boom) and nulls depend on position. Broad EQ bands can only
  trade them off; speaker placement fixes them.
- **Volume-dependent EQ.** Many smart speakers change their own EQ with volume. Compare rounds only at the same level.

## Measurement notes

Findings from building and using the tool on a JBL Authentics 500 in a living room, November 2026.

### JBL One app EQ (Authentics 500)

- 7 bands: ≤125, 250, 500, 1k, 2k, 4k, ≥8k. Range ±12 dB in 1 dB steps (the app shows the value while dragging).
- **Peak bands are narrow: about half an octave (Q ≈ 3).** Measured by comparing a flat round with two EQ'd rounds
  recorded from the same tripod spot. A medium-width model (Q 1.2) mismatched the measured change by 1.85 dB RMS;
  Q 3 by 1.54 dB. Example: +4 at 1k raised ~890 Hz by about 5 dB but barely moved 1.4 kHz.
- With the narrow model, slider amounts are roughly honest (measured effect ≈ 80–95% of the number).
- The ≤125 and ≥8k shelves weren't exercised enough to measure. They're modeled at 150 Hz and 6.5 kHz.
- With the wrong (wide) model, suggestions crept further each round (1k: +3, then +4, then +5). The narrow model plus
  half-step rounds fixed it.
- The app's share QR code holds only an ID for JBL's servers, not the EQ values. Presets can't be generated as QR codes.

### The room (Authentics 500, living room)

- Bass peak around 50–63 Hz, roughly 8 dB above target. Narrow, so the ≤125 shelf can only trade it off against 80–125 Hz.
  Placement (away from the wall or corner) is the real fix.
- A dip near 150–160 Hz (room null, position-dependent). EQ can't fill it.
- A broad dip around 1 kHz and an excess around 3–4 kHz, both corrected well by the 1k and 4k bands.
- Off-target from 200 Hz to 10 kHz: 2.3 dB flat, 2.0 dB after Round 1 fit, 1.05 dB after Round 2 fit.
- Final preset: **Round 2 fit** 0, +1, −1, +4, −2, −6, +1.
- Also saved: **Extreme room fix** −3, −2, −1, +3, −3, −7, +4 (bass cut for the boom, more treble) and
  **Background / dinner** 0, +1, 0, +2, −3, −8, −2 (soft top, out of the way of conversation). Both predicted, not yet measured.

### Recording

- Voice Memos saves `.m4a` for both Compressed (AAC) and Lossless (ALAC).
- AirDropping recordings from Voice Memos delivered Compressed files even when recorded as Lossless.
  Uploading the originals from the recording phone kept them Lossless.
- **Lossless vs Compressed made no practical difference:** 0.05 dB RMS from 200 Hz to 10 kHz, ~0.15 dB at 10–16 kHz.
- Desktop Chrome can't decode ALAC, hence the built-in decoder (`src/lib/roomtune/alac.ts`).
- Settings that must be off: Spatial Audio recording (use Mono/Stereo), Voice Isolation, Enhance Recording, Studio Voice.
- Phone laid flat on a table or a wide stack of books caused a false dip near 1 kHz (reflection off the surface
  right next to the mic). A tripod fixed it.
- Clips of 2 and 12 seconds skewed an early round; the app now skips under 10 s and weights by length.

### iPhone microphone

- Studio Six Digital (AudioTools) reports the internal mic's low-frequency roll-off as steep, on the order of
  24 dB/octave from about 250 Hz, unless an app turns off the filter (measurement mode). Voice Memos is designed
  for music and probably filters less, but bass readings should be treated as approximate.
- A web page can ask Safari to disable echo cancellation, noise suppression and auto gain, but can't select iOS
  measurement mode. A browser recorder won't beat Voice Memos on bass accuracy.
- No public per-model iPhone mic response data was found, so a model selector wasn't built.

### Level

- The analysis is level-independent (it compares frequencies against each other), but speakers often change their
  own EQ with volume, ears hear less bass at low volume, and quiet recordings pick up room noise.
- Standard used: set the speaker volume so a meter app (NIOSH SLM, A-weighting) reads about 75 dB at the seat,
  and record the volume number. Measure a separate round at ~55 dB to tune a quiet preset.

## Room Tuner's own roadmap

Each item needs Hudson's go. Roughly in order of value; each says what it fixes. Carried over from the standalone version's ROADMAP.md, adjusted for warbag.

### Done

- Standalone (Nov 2026): rounds, fixed spots, level standard (75 dB), Lossless decoding in any browser, setup builder
  with sub support, measured band width, screenshot import, collapsible instructions.
- In warbag (2026-11-23, PR 57): native app at /roomtune with warbag's sign-in and look; setups saved on the server per
  person; access per person under People → Apps; a view-only link per setup; import of the standalone export file;
  "Fill from a screenshot" through warbag's own Claude key.

### Next

1. **Unprocessed iPhone recorder.** See the section below. Biggest accuracy win left for phone-only users.
2. **Phone mic correction from one calibrated session.** Record the same pink noise at the same spot with the iPhone
   and with a calibrated USB mic (UMIK-1/2) once. The difference, smoothed, is that phone's correction curve; save it per
   device and subtract it from every later phone recording. Works with today's upload flow, no native app needed.
   Also: load a calibrated mic's own correction file (text: frequency, dB) for rounds recorded with it, and lift the
   phone-mic bass caps for corrected rounds. Fixes the ≤125 / sub uncertainty.
3. ~~Mount API for embedding~~: no longer needed; Room Tuner is a native warbag app.
4. **Compare presets.** One chart with the predicted response of every saved preset (and the measured rounds), so
   "Extreme" vs "Background" vs "Round 2 fit" is a glance instead of a table. Pure front end; all data exists.
5. **Quick check.** A one-recording mode to confirm a preset still fits (after moving furniture, or months later),
   reported as "still within 1.5 dB" or "re-tune suggested", without starting a new set of rounds.
6. **Level-aware presets.** Tag rounds as loud or quiet from the meter reading, and fit quiet presets from quiet
   rounds (with a loudness-compensation target option) instead of hand-shaping them.
7. **Screenshot import, next steps.** "Update from screenshot" on an existing setup (read the current values into a
   round's EQ or a preset, so nobody types slider values), and a small library of known apps (band frequencies,
   shelf vs peak, measured widths) so a recognized app skips guessing.
8. **Measure shelf frequencies too.** Extend *Measure band width* to fit the low and high shelf corner frequencies
   when rounds move those sliders, and fit width per band instead of one width for all peaks.
9. **First-run guide.** A short walkthrough (setup → level → 3 spots → upload) for someone who has never measured
   anything, then it gets out of the way. The instructions are already in collapsible panels to build from.

### Unprocessed iPhone recorder

**Can the browser do it? No, not reliably.** A web page can ask Safari to turn off echo cancellation, noise
suppression and auto gain (`getUserMedia` constraints), but it can't choose iOS's *measurement* audio mode, which is
what removes the built-in mic's bass filter and voice tuning. WebKit also has an open bug (still present on iOS 26)
where capture quality drops once the mic is in use. So in-browser recording is a convenience (no AirDrop, guided
spots), not an accuracy upgrade. It's still worth building on your own domain for the workflow; record WAV, check
`track.getSettings()`, and label those rounds as "browser mic".

**What does get unprocessed audio: a small native iOS app.**
- Audio session: category `.playAndRecord`, mode `.measurement` (Apple's mode that minimizes system processing),
  built-in mic as input, record 48 kHz WAV.
- **One-phone measuring becomes possible:** the same app plays the pink noise to the speaker over Bluetooth
  (`.allowBluetoothA2DP`) while recording with its own mic. To verify: some speakers with a built-in mic may pull
  iOS into hands-free Bluetooth (low quality); AirPlay output may not be available while recording.
- Guided flow: "Spot 1 of 3, recording 30 s…", then upload the round straight to Warbag's API (same Setup JSON),
  or hand the WAVs to the share sheet.
- Distribution: free on your own phone via Xcode (re-sign every 7 days), or the Apple Developer Program ($99/year)
  for TestFlight and other people's phones. An **App Clip** could launch from a link or QR code without installing.

**Ways to build it, smallest first:**
1. Recorder-only Swift app (one screen, ~300 lines): measurement-mode WAV recording plus pink noise playback.
   The web app stays the brain; the app just produces clean files.
2. Capacitor wrapper around the web app with one native plugin for measurement-mode recording. One codebase, the
   same UI everywhere, native audio only where it matters.
3. Full native app. Only if Warbag itself goes native.

**Pair it with the phone-correction item above:** measurement mode removes processing, but the mic capsule still
isn't flat. A one-time calibration against a UMIK turns that phone into a usable measurement mic.

### Later

- **Sweep measurement** (log sine sweep with deconvolution) for impulse response, phase and decay time (RT60).
  Needs sync-tolerant capture; best with the native recorder.
- **Per-spot view**: show each spot's curve so position-dependent problems (nulls, modes) are visible, and flag
  spots that disagree with the rest.
- **Placement advisor**: estimate room-mode frequencies from room dimensions and distance to walls, and suggest
  moves before reaching for EQ. Your 50–63 Hz boom is the textbook case.
- **Export and share**: download a setup as JSON and print a one-page summary of a preset. (Import and view links are done.)
- **Multiple speakers per room**: stereo pairs or speaker + sub as linked setups, with level matching.
- **Target library**: save and reuse target curves (room curve, flat, bass-heavy, vocal).
- **Undo for deletes** of rounds and presets.

## Product decisions to revisit

- Default target tilt (−0.8 dB/octave) and +2 dB bass shelf came from common in-room curves, not from listening tests here.
- Half-step damping after EQ'd rounds trades speed for stability; with a measured band model it could be relaxed.
- The phone-mic bass cap (+2 dB) is conservative on purpose. Revisit once calibrated-mic data exists to compare.

## Sources for the recorder notes

- WebKit bug 311451 (capture quality after getUserMedia, iOS 26): https://bugs.webkit.org/show_bug.cgi?id=311451
- WebKit bug 218012 (processing constraints and routing on iOS): https://bugs.webkit.org/show_bug.cgi?id=218012
- Studio Six Digital on the iPhone mic's low-frequency filter: https://studiosixdigital.com/audio-hardware/generic-audio-hardware/iphone_3gs_microphone/
