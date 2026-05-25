/**
 * Playback-rate → check-interval mapping.
 *
 * Lifted from the original SlideExtractor god-class so the lookup table is
 * a plain function the pipeline can own per instance.
 */

const SCALING_MAP: Readonly<{ [rate: number]: number }> = {
  0.5: 0.5,
  0.75: 0.75,
  0.8: 0.8,
  0.9: 0.9,
  1: 1,
  1.1: 1.1,
  1.15: 1.15,
  1.2: 1.2,
  1.25: 1.25,
  1.5: 1.5,
  1.75: 1.75,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 7,
  8: 8,
  9: 9,
  10: 10,
  11: 11,
  12: 12,
  13: 13,
  14: 13,
  15: 13,
  16: 13,
};

const MIN_INTERVAL_MS = 100;

export class IntervalTable {
  private table = new Map<number, number>();
  private baseInterval: number;

  constructor(baseInterval: number) {
    this.baseInterval = baseInterval;
    this.rebuild();
  }

  setBaseInterval(baseInterval: number): boolean {
    if (this.baseInterval === baseInterval) return false;
    this.baseInterval = baseInterval;
    this.rebuild();
    return true;
  }

  getBaseInterval(): number {
    return this.baseInterval;
  }

  getIntervalForRate(playbackRate: number): number {
    const interval = this.table.get(playbackRate);
    if (interval !== undefined) return interval;
    console.warn(`Unsupported playback rate: ${playbackRate}x, using base interval`);
    return this.baseInterval;
  }

  getStats(): { baseInterval: number; tableSize: number; entries: Array<{ rate: number; interval: number }> } {
    const entries: Array<{ rate: number; interval: number }> = [];
    this.table.forEach((interval, rate) => entries.push({ rate, interval }));
    entries.sort((a, b) => a.rate - b.rate);
    return { baseInterval: this.baseInterval, tableSize: this.table.size, entries };
  }

  private rebuild(): void {
    this.table.clear();
    Object.keys(SCALING_MAP).forEach(rateStr => {
      const rate = parseFloat(rateStr);
      const scalingFactor = SCALING_MAP[rate];
      const adjusted = Math.round(this.baseInterval / scalingFactor);
      this.table.set(rate, Math.max(MIN_INTERVAL_MS, adjusted));
    });
    console.log(
      `Interval table built for base=${this.baseInterval}ms:`,
      Array.from(this.table.entries()).map(([rate, interval]) => `${rate}x=${interval}ms`).join(', '),
    );
  }
}
