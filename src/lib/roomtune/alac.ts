/**
 * Minimal MP4 demuxer and Apple Lossless (ALAC) decoder for Voice Memos
 * recordings. Browsers can't all decode ALAC, so Room Tuner does it itself.
 * Returns channel 0 only, which is all the analysis needs.
 *
 * Ported from the standalone Room Tuner (alac.js) without changing the logic.
 */

type Box = { type: string; start: number; body: number; end: number };

export type AlacConfig = {
  frameLength: number;
  bitDepth: number;
  pb: number;
  mb: number;
  kb: number;
  channels: number;
  sampleRate: number;
};

export type Demuxed =
  | { codec: "alac"; cfg: AlacConfig; samples: [number, number][] }
  | { codec: string; cfg?: undefined; samples?: undefined };

export type Decoded = { channel: Float32Array; sampleRate: number; channels: number; bitDepth: number };

export class AlacError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

// ---------- MP4 ----------

function boxes(dv: DataView, start: number, end: number): Box[] {
  const out: Box[] = [];
  let p = start;
  while (p + 8 <= end) {
    let size = dv.getUint32(p);
    let hdr = 8;
    const type = String.fromCharCode(dv.getUint8(p + 4), dv.getUint8(p + 5), dv.getUint8(p + 6), dv.getUint8(p + 7));
    if (size === 1) {
      size = dv.getUint32(p + 8) * 4294967296 + dv.getUint32(p + 12);
      hdr = 16;
    } else if (size === 0) size = end - p;
    if (size < hdr || p + size > end) break;
    out.push({ type, start: p, body: p + hdr, end: p + size });
    p += size;
  }
  return out;
}

const child = (dv: DataView, b: Box, type: string) => boxes(dv, b.body, b.end).find((x) => x.type === type);

function path(dv: DataView, b: Box | undefined, types: string[]): Box | undefined {
  for (const t of types) {
    if (!b) return undefined;
    b = child(dv, b, t);
  }
  return b;
}

/** Find the first audio track and, if it is ALAC, its config and frame offsets. */
export function demux(buf: ArrayBuffer): Demuxed {
  const dv = new DataView(buf);
  const moov = boxes(dv, 0, buf.byteLength).find((b) => b.type === "moov");
  if (!moov) throw new AlacError("no_moov");
  for (const trak of boxes(dv, moov.body, moov.end).filter((b) => b.type === "trak")) {
    const mdia = child(dv, trak, "mdia");
    const hdlr = mdia && child(dv, mdia, "hdlr");
    if (!mdia || !hdlr || String.fromCharCode(...new Uint8Array(buf, hdlr.body + 8, 4)) !== "soun") continue;
    const stbl = path(dv, mdia, ["minf", "stbl"]);
    const stsd = stbl && child(dv, stbl, "stsd");
    if (!stbl || !stsd) throw new AlacError("no_sample_table");
    const entry = boxes(dv, stsd.body + 8, stsd.end)[0];
    if (!entry || entry.type !== "alac") return { codec: entry ? entry.type : "" };
    const cfgBox = boxes(dv, entry.body + 28, entry.end).find((b) => b.type === "alac");
    if (!cfgBox) throw new AlacError("no_cookie");
    const c = cfgBox.body + 4;
    const cfg: AlacConfig = {
      frameLength: dv.getUint32(c),
      bitDepth: dv.getUint8(c + 5),
      pb: dv.getUint8(c + 6),
      mb: dv.getUint8(c + 7),
      kb: dv.getUint8(c + 8),
      channels: dv.getUint8(c + 9),
      sampleRate: dv.getUint32(c + 20),
    };
    const stsz = child(dv, stbl, "stsz");
    const stsc = child(dv, stbl, "stsc");
    const stco = child(dv, stbl, "stco");
    const co64 = child(dv, stbl, "co64");
    if (!stsz || !stsc || (!stco && !co64)) throw new AlacError("no_sample_table");
    const fixed = dv.getUint32(stsz.body + 4);
    const count = dv.getUint32(stsz.body + 8);
    const sizes: number[] = [];
    for (let i = 0; i < count; i++) sizes.push(fixed || dv.getUint32(stsz.body + 12 + 4 * i));
    const offs: number[] = [];
    if (stco) {
      const n = dv.getUint32(stco.body + 4);
      for (let i = 0; i < n; i++) offs.push(dv.getUint32(stco.body + 8 + 4 * i));
    } else if (co64) {
      const n = dv.getUint32(co64.body + 4);
      for (let i = 0; i < n; i++)
        offs.push(dv.getUint32(co64.body + 8 + 8 * i) * 4294967296 + dv.getUint32(co64.body + 12 + 8 * i));
    }
    const sc: { first: number; per: number }[] = [];
    const nsc = dv.getUint32(stsc.body + 4);
    for (let i = 0; i < nsc; i++)
      sc.push({ first: dv.getUint32(stsc.body + 8 + 12 * i), per: dv.getUint32(stsc.body + 12 + 12 * i) });
    const samples: [number, number][] = [];
    let si = 0;
    for (let ch = 0; ch < offs.length && si < count; ch++) {
      let per = 0;
      for (const e of sc) if (e.first <= ch + 1) per = e.per;
      let p = offs[ch];
      for (let k = 0; k < per && si < count; k++) {
        samples.push([p, sizes[si]]);
        p += sizes[si];
        si++;
      }
    }
    return { codec: "alac", cfg, samples };
  }
  throw new AlacError("no_audio_track");
}

// ---------- bit reader ----------

class Bits {
  pos = 0;
  len: number;
  constructor(private u: Uint8Array) {
    this.len = u.length * 8;
  }
  left() {
    return this.len - this.pos;
  }
  /** Up to 32 bits, unsigned. */
  read(n: number) {
    let v = 0;
    for (let i = 0; i < n; i++) {
      const p = this.pos++;
      v = v * 2 + ((this.u[p >> 3] >> (7 - (p & 7))) & 1);
    }
    return v;
  }
  peek(n: number) {
    const p = this.pos;
    const v = this.read(n);
    this.pos = p;
    return v;
  }
  skip(n: number) {
    this.pos += n;
  }
  sread(n: number) {
    const v = this.read(n);
    return v >= 2 ** (n - 1) ? v - 2 ** n : v;
  }
}

const sext = (v: number, bits: number) => (bits >= 32 ? v | 0 : (v << (32 - bits)) >> (32 - bits));
const sgn = (v: number) => (v > 0 ? 1 : v < 0 ? -1 : 0);
const log2 = (v: number) => 31 - Math.clz32(v);

function decodeScalar(g: Bits, k: number, bps: number) {
  let x = 0;
  while (x < 9 && g.read(1) === 1) x++;
  if (x > 8) return g.read(bps);
  if (k !== 1) {
    const extra = g.peek(k);
    x = x * 2 ** k - x;
    if (extra > 1) {
      x += extra - 1;
      g.skip(k);
    } else g.skip(k - 1);
  }
  return x;
}

function rice(g: Bits, out: Int32Array, n: number, bps: number, mult: number, cfg: AlacConfig) {
  let history = cfg.mb;
  let signMod = 0;
  let i = 0;
  while (i < n) {
    let k = Math.min(log2((history >>> 9) + 3), cfg.kb);
    const x = decodeScalar(g, k, bps) + signMod;
    signMod = 0;
    out[i] = (x >>> 1) ^ -(x & 1);
    if (x > 0xffff) history = 0xffff;
    else history = history + x * mult - ((history * mult) >>> 9);
    if (history < 128 && i + 1 < n) {
      k = Math.min(7 - log2(history) + ((history + 16) >> 6), cfg.kb);
      const block = decodeScalar(g, k, 16);
      if (block > 0) {
        if (block >= n - i) throw new AlacError("bad_block");
        out.fill(0, i + 1, i + 1 + block);
        i += block;
      }
      if (block <= 0xffff) signMod = 1;
      history = 0;
    }
    i++;
  }
}

function lpc(
  err: Int32Array,
  out: Int32Array,
  n: number,
  bps: number,
  coefs: Int16Array | null,
  order: number,
  quant: number,
) {
  out[0] = err[0];
  if (n <= 1) return;
  if (!order) {
    for (let i = 1; i < n; i++) out[i] = err[i];
    return;
  }
  if (order === 31) {
    for (let i = 1; i < n; i++) out[i] = sext(out[i - 1] + err[i], bps);
    return;
  }
  if (!coefs) throw new AlacError("no_coefs");
  let i = 1;
  for (; i <= order && i < n; i++) out[i] = sext(out[i - 1] + err[i], bps);
  const half = 2 ** (quant - 1);
  const div = 2 ** quant;
  for (; i < n; i++) {
    const b = i - order - 1;
    const d = out[b];
    let val = 0;
    for (let j = 0; j < order; j++) val = (val + Math.imul(out[b + 1 + j] - d, coefs[j])) | 0;
    val = Math.floor((val + half) / div);
    let ev = err[i] | 0;
    out[i] = sext((val + d + ev) | 0, bps);
    const es = sgn(ev);
    if (es) {
      for (let j = 0; j < order && Math.imul(ev, es) > 0; j++) {
        let v = (d - out[b + 1 + j]) | 0;
        const s = sgn(v) * es;
        coefs[j] -= s;
        v = Math.imul(v, s);
        ev = (ev - Math.imul(v >> quant, j + 1)) | 0;
      }
    }
  }
}

function decodeFrame(u8: Uint8Array, cfg: AlacConfig, outs: Int32Array[][]) {
  const g = new Bits(u8);
  let ch = 0;
  let frameSamples = 0;
  while (g.left() >= 3) {
    const el = g.read(3);
    if (el === 7) break;
    if (el > 1 && el !== 3) throw new AlacError("unsupported_element");
    const channels = el === 1 ? 2 : 1;
    g.skip(4);
    g.skip(12);
    const hasSize = g.read(1);
    const extraBits = g.read(2) << 3;
    const bps = cfg.bitDepth - extraBits + channels - 1;
    const compressed = !g.read(1);
    const n = hasSize ? g.read(32) : cfg.frameLength;
    const buf = [new Int32Array(n), new Int32Array(n)];
    const extra = [new Int32Array(n), new Int32Array(n)];
    let shift = 0;
    let weight = 0;
    let eb = extraBits;
    if (compressed) {
      shift = g.read(8);
      weight = g.read(8);
      const pt: number[] = [];
      const q: number[] = [];
      const hm: number[] = [];
      const ord: number[] = [];
      const cf: Int16Array[] = [];
      for (let c = 0; c < channels; c++) {
        pt[c] = g.read(4);
        q[c] = g.read(4);
        hm[c] = g.read(3);
        ord[c] = g.read(5);
        cf[c] = new Int16Array(32);
        for (let i = ord[c] - 1; i >= 0; i--) cf[c][i] = g.sread(16);
      }
      if (eb) for (let i = 0; i < n; i++) for (let c = 0; c < channels; c++) extra[c][i] = g.read(eb);
      for (let c = 0; c < channels; c++) {
        const e = new Int32Array(n);
        rice(g, e, n, bps, (hm[c] * cfg.pb) >> 2, cfg);
        if (pt[c] === 15) lpc(e, e, n, bps, null, 31, 0);
        lpc(e, buf[c], n, bps, cf[c], ord[c], q[c]);
      }
    } else {
      for (let i = 0; i < n; i++) for (let c = 0; c < channels; c++) buf[c][i] = g.sread(cfg.bitDepth);
      eb = 0;
    }
    if (channels === 2 && weight) {
      for (let i = 0; i < n; i++) {
        let a = buf[0][i];
        let b = buf[1][i];
        a = (a - (Math.imul(b, weight) >> shift)) | 0;
        b = (b + a) | 0;
        buf[0][i] = b;
        buf[1][i] = a;
      }
    }
    if (eb) for (let c = 0; c < channels; c++) for (let i = 0; i < n; i++) buf[c][i] = (buf[c][i] << eb) | extra[c][i];
    for (let c = 0; c < channels; c++) if (outs[ch + c]) outs[ch + c].push(buf[c]);
    ch += channels;
    frameSamples = n;
  }
  return frameSamples;
}

/** Decode an .m4a file's first channel. Returns null if it is not ALAC (use the browser's decoder then). */
export function decode(buf: ArrayBuffer): Decoded | null {
  const d = demux(buf);
  if (d.codec !== "alac" || !d.cfg) return null;
  const { cfg, samples } = d;
  const parts: Int32Array[][] = [[]];
  const u8 = new Uint8Array(buf);
  let total = 0;
  for (const [off, size] of samples) total += decodeFrame(u8.subarray(off, off + size), cfg, parts);
  const out = new Float32Array(total);
  const scale = 1 / 2 ** (cfg.bitDepth - 1);
  let p = 0;
  for (const a of parts[0]) {
    for (let i = 0; i < a.length; i++) out[p + i] = a[i] * scale;
    p += a.length;
  }
  return { channel: out, sampleRate: cfg.sampleRate, channels: cfg.channels, bitDepth: cfg.bitDepth };
}
