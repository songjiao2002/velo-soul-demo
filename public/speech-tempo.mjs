// Apply the same tempo increase to each character's existing delivery.
export const SPEECH_TEMPO = 1.16;

export function characterRate(soul) {
  return soul === 'mori' ? 0.94 : soul === 'bori' ? 1.04 : 1;
}

export function setMediaTempo(audio, baseRate = 1) {
  audio.preservesPitch = true;
  audio.playbackRate = baseRate * SPEECH_TEMPO;
}

// Web Audio buffer sources change pitch when sped up. Remove short intervals
// at matching waveform phases instead. State spans packets so a network
// boundary cannot introduce a click. The initial samples pass immediately.
export class SpeechTempo {
  constructor(rate) {
    this.hop = Math.round(rate * 0.048);
    this.overlap = Math.round(rate * 0.012);
    this.search = Math.round(rate * 0.008);
    this.stride = Math.max(1, Math.round(rate / 8000));
    this.target = this.hop * (SPEECH_TEMPO - 1);
    this.maxSkip = Math.ceil(2 * this.target + this.search);
    this.untilSplice = this.hop;
    this.remainder = new Float32Array(0);
    this.debt = 0;
  }

  bestSkip(samples, start) {
    const target = Math.round(this.target + this.debt);
    const min = Math.max(1, target - this.search);
    const max = Math.min(this.maxSkip, target + this.search);
    let best = Math.max(min, Math.min(max, target)), bestScore = -Infinity;
    const score = skip => {
      let cross = 0, power = 0;
      for (let i = 0; i < this.overlap; i += this.stride) {
        const a = samples[start + i], b = samples[start + skip + i];
        cross += a * b;
        power += a * a + b * b;
      }
      const distance = (skip - target) / this.search;
      return (power > 1e-10 ? 2 * cross / power : 1) - 0.12 * distance * distance;
    };
    const consider = skip => {
      const value = score(skip);
      if (value > bestScore) { best = skip; bestScore = value; }
    };
    consider(best);
    for (let skip = min; skip <= max; skip += this.stride) consider(skip);
    const coarse = best;
    for (let skip = Math.max(min, coarse - this.stride + 1); skip <= Math.min(max, coarse + this.stride - 1); skip++) consider(skip);
    this.debt = Math.max(-this.target, Math.min(this.target, this.debt + this.target - best));
    return best;
  }

  push(packet, final = false) {
    let samples = packet;
    if (this.remainder.length) {
      samples = new Float32Array(this.remainder.length + packet.length);
      samples.set(this.remainder);
      samples.set(packet, this.remainder.length);
      this.remainder = new Float32Array(0);
    }
    const output = new Float32Array(samples.length);
    let read = 0, written = 0;
    while (read < samples.length) {
      if (this.untilSplice) {
        const size = Math.min(this.untilSplice, samples.length - read);
        output.set(samples.subarray(read, read + size), written);
        read += size; written += size; this.untilSplice -= size;
      } else if (samples.length - read >= this.overlap + this.maxSkip) {
        const skip = this.bestSkip(samples, read);
        for (let i = 0; i < this.overlap; i++) {
          const fade = i / (this.overlap - 1);
          output[written++] = samples[read + i] * (1 - fade) + samples[read + skip + i] * fade;
        }
        read += skip + this.overlap;
        this.untilSplice = this.hop - this.overlap;
      } else {
        if (final) {
          output.set(samples.subarray(read), written);
          written += samples.length - read;
        } else {
          this.remainder = samples.slice(read);
        }
        break;
      }
    }
    return output.subarray(0, written);
  }
}

export function fasterSpeechBuffer(context, buffer) {
  // The synthesized speech and all bundled character lines are mono.
  if (buffer.numberOfChannels !== 1 || !buffer.length) return buffer;
  const samples = new SpeechTempo(buffer.sampleRate).push(buffer.getChannelData(0), true);
  const rendered = context.createBuffer(1, samples.length, buffer.sampleRate);
  rendered.getChannelData(0).set(samples);
  return rendered;
}
