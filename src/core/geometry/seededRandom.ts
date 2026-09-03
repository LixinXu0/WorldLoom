export type RandomSource = {
  next: () => number;
  range: (min: number, max: number) => number;
  int: (min: number, max: number) => number;
};

export function seededRandom(seed: number): RandomSource {
  let state = seed >>> 0;
  return {
    next: () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    range(min: number, max: number) {
      return min + this.next() * (max - min);
    },
    int(min: number, max: number) {
      return Math.floor(this.range(min, max + 1));
    },
  };
}
