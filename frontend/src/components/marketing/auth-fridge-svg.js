import { FRIDGE_STAGES, clamp01, explodeShare, easeInOutCubic } from './quantum-fridge-model.js';

export const SVG_CX = 250;
export const ELLIPSE_RATIO = 0.22;
export const AUTH_RADIUS_SCALE = 0.62;
export const AUTH_RING = 0.78;

export const AUTH_Y0 = 58;
export const AUTH_STEP = 32;
/** Bigger travel for a clearer cryostat breathe */
export const AUTH_EXPLODE_PX = 18;

/**
 * Realistic schematic counts — scaled from stage cableCount (~/6).
 * Gap i lands on stage i+1 (the colder / smaller plate).
 */
export const AUTH_GAP_COUNTS = FRIDGE_STAGES.slice(1).map((s) =>
  Math.max(3, Math.round(s.cableCount / 6)),
);
// → [8, 8, 6, 5, 4]

export function authRadius(stageIndex) {
  return FRIDGE_STAGES[stageIndex].radius * AUTH_RADIUS_SCALE;
}

export function gapCableXs(gapIndex) {
  const count = AUTH_GAP_COUNTS[gapIndex];
  const span = authRadius(gapIndex + 1) * AUTH_RING;
  if (count <= 1) return [SVG_CX];
  return Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1);
    return Math.round(SVG_CX - span + t * span * 2);
  });
}

export function buildCableSegments(ys) {
  const out = [];
  for (let g = 0; g < AUTH_GAP_COUNTS.length; g += 1) {
    const xs = gapCableXs(g);
    xs.forEach((x, i) => {
      out.push({
        key: `${g}-${i}`,
        gap: g,
        x1: x,
        y1: ys[g],
        x2: x,
        y2: ys[g + 1],
        tone: i % 2 === 0 ? 'gold' : 'steel',
      });
    });
  }
  return out;
}

/** Primary explode + secondary micro-bob for richer motion */
export function loopProgress(seconds) {
  const primary = 0.5 + 0.5 * Math.sin(seconds * 0.62);
  const micro = 0.5 + 0.5 * Math.sin(seconds * 1.35 + 0.4);
  const wave = clamp01(0.82 * easeInOutCubic(primary) + 0.18 * micro);
  return 0.12 + 0.68 * wave;
}

export function authStageY(progress, index) {
  return AUTH_Y0
    + index * AUTH_STEP
    + index * AUTH_EXPLODE_PX * explodeShare(progress, index);
}

function setStageDy(node, index, ys) {
  if (!node) return;
  const rest = AUTH_Y0 + index * AUTH_STEP;
  node.setAttribute('transform', `translate(0 ${(ys[index] - rest).toFixed(2)})`);
}

export function applySvgProgress(progress, refs, seconds = 0) {
  const ys = FRIDGE_STAGES.map((_, index) => authStageY(progress, index));
  refs.stageRefs.current.forEach((node, index) => setStageDy(node, index, ys));

  const segs = buildCableSegments(ys);
  segs.forEach((seg, index) => {
    const node = refs.cableRefs.current[index];
    if (!node) return;
    node.setAttribute('x1', String(seg.x1));
    node.setAttribute('y1', seg.y1.toFixed(1));
    node.setAttribute('x2', String(seg.x2));
    node.setAttribute('y2', seg.y2.toFixed(1));
    // Soft signal shimmer (keep stroke solid / straight)
    const shimmer = 0.72 + 0.22 * (0.5 + 0.5 * Math.sin(seconds * 2.4 + index * 0.35));
    node.setAttribute('opacity', shimmer.toFixed(3));
  });

  const mixingRest = AUTH_Y0 + (FRIDGE_STAGES.length - 1) * AUTH_STEP;
  const mixingDelta = ys.at(-1) - mixingRest;
  refs.shieldRef.current?.setAttribute('transform', `translate(0 ${mixingDelta.toFixed(2)})`);

  // Glass shell tracks full stack height
  if (refs.glassRef?.current) {
    const top = ys[0] - 6;
    const bot = ys.at(-1) + 18;
    const h = bot - top;
    refs.glassRef.current.setAttribute('y', top.toFixed(1));
    refs.glassRef.current.setAttribute('height', h.toFixed(1));
    const sheen = 0.22 + 0.12 * (0.5 + 0.5 * Math.sin(seconds * 0.9));
    refs.glassRef.current.setAttribute('opacity', sheen.toFixed(3));
  }
  if (refs.glassSheenRef?.current) {
    const drift = 8 * Math.sin(seconds * 0.7);
    refs.glassSheenRef.current.setAttribute('transform', `translate(${drift.toFixed(1)} 0)`);
  }

  if (refs.qpuRef.current) {
    const glow = clamp01((progress - 0.25) / 0.6);
    const pulse = 0.65 + glow * 0.25 + 0.1 * Math.sin(seconds * 2.2);
    refs.qpuRef.current.style.opacity = String(clamp01(pulse));
  }
  if (refs.qpuGlowRef?.current) {
    const g = 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(seconds * 2.2));
    refs.qpuGlowRef.current.setAttribute('opacity', g.toFixed(3));
    refs.qpuGlowRef.current.setAttribute('rx', String(10 + 4 * Math.sin(seconds * 2.2)));
    refs.qpuGlowRef.current.setAttribute('ry', String(6 + 2 * Math.sin(seconds * 2.2)));
  }
}
