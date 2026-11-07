/** Adaptive end-of-speech detection from microphone loudness (dBFS) samples. */
export function createSpeechDetector({ noSpeechMs = 15_000, silenceMs = 1_100, minSpeechMs = 200 } = {}) {
  let floor = -70;
  let calibrated = false;
  let speechStart = -1;
  let heard = false;
  let lastLoud = 0;
  return {
    push(db: number, at: number): { heard: boolean; stop: boolean } {
      const level = Math.max(-100, db);
      if (!calibrated) { floor = Math.min(floor === -70 ? level : floor, level); if (at >= 300) calibrated = true; return { heard, stop: false }; }
      const loud = level > Math.max(floor + 12, -62);
      if (!loud) floor = floor * 0.97 + level * 0.03;
      if (loud) {
        lastLoud = at;
        if (speechStart < 0) speechStart = at;
        if (at - speechStart >= minSpeechMs) heard = true;
      } else if (speechStart >= 0 && !heard && at - lastLoud > 300) speechStart = -1;
      if (heard && at - lastLoud >= silenceMs) return { heard, stop: true };
      if (!heard && at >= noSpeechMs) return { heard, stop: true };
      return { heard, stop: false };
    },
  };
}
