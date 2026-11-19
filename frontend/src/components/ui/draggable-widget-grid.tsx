// @ts-nocheck — ported from Govern JSX; tighten types in a dedicated pass.
/**
 * Draggable widget grid — gap-free tiling, Motion transitions.
 * Styling: Tailwind shadcn token aliases in index.css (@theme).
 */
import {
  memo,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { MotionConfig, motion, useDragControls } from 'motion/react';
import {
  SPANS,
  sizeOf,
  layout,
  canonical,
  moveTo,
  sameOrder,
  choose,
  candidatesFor,
} from './draggable-widget-grid-layout'

const SIZE_LABELS = {
  sm: 'Small',
  wide: 'Wide',
  tall: 'Tall',
  lg: 'Large',
};

const DEFAULT_ITEMS = [
  { id: 'widget-1', size: 'wide' },
  { id: 'widget-2', size: 'sm' },
  { id: 'widget-3', size: 'sm' },
  { id: 'widget-4', size: 'sm' },
  { id: 'widget-5', size: 'wide' },
  { id: 'widget-6', size: 'sm' },
  { id: 'widget-7', size: 'sm' },
  { id: 'widget-8', size: 'wide' },
  { id: 'widget-9', size: 'sm' },
];

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

const SPRING = { type: 'spring', visualDuration: 0.38, bounce: 0.16 };
const LIFT = { type: 'spring', visualDuration: 0.26, bounce: 0.32 };
const LIFT_SCALE = 1.04;
const SETTLE_MS = 40;
const LANDED_MS = 620;
const LONG_PRESS_MS = 350;
const PRESS_SLOP = 8;
const SHADOW_REST = '0px 1px 2px 0px rgba(0,0,0,0.08)';
const SHADOW_LIFTED = '0px 16px 40px -12px rgba(15,23,42,0.25)';

const Widget = memo(function Widget({
  item,
  col,
  row,
  w,
  h,
  columns,
  rows,
  editable,
  held,
  raised,
  landed,
  handlers,
  hintId,
  position,
  count,
  renderItem,
}) {
  const controls = useDragControls();
  const node = useRef(null);
  const press = useRef(null);
  const lifted = useRef(false);
  const cleanup = useRef(null);
  const [phase, setPhase] = useState('idle');

  const release = useCallback(() => {
    if (press.current) window.clearTimeout(press.current.timer);
    press.current = null;
    lifted.current = false;
    cleanup.current?.();
    cleanup.current = null;
    setPhase('idle');
  }, []);

  useEffect(() => {
    const el = node.current;
    if (!el) return;
    const block = (e) => {
      if (lifted.current) e.preventDefault();
    };
    el.addEventListener('touchmove', block, { passive: false });
    return () => {
      el.removeEventListener('touchmove', block);
      if (press.current) window.clearTimeout(press.current.timer);
      cleanup.current?.();
    };
  }, []);

  const onPointerDown = (e) => {
    if (!editable || e.button !== 0 || !e.isPrimary) return;
    if (e.pointerType !== 'touch') {
      controls.start(e);
      return;
    }
    if (press.current || lifted.current) return;
    const origin = e.nativeEvent;
    const pointerId = e.pointerId;
    setPhase('holding');
    press.current = {
      pointerId,
      x: e.clientX,
      y: e.clientY,
      timer: window.setTimeout(() => {
        press.current = null;
        lifted.current = true;
        setPhase('lifted');
        navigator.vibrate?.(10);
        controls.start(origin);
        const done = (ev) => {
          if (ev.pointerId !== pointerId) return;
          handlers.suppressClick();
          release();
        };
        window.addEventListener('pointerup', done);
        window.addEventListener('pointercancel', done);
        cleanup.current = () => {
          window.removeEventListener('pointerup', done);
          window.removeEventListener('pointercancel', done);
        };
      }, LONG_PRESS_MS),
    };
  };

  const onPointerMove = (e) => {
    const p = press.current;
    if (p && e.pointerId === p.pointerId && Math.hypot(e.clientX - p.x, e.clientY - p.y) > PRESS_SLOP) {
      release();
    }
  };

  const onPointerEnd = (e) => {
    if (press.current?.pointerId === e.pointerId) release();
  };

  const delay = (col / Math.max(columns, 1) + row / Math.max(rows, 1)) * 0.26;

  return (
    <motion.div
      ref={node}
      role="listitem"
      data-slot="widget"
      data-widget-id={item.id}
      tabIndex={editable ? 0 : undefined}
      aria-label={item.label ?? `${SIZE_LABELS[item.size]} widget`}
      aria-posinset={position}
      aria-setsize={count}
      layout="position"
      drag={editable}
      dragListener={false}
      dragControls={controls}
      dragSnapToOrigin
      dragMomentum={false}
      onDragStart={() => handlers.start(item.id)}
      onDrag={handlers.drag}
      onDragEnd={() => handlers.end(item.id)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onContextMenu={(e) => {
        if (phase !== 'idle') e.preventDefault();
      }}
      onKeyDown={(e) => handlers.key(e, item.id)}
      onClickCapture={(e) => {
        if (handlers.swallow() || (editable && e.target.closest('a'))) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      animate={{
        scale: phase === 'holding' ? 0.98 : phase === 'lifted' ? LIFT_SCALE : 1,
        boxShadow: phase === 'lifted' ? SHADOW_LIFTED : SHADOW_REST,
      }}
      whileDrag={{ scale: LIFT_SCALE, boxShadow: SHADOW_LIFTED, transition: LIFT }}
      transition={SPRING}
      className={`relative min-w-0 rounded-[var(--widget-radius)] outline-none focus-visible:ring-2 focus-visible:ring-ring [&_a]:[-webkit-user-drag:none] ${
        editable
          ? 'cursor-grab touch-pan-y touch-pinch-zoom select-none [-webkit-touch-callout:none] active:cursor-grabbing'
          : ''
      }`}
      style={{
        gridColumn: `${col + 1} / span ${w}`,
        gridRow: `${row + 1} / span ${h}`,
        zIndex: held ? 20 : raised ? 10 : 0,
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', visualDuration: 0.5, bounce: 0.1, delay }}
        className={`craft-card relative isolate flex h-full w-full flex-col overflow-hidden rounded-[var(--widget-radius)] bg-card text-card-foreground ring-inset transition-shadow duration-300 ${
          landed ? 'ring-2 ring-foreground/25' : 'ring-1 ring-border'
        }`}
        style={{ clipPath: 'inset(0 round var(--widget-radius))' }}
      >
        {renderItem?.(item, sizeOf(w, h))}
      </motion.div>
    </motion.div>
  );
});

export default function DraggableWidgetGrid({
  items: initialItems,
  onChange,
  renderItem,
  editable = true,
  maxColumns = 4,
  cellSize = 215,
  gap = 12,
  radius = 12,
  className = '',
}) {
  const [items, setItems] = useState(() => initialItems ?? DEFAULT_ITEMS);
  const grid = useRef(null);
  const hintId = useId();
  const minColumns = Math.min(2, Math.max(1, maxColumns));

  const [metrics, setMetrics] = useState({ unit: 0, columns: 0 });
  useIsoLayoutEffect(() => {
    const el = grid.current;
    if (!el) return;
    const measure = () => {
      const width = el.getBoundingClientRect().width;
      if (width < 1) return;
      const columns = Math.max(minColumns, Math.min(maxColumns, Math.round(width / cellSize)));
      const unit = (width - gap * (columns - 1)) / columns;
      setMetrics((was) =>
        was.columns === columns && Math.abs(was.unit - unit) < 0.5 ? was : { unit, columns },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [maxColumns, minColumns, cellSize, gap]);

  useEffect(() => {
    if (initialItems?.length) setItems(initialItems);
  }, [initialItems]);

  const columns = metrics.columns || Math.max(minColumns, maxColumns);
  const placements = useMemo(() => layout(items, columns), [items, columns]);
  const rows = placements.reduce((n, p) => Math.max(n, p.row + p.h), 0);

  const latest = useRef({ items, metrics, onChange });
  latest.current.metrics = metrics;
  latest.current.onChange = onChange;
  useIsoLayoutEffect(() => {
    latest.current.items = items;
  }, [items]);

  const commit = useCallback((next) => {
    latest.current.items = next;
    setItems(next);
  }, []);

  const toSlot = useCallback(
    (box) => {
      const el = grid.current;
      const { unit } = latest.current.metrics;
      const rect = el?.getBoundingClientRect();
      const colStep = unit + gap;
      const rowStep = Math.round(unit) + gap;
      const left = (rect?.left ?? 0) + box.col * colStep;
      const top = (rect?.top ?? 0) + box.row * rowStep;
      return {
        left,
        top,
        right: left + box.w * colStep - gap,
        bottom: top + box.h * rowStep - gap,
      };
    },
    [gap],
  );

  const [held, setHeld] = useState(null);
  const [raised, setRaised] = useState(null);
  const [landed, setLanded] = useState(null);
  const dragging = useRef(null);
  const startOrder = useRef(null);
  const frame = useRef(0);
  const lastMove = useRef(0);
  const swallowUntil = useRef(0);
  const ring = useRef(0);
  const refocus = useRef(null);

  const step = useCallback(
    (force = false) => {
      frame.current = 0;
      const id = dragging.current;
      const { items: current, metrics: m } = latest.current;
      const el = id
        ? grid.current?.querySelector(`[data-widget-id="${CSS.escape(id)}"]`)
        : null;
      if (!id || !el || !m.columns) return;
      const now = performance.now();
      if (!force && now - lastMove.current < SETTLE_MS) {
        frame.current = requestAnimationFrame(() => step());
        return;
      }
      const me = layout(current, m.columns).find((p) => p.id === id);
      if (!me) return;
      const r = el.getBoundingClientRect();
      const order = choose(
        toSlot(me),
        candidatesFor(current, id, m.columns, toSlot),
        r.left + r.width / 2,
        r.top + r.height / 2,
      );
      if (!order) return;
      lastMove.current = now;
      commit(canonical(order, m.columns));
    },
    [toSlot, commit],
  );

  useEffect(
    () => () => {
      cancelAnimationFrame(frame.current);
      window.clearTimeout(ring.current);
    },
    [],
  );

  useIsoLayoutEffect(() => {
    const id = refocus.current;
    if (!id) return;
    refocus.current = null;
    const el = grid.current?.querySelector(`[data-widget-id="${CSS.escape(id)}"]`);
    el?.focus();
  }, [items]);

  const handlers = useMemo(
    () => ({
      start: (id) => {
        dragging.current = id;
        startOrder.current = latest.current.items;
        lastMove.current = 0;
        setHeld(id);
        setRaised(id);
        window.addEventListener(
          'pointerup',
          () => {
            swallowUntil.current = performance.now() + 300;
          },
          { once: true, capture: true },
        );
      },
      drag: () => {
        if (!frame.current) frame.current = requestAnimationFrame(() => step());
      },
      end: (id) => {
        cancelAnimationFrame(frame.current);
        step(true);
        frame.current = 0;
        dragging.current = null;
        setHeld(null);
        setLanded(id);
        window.clearTimeout(ring.current);
        ring.current = window.setTimeout(() => {
          setLanded(null);
          setRaised(null);
        }, LANDED_MS);
        const before = startOrder.current;
        startOrder.current = null;
        const after = latest.current.items;
        if (before && !sameOrder(before, after)) latest.current.onChange?.(after);
      },
      key: (e, id) => {
        if (!editable || !e.altKey) return;
        if (e.target.closest('input, textarea, select, button')) return;
        const delta =
          e.key === 'ArrowRight' || e.key === 'ArrowDown'
            ? 1
            : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
              ? -1
              : 0;
        if (!delta) return;
        e.preventDefault();
        const { items: current, metrics: m } = latest.current;
        const cols = m.columns || maxColumns;
        const from = current.findIndex((item) => item.id === id);
        for (let to = from + delta; to >= 0 && to < current.length; to += delta) {
          const next = canonical(moveTo(current, id, to), cols);
          if (sameOrder(next, current)) continue;
          refocus.current = id;
          commit(next);
          latest.current.onChange?.(next);
          return;
        }
      },
      swallow: () => performance.now() < swallowUntil.current,
      suppressClick: () => {
        swallowUntil.current = performance.now() + 300;
      },
    }),
    [step, commit, editable, maxColumns],
  );

  const byId = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const domOrder = useRef(items.map((item) => item.id));
  for (const item of items) if (!domOrder.current.includes(item.id)) domOrder.current.push(item.id);
  const placementById = new Map(placements.map((p) => [p.id, p]));
  const visualIndex = new Map(
    [...placements]
      .sort((a, b) => a.row - b.row || a.col - b.col)
      .map((p, i) => [p.id, i]),
  );

  return (
    <MotionConfig reducedMotion="user">
      <div className={`relative w-full ${className}`} style={{ '--widget-radius': `${radius}px` }}>
        <div
          ref={grid}
          role="list"
          data-slot="widget-grid"
          className="grid w-full"
          style={{
            gap,
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            gridAutoRows: metrics.unit ? `${Math.round(metrics.unit)}px` : `minmax(${cellSize * 0.75}px, auto)`,
          }}
        >
          {domOrder.current.map((id) => {
            const item = byId.get(id);
            const p = placementById.get(id);
            if (!item || !p) return null;
            return (
              <Widget
                key={id}
                position={(visualIndex.get(id) ?? 0) + 1}
                count={placements.length}
                item={item}
                col={p.col}
                row={p.row}
                w={p.w}
                h={p.h}
                columns={columns}
                rows={rows}
                editable={editable}
                held={held === p.id}
                raised={raised === p.id}
                landed={landed === p.id}
                handlers={handlers}
                hintId={hintId}
                renderItem={renderItem}
              />
            );
          })}
        </div>
      </div>
    </MotionConfig>
  );
}

export { SPANS, sizeOf, layout };