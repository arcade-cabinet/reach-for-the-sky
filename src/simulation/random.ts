export type RandomSource = () => number;

const LCG_MULTIPLIER = 1_664_525;
const LCG_INCREMENT = 1_013_904_223;
const UINT_RANGE = 0x1_0000_0000;

export function createSeededRandom(seed: number): RandomSource {
  let state = seed >>> 0;
  return () => {
    state = nextRandomSeed(state);
    return seedToUnit(state);
  };
}

export function nextRandomSeed(seed: number): number {
  return (seed * LCG_MULTIPLIER + LCG_INCREMENT) >>> 0;
}

export function seedToUnit(seed: number): number {
  return (seed >>> 0) / UINT_RANGE;
}

export function hashToUnit(input: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619) >>> 0;
  }
  return seedToUnit(hash);
}

let idCounter = 0;

export function generateId(prefix = 'id'): string {
  idCounter += 1;
  return `${prefix}-${idCounter.toString(36)}`;
}

export function resetIdsForTests(): void {
  idCounter = 0;
}
