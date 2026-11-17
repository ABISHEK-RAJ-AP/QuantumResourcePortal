export const FRIDGE_SCROLL_LENGTH_VH = 300;
export const FRIDGE_GAP = 34;

export const FRIDGE_STAGES = [
  {
    id: 'room',
    name: 'Room-temperature flange',
    temperature: '300 K',
    cableCount: 48,
    radius: 132,
    assembledY: 68,
    color: '#d76b4f',
    copy: 'Vacuum lid and bulkhead feedthroughs carry control and readout lines into the cryostat.',
  },
  {
    id: 'fifty',
    name: '50 K radiation shield',
    temperature: '≈ 50 K',
    cableCount: 48,
    radius: 112,
    assembledY: 104,
    color: '#c69a4d',
    copy: 'First thermal intercept removes most radiative and conductive heat from incoming lines.',
  },
  {
    id: 'four',
    name: '4 K plate',
    temperature: '≈ 4 K',
    cableCount: 48,
    radius: 100,
    assembledY: 140,
    color: '#d2a852',
    copy: 'Cryogenic amplifiers and line thermalization typically anchor near this stage.',
  },
  {
    id: 'still',
    name: 'Still plate',
    temperature: '≈ 800 mK',
    cableCount: 36,
    radius: 88,
    assembledY: 176,
    color: '#b98a3f',
    copy: 'The still drives circulation of the helium mixture and provides another thermal anchor.',
  },
  {
    id: 'cold',
    name: 'Cold plate',
    temperature: '≈ 100 mK',
    cableCount: 30,
    radius: 76,
    assembledY: 212,
    color: '#c79c50',
    copy: 'Attenuators and filters progressively thermalize microwave control lines.',
  },
  {
    id: 'mixing',
    name: 'Mixing chamber',
    temperature: '≈ 10 mK',
    cableCount: 24,
    radius: 66,
    assembledY: 248,
    color: '#e0b45b',
    copy: 'The coldest stage holds the shielded QPU package. Exact base temperature varies by system and load.',
  },
];

export const CABLE_COUNT = 48;

export function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

export function smoothstep(value) {
  const x = clamp01(value);
  return x * x * (3 - 2 * x);
}

export function explodeShare(progress, index) {
  const start = 0.15 + index * 0.055;
  const end = 0.72 + index * 0.025;
  return smoothstep((progress - start) / (end - start));
}

export function stageY(progress, index) {
  const stage = FRIDGE_STAGES[index];
  return stage.assembledY + index * FRIDGE_GAP * explodeShare(progress, index);
}

export function activeStageIndex(progress) {
  if (progress < 0.15) return 0;
  return Math.min(
    FRIDGE_STAGES.length - 1,
    Math.floor(((progress - 0.15) / 0.7) * FRIDGE_STAGES.length),
  );
}

export function readoutAt(progress) {
  const index = activeStageIndex(progress);
  const stage = FRIDGE_STAGES[index];
  return {
    index,
    stage,
    phase: progress < 0.15 ? 'assembled' : progress < 0.85 ? 'separating' : 'exploded',
  };
}

export function easeInOutCubic(t) {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}

/** Scroll progress [0,1] that centers narrative on stage `index`. */
export function progressForStage(index) {
  if (index <= 0) return 0.08;
  if (index >= FRIDGE_STAGES.length - 1) return 0.92;
  return 0.15 + ((index + 0.5) / FRIDGE_STAGES.length) * 0.68;
}

export const EXPLODE_GAP_3D = 0.62;
export const STAGE_ASSEMBLED_Y = [2.35, 1.85, 1.35, 0.85, 0.35, -0.15];
export const STAGE_RADIUS = [1.05, 0.92, 0.82, 0.72, 0.62, 0.54];

export function explodeShare3D(progress, index) {
  const start = 0.12 + index * 0.045;
  const end = 0.72 + index * 0.028;
  return easeInOutCubic((progress - start) / (end - start));
}

export function stageWorldY(progress, index) {
  const base = STAGE_ASSEMBLED_Y[index];
  const sep = index * EXPLODE_GAP_3D * explodeShare3D(progress, index);
  return base - sep;
}
