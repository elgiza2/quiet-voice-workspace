/** Cartesia final events are text deltas, including partial words and whitespace. */
export function transcriptText(deltas: string[]) { return deltas.join("").trim(); }

/** Carry fractional samples across microphone callbacks instead of dropping each block's tail. */
export function createPcmResampler(fromRate: number, toRate = 16000) {
  const ratio = fromRate / toRate;
  let weight = 0, sum = 0;
  return {
    reset() { weight = 0; sum = 0; },
    push(input: Float32Array): Int16Array<ArrayBuffer> {
      const values: number[] = [];
      for (const sample of input) {
        let remaining = 1;
        while (remaining > 1e-9) {
          const part = Math.min(remaining, ratio - weight);
          sum += sample * part; weight += part; remaining -= part;
          if (weight >= ratio - 1e-9) {
            const value = Math.max(-1, Math.min(1, sum / ratio));
            values.push(Math.round(value * (value < 0 ? 32768 : 32767)));
            weight = 0; sum = 0;
          }
        }
      }
      return new Int16Array(values);
    },
  };
}