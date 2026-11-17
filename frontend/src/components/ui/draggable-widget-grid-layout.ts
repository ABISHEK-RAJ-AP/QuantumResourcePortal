// @ts-nocheck — ported from Govern JS; tighten types in a dedicated pass.
export type WidgetSize = 'sm' | 'wide' | 'tall' | 'lg'

export interface WidgetItem {
  id: string
  size: WidgetSize
  label?: string
}

export const SPANS = {
  sm: { col: 1, row: 1 },
  wide: { col: 2, row: 1 },
  tall: { col: 1, row: 2 },
  lg: { col: 2, row: 2 },
};

export function sizeOf(w, h) {
  if (w >= 2 && h >= 2) return 'lg';
  if (w >= 2) return 'wide';
  if (h >= 2) return 'tall';
  return 'sm';
}

function spanOf(item, columns) {
  return { w: Math.min(SPANS[item.size].col, columns), h: SPANS[item.size].row };
}

const overlaps = (a, b) =>
  a.col < b.col + b.w && b.col < a.col + a.w && a.row < b.row + b.h && b.row < a.row + a.h;

const contains = (outer, inner) =>
  inner.col >= outer.col &&
  inner.row >= outer.row &&
  inner.col + inner.w <= outer.col + outer.w &&
  inner.row + inner.h <= outer.row + outer.h;

export function layout(items, columns) {
  if (columns < 1 || !items.length) return [];
  return tile(items, columns) ?? pack(items, columns);
}

const TILING_BUDGET = 20000;

function tile(items, columns) {
  const spans = items.map((item) => spanOf(item, columns));
  const area = spans.reduce((n, s) => n + s.w * s.h, 0);
  const rows = Math.ceil(area / columns);
  const grid = new Array(rows * columns).fill(false);
  const used = new Array(items.length).fill(false);
  const out = [];
  let budget = TILING_BUDGET;

  const fits = (w, h, r, c) => {
    if (c + w > columns || r + h > rows) return false;
    for (let y = r; y < r + h; y++)
      for (let x = c; x < c + w; x++) if (grid[y * columns + x]) return false;
    return true;
  };
  const mark = (w, h, r, c, v) => {
    for (let y = r; y < r + h; y++)
      for (let x = c; x < c + w; x++) grid[y * columns + x] = v;
  };

  const place = (count) => {
    if (count === items.length) return true;
    if (--budget < 0) return false;
    const i = grid.indexOf(false);
    if (i < 0) return false;
    const r = Math.floor(i / columns);
    const c = i % columns;
    const tried = new Set();
    for (let k = 0; k < items.length; k++) {
      if (used[k]) continue;
      const { w, h } = spans[k];
      const shape = `${w}x${h}`;
      if (tried.has(shape) || !fits(w, h, r, c)) continue;
      tried.add(shape);
      used[k] = true;
      mark(w, h, r, c, true);
      out.push({ id: items[k].id, col: c, row: r, w, h });
      if (place(count + 1)) return true;
      out.pop();
      mark(w, h, r, c, false);
      used[k] = false;
    }
    return false;
  };

  return place(0) ? out : null;
}

function pack(items, columns) {
  const out = [];
  let row = 0;
  let queue = items.map((item) => ({ id: item.id, ...spanOf(item, columns) }));

  while (queue.length > 0) {
    const height = Math.max(...queue.slice(0, columns).map((q) => q.h));
    const cells = new Array(height * columns).fill(false);
    const band = [];
    const rest = [];

    for (const q of queue) {
      let spot = -1;
      for (let i = 0; i < cells.length && spot < 0; i++) {
        const r = Math.floor(i / columns);
        const c = i % columns;
        if (c + q.w > columns || r + q.h > height) continue;
        let free = true;
        for (let y = r; y < r + q.h && free; y++)
          for (let x = c; x < c + q.w && free; x++) if (cells[y * columns + x]) free = false;
        if (free) spot = i;
      }
      if (spot < 0 || rest.length > 0) {
        rest.push(q);
        continue;
      }
      const r = Math.floor(spot / columns);
      const c = spot % columns;
      for (let y = r; y < r + q.h; y++)
        for (let x = c; x < c + q.w; x++) cells[y * columns + x] = true;
      band.push({ id: q.id, col: c, row: r, w: q.w, h: q.h });
    }

    for (let i = 0; i < cells.length; i++) {
      if (cells[i]) continue;
      const r = Math.floor(i / columns);
      const c = i % columns;
      const left = band.find(
        (p) => p.col + p.w === c && p.row <= r && p.row + p.h > r && p.h === 1,
      );
      const above = band.find((p) => p.row + p.h === r && p.col === c && p.w === 1);
      const grow = left ?? above;
      if (!grow) continue;
      if (grow === left) grow.w += 1;
      else grow.h += 1;
      cells[i] = true;
    }

    out.push(...band.map((p) => ({ ...p, row: p.row + row })));
    row += height;
    queue = rest;
  }
  return out;
}

export function canonical(items, columns) {
  const places = layout(items, columns);
  if (places.length !== items.length) return items;
  const byId = new Map(items.map((item) => [item.id, item]));
  const sorted = [...places]
    .sort((a, b) => a.row - b.row || a.col - b.col)
    .map((p) => byId.get(p.id));
  if (sorted.every((item, i) => item === items[i])) return items;
  const at = new Map(places.map((p) => [p.id, p]));
  const same = layout(sorted, columns).every((p) => {
    const q = at.get(p.id);
    return q && q.col === p.col && q.row === p.row && q.w === p.w && q.h === p.h;
  });
  return same ? sorted : items;
}

export function moveTo(items, id, index) {
  const from = items.findIndex((item) => item.id === id);
  if (from < 0 || from === index || index < 0 || index >= items.length) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(index, 0, moved);
  return next;
}

export const sameOrder = (a, b) =>
  a.length === b.length && a.every((item, i) => item.id === b[i]);

const ENTER = 0.18;

export function choose(home, candidates, cx, cy) {
  const distance = (s, inset) => {
    const ix = (s.right - s.left) * inset;
    const iy = (s.bottom - s.top) * inset;
    const dx = Math.max(s.left + ix - cx, 0, cx - (s.right - ix));
    const dy = Math.max(s.top + iy - cy, 0, cy - (s.bottom - iy));
    return Math.hypot(dx, dy);
  };
  const toCentre = (s) =>
    Math.hypot((s.left + s.right) / 2 - cx, (s.top + s.bottom) / 2 - cy);

  let best = distance(home, 0);
  if (best === 0) return null;
  let pick = null;
  let bestCentre = Infinity;
  for (const { order, slot } of candidates) {
    const d = distance(slot, ENTER);
    const c = toCentre(slot);
    if (d < best || (d === best && pick && c < bestCentre)) {
      best = d;
      bestCentre = c;
      pick = order;
    }
  }
  return pick;
}

export function candidatesFor(items, id, columns, toSlot) {
  const places = layout(items, columns);
  const me = places.find((p) => p.id === id);
  if (!me) return [];
  const byId = new Map(items.map((item) => [item.id, item]));
  const rows = Math.max(...places.map((p) => p.row + p.h));
  const out = [];

  for (let row = 0; row + me.h <= rows; row++) {
    for (let col = 0; col + me.w <= columns; col++) {
      const area = { col, row, w: me.w, h: me.h };
      if (overlaps(area, me)) continue;
      const group = places.filter((p) => overlaps(p, area));
      if (group.length < 2 || !group.every((p) => contains(area, p))) continue;
      const moved = places.map((p) =>
        p.id === id
          ? { ...p, col, row }
          : group.includes(p)
            ? { ...p, col: p.col - col + me.col, row: p.row - row + me.row }
            : p,
      );
      moved.sort((a, b) => a.row - b.row || a.col - b.col);
      out.push({
        order: moved.map((p) => byId.get(p.id)),
        slot: toSlot(area),
      });
    }
  }

  const from = items.findIndex((item) => item.id === id);
  for (let i = 0; i < items.length; i++) {
    if (i === from) continue;
    const order = moveTo(items, id, i);
    const p = layout(order, columns).find((q) => q.id === id);
    if (p) out.push({ order, slot: toSlot(p) });
  }
  return out;
}