import React, { useEffect, useMemo, useRef } from 'react';
import { FRIDGE_STAGES } from './quantum-fridge-model.js';
import {
  SVG_CX,
  ELLIPSE_RATIO,
  AUTH_RADIUS_SCALE,
  AUTH_Y0,
  AUTH_STEP,
  applySvgProgress,
  loopProgress,
  buildCableSegments,
  authStageY,
  authRadius,
} from './auth-fridge-svg.js';

function StagePlateSvg({ stage, index, groupRef }) {
  const r = stage.radius * AUTH_RADIUS_SCALE;
  const ry = r * ELLIPSE_RATIO;
  const y = AUTH_Y0 + index * AUTH_STEP;
  const h = index === 0 ? 5 : 3;
  const fill = index === 0 ? 'url(#af-copper)' : 'url(#af-gold)';
  const side = index === 0 ? '#7a3424' : '#7a5a1c';

  return (
    <g ref={groupRef}>
      <path
        d={`M ${SVG_CX - r} ${y}
            L ${SVG_CX - r * 0.995} ${y + h}
            A ${r * 0.995} ${ry * 0.88} 0 0 0 ${SVG_CX + r * 0.995} ${y + h}
            L ${SVG_CX + r} ${y}
            A ${r} ${ry} 0 0 1 ${SVG_CX - r} ${y} Z`}
        fill={side}
      />
      <ellipse cx={SVG_CX} cy={y} rx={r} ry={ry} fill={fill} stroke="#2a1a0c" strokeWidth="0.55" />
      {/* Frosted glass face */}
      <ellipse
        cx={SVG_CX}
        cy={y}
        rx={r * 0.98}
        ry={ry * 0.96}
        fill="url(#af-glass-plate)"
        opacity={0.35}
      />
      <ellipse
        cx={SVG_CX}
        cy={y - 0.4}
        rx={r * 0.86}
        ry={ry * 0.74}
        fill="url(#af-shine)"
        opacity={0.38}
      />
    </g>
  );
}

/** Realistic coax taper + glass vacuum shell + richer breathe / pulse. */
export function AuthFridgeSvgLoop({ reduced }) {
  const stageRefs = useRef([]);
  const cableRefs = useRef([]);
  const rodRefs = useRef([]);
  const shieldRef = useRef(null);
  const glassRef = useRef(null);
  const glassSheenRef = useRef(null);
  const qpuRef = useRef(null);
  const qpuGlowRef = useRef(null);

  const restYs = useMemo(
    () => FRIDGE_STAGES.map((_, i) => AUTH_Y0 + i * AUTH_STEP),
    [],
  );
  const segments = useMemo(() => buildCableSegments(restYs), [restYs]);
  const shieldY = restYs.at(-1) + 24;
  const glassRx = authRadius(0) + 10;

  useEffect(() => {
    const refs = {
      stageRefs, cableRefs, rodRefs, shieldRef, glassRef, glassSheenRef,
      qpuRef, qpuGlowRef,
    };
    if (reduced) {
      applySvgProgress(0.35, refs, 0);
      return undefined;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now) => {
      const sec = (now - start) / 1000;
      applySvgProgress(loopProgress(sec), refs, sec);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  const vbTop = 30;
  const vbBottom = authStageY(0.8, FRIDGE_STAGES.length - 1) + 56;
  const vbH = Math.ceil(vbBottom - vbTop);
  const maxR = glassRx;
  const vbX = Math.floor(SVG_CX - maxR - 14);
  const vbW = Math.ceil(maxR * 2 + 28);

  return (
    <svg
      viewBox={`${vbX} ${vbTop} ${vbW} ${vbH}`}
      width="100%"
      height="100%"
      className="auth-fridge__svg"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="af-copper" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#8f3d2a" />
          <stop offset="40%" stopColor="#d47852" />
          <stop offset="100%" stopColor="#efc2a4" />
        </linearGradient>
        <linearGradient id="af-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#8a6824" />
          <stop offset="45%" stopColor="#d4b05a" />
          <stop offset="100%" stopColor="#f3e4b0" />
        </linearGradient>
        <radialGradient id="af-shine" cx="32%" cy="28%" r="62%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.7" />
          <stop offset="50%" stopColor="#ffffff" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="af-glass-plate" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#dce9f8" stopOpacity="0.45" />
          <stop offset="55%" stopColor="#8eb4d8" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#1a3048" stopOpacity="0.08" />
        </linearGradient>
        <linearGradient id="af-glass-shell" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#9ec4e8" stopOpacity="0.22" />
          <stop offset="35%" stopColor="#e8f2fc" stopOpacity="0.08" />
          <stop offset="65%" stopColor="#e8f2fc" stopOpacity="0.05" />
          <stop offset="100%" stopColor="#7aa8d4" stopOpacity="0.2" />
        </linearGradient>
        <linearGradient id="af-glass-sheen" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="45%" stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="55%" stopColor="#ffffff" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <filter id="af-soft" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="0.6" />
        </filter>
      </defs>

      {/* Vacuum glass cylinder */}
      <rect
        ref={glassRef}
        x={SVG_CX - glassRx}
        y={AUTH_Y0 - 6}
        width={glassRx * 2}
        height={restYs.at(-1) - AUTH_Y0 + 24}
        rx={glassRx * 0.12}
        fill="url(#af-glass-shell)"
        stroke="rgba(180,210,235,0.35)"
        strokeWidth="0.7"
        opacity={0.28}
      />
      <g ref={glassSheenRef}>
        <rect
          x={SVG_CX - glassRx * 0.55}
          y={AUTH_Y0 - 4}
          width={glassRx * 0.32}
          height={restYs.at(-1) - AUTH_Y0 + 20}
          rx={6}
          fill="url(#af-glass-sheen)"
          opacity={0.55}
          filter="url(#af-soft)"
        />
      </g>

      {/* Coax — realistic counts, signal dash pulse */}
      <g>
        {segments.map((seg, index) => (
          <line
            key={seg.key}
            ref={(n) => { cableRefs.current[index] = n; }}
            x1={seg.x1}
            y1={seg.y1}
            x2={seg.x2}
            y2={seg.y2}
            stroke={seg.tone === 'gold' ? '#d4b05a' : '#9aa6b2'}
            strokeWidth={1.3}
            strokeLinecap="butt"
            vectorEffect="non-scaling-stroke"
            opacity={0.9}
          />
        ))}
      </g>

      {FRIDGE_STAGES.map((stage, index) => (
        <StagePlateSvg
          key={stage.id}
          stage={stage}
          index={index}
          groupRef={(n) => { stageRefs.current[index] = n; }}
        />
      ))}

      <g ref={shieldRef}>
        <ellipse
          ref={qpuGlowRef}
          cx={SVG_CX}
          cy={shieldY - 6}
          rx={10}
          ry={6}
          fill="#5eead4"
          opacity={0.35}
          filter="url(#af-soft)"
        />
        <ellipse cx={SVG_CX} cy={shieldY} rx={26} ry={5} fill="#8e969e" stroke="#555e66" strokeWidth="0.5" />
        <rect
          x={SVG_CX - 18}
          y={shieldY - 12}
          width={36}
          height={12}
          rx={2.5}
          fill="rgba(55,65,75,0.72)"
          stroke="rgba(160,170,180,0.25)"
          strokeWidth="0.45"
        />
        {/* Mini glass cap over QPU */}
        <ellipse
          cx={SVG_CX}
          cy={shieldY - 8}
          rx={14}
          ry={7}
          fill="url(#af-glass-plate)"
          opacity={0.4}
        />
        <g ref={qpuRef}>
          <path
            d={`M${SVG_CX - 6} ${shieldY - 6.5} L${SVG_CX} ${shieldY - 11} L${SVG_CX + 6} ${shieldY - 6.5} L${SVG_CX} ${shieldY - 2} Z`}
            fill="#0c141c"
            stroke="#5eead4"
            strokeWidth="0.75"
          />
          <circle cx={SVG_CX} cy={shieldY - 6.5} r={1.05} fill="#5eead4" />
        </g>
      </g>
    </svg>
  );
}
