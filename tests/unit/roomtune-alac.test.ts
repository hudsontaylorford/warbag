import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AlacError, decode, demux } from "@/lib/roomtune/alac";

// Fixtures are 0.2 s of pink noise made with ffmpeg (made-up audio). Each
// .ch0.s32 file is ffmpeg's own decode of channel 0 as 32-bit PCM.
const dir = path.join(import.meta.dirname, "fixtures/roomtune");
const bytes = (name: string) => {
  const b = readFileSync(path.join(dir, name));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};
const reference = (name: string) => {
  const b = readFileSync(path.join(dir, name));
  return new Int32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
};

describe("Apple Lossless decoding", () => {
  it.each([
    ["mono16", 16, 1],
    ["stereo24", 24, 2],
  ])("decodes %s exactly like ffmpeg", (name, bitDepth, channels) => {
    const d = decode(bytes(`${name}.m4a`));
    expect(d).not.toBeNull();
    expect(d!.sampleRate).toBe(48000);
    expect(d!.bitDepth).toBe(bitDepth);
    expect(d!.channels).toBe(channels);
    const ref = reference(`${name}.ch0.s32`);
    expect(d!.channel.length).toBe(ref.length);
    let mismatches = 0;
    for (let i = 0; i < ref.length; i++) if (d!.channel[i] !== ref[i] / 2 ** 31) mismatches++;
    expect(mismatches).toBe(0);
  });

  it("returns null for a compressed (AAC) recording so the browser decodes it", () => {
    expect(demux(bytes("aac.m4a")).codec).toBe("mp4a");
    expect(decode(bytes("aac.m4a"))).toBeNull();
  });

  it("rejects something that isn't an MP4", () => {
    expect(() => decode(new TextEncoder().encode("not audio at all").buffer as ArrayBuffer)).toThrow(AlacError);
  });
});
