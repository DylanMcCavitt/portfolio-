import {
  entities,
  type EntityId,
  type Entity,
} from "../data/topology/entities";
import { layout } from "../data/topology/layout";

// ── Entity lookup helper ────────────────────────────────────────────────────

function getEntity(id: string): Entity | undefined {
  return (entities as Record<string, Entity>)[id];
}

// ── Types ────────────────────────────────────────────────────────────────────

/** Camera = the visible region of SVG world space (what the viewBox shows) */
type Camera = { x: number; y: number; w: number; h: number };
type Bounds = { x: number; y: number; w: number; h: number };
type DragState = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startCamX: number;
  startCamY: number;
  moved: boolean;
};

// ── Constants ────────────────────────────────────────────────────────────────

const SCENE_PAD = 200;
const MIN_W = 800; // max zoom in — viewBox width
const MAX_W = 5000; // max zoom out — viewBox width

// ── DOM refs ─────────────────────────────────────────────────────────────────

const svg = document.getElementById("topology-svg") as SVGSVGElement | null;
const bgEl = document.getElementById("topology-bg") as SVGRectElement | null;
const popcardContainer = document.getElementById(
  "popcard-container",
) as HTMLElement | null;

if (!svg || !bgEl || !popcardContainer) {
  throw new Error("Topology: required DOM elements not found");
}

const svgEl = svg;
const backgroundEl = bgEl;
const popcardEl = popcardContainer;

// ── State ────────────────────────────────────────────────────────────────────

let camera: Camera;
let activeId: EntityId | null = null;
let dragState: DragState | null = null;
let lastDragEndedAt = 0;

// ── Multi-touch state ────────────────────────────────────────────────────────

type TouchPoint = { id: number; x: number; y: number };
let activeTouches: TouchPoint[] = [];
let pinchStartDist = 0;
let pinchStartW = 0;

function touchDistance(a: TouchPoint, b: TouchPoint): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function touchCenter(a: TouchPoint, b: TouchPoint): { x: number; y: number } {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

// ── Camera math ──────────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function computeSceneBounds(): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const f of layout.frames) {
    minX = Math.min(minX, f.x);
    minY = Math.min(minY, f.y);
    maxX = Math.max(maxX, f.x + f.w);
    maxY = Math.max(maxY, f.y + f.h);
  }
  for (const n of layout.nodes) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.w);
    maxY = Math.max(maxY, n.y + n.h);
  }

  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function getAspect(): number {
  const rect = svgEl.getBoundingClientRect();
  const w = rect.width || window.innerWidth;
  const h = rect.height || window.innerHeight;
  return w / h;
}

function constrainCamera(c: Camera): Camera {
  const aspect = getAspect();
  const w = clamp(c.w, MIN_W, MAX_W);
  const h = w / aspect;

  // Scene edges with padding
  const sceneLeft = sb.x - SCENE_PAD;
  const sceneRight = sb.x + sb.w + SCENE_PAD;
  const sceneTop = sb.y - SCENE_PAD;
  const sceneBottom = sb.y + sb.h + SCENE_PAD;

  let x = c.x;
  let y = c.y;

  if (w >= sceneRight - sceneLeft) {
    // Viewport is wider than scene — center horizontally
    x = sceneLeft + (sceneRight - sceneLeft - w) / 2;
  } else {
    // Clamp so scene edges stay visible
    x = clamp(x, sceneLeft, sceneRight - w);
  }

  if (h >= sceneBottom - sceneTop) {
    // Viewport is taller than scene — center vertically
    y = sceneTop + (sceneBottom - sceneTop - h) / 2;
  } else {
    // Clamp so scene edges stay visible
    y = clamp(y, sceneTop, sceneBottom - h);
  }

  return { w, h, x, y };
}

function centerOn(bounds: Bounds, viewW: number): Camera {
  const aspect = getAspect();
  const w = clamp(viewW, MIN_W, MAX_W);
  const h = w / aspect;

  const cx = bounds.x + bounds.w / 2;
  const cy = bounds.y + bounds.h / 2;

  return constrainCamera({
    x: cx - w / 2,
    y: cy - h / 2,
    w,
    h,
  });
}

function computeFitW(): number {
  const rect = svgEl.getBoundingClientRect();
  const svgW = rect.width || window.innerWidth;
  const svgH = rect.height || window.innerHeight;
  const aspect = svgW / svgH;

  // Fit the ENTIRE scene — account for actual SVG element size (not full viewport)
  const sceneW = sb.w + SCENE_PAD * 2;
  const sceneH = sb.h + SCENE_PAD * 2;

  // The viewBox width that makes the scene fit each dimension
  const fitByW = sceneW;
  const fitByH = sceneH * aspect;

  // Pick the larger so both dimensions are visible
  return clamp(Math.max(fitByW, fitByH), MIN_W, MAX_W);
}

/** Convert client (screen) coordinates to SVG world coordinates */
function clientToWorld(
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const rect = svgEl.getBoundingClientRect();
  const fracX = (clientX - rect.left) / rect.width;
  const fracY = (clientY - rect.top) / rect.height;
  return {
    x: camera.x + fracX * camera.w,
    y: camera.y + fracY * camera.h,
  };
}

function zoomAt(clientX: number, clientY: number, newW: number): Camera {
  const w = clamp(newW, MIN_W, MAX_W);
  const aspect = getAspect();
  const h = w / aspect;

  // Keep the world point under the cursor stable
  const world = clientToWorld(clientX, clientY);
  const rect = svgEl.getBoundingClientRect();
  const fracX = (clientX - rect.left) / rect.width;
  const fracY = (clientY - rect.top) / rect.height;

  return constrainCamera({
    x: world.x - fracX * w,
    y: world.y - fracY * h,
    w,
    h,
  });
}

// ── Scene bounds (computed once) ─────────────────────────────────────────────

const sb = computeSceneBounds();
const initW = computeFitW();
camera = centerOn(sb, initW);

// ── Entity bounds lookup ─────────────────────────────────────────────────────

function getEntityBounds(id: string): Bounds | null {
  for (const f of layout.frames) {
    if (f.entityId === id) {
      return { x: f.x, y: f.y, w: f.w, h: f.h };
    }
  }
  for (const n of layout.nodes) {
    if (n.id === id) {
      return { x: n.x, y: n.y, w: n.w, h: n.h };
    }
  }
  return null;
}

// ── Highlight set ────────────────────────────────────────────────────────────

function buildHighlightSet(focusId: string | null): Set<string> {
  if (!focusId) return new Set();
  const set = new Set<string>();
  set.add(focusId);

  const entity = getEntity(focusId);
  if (entity?.related) {
    for (const r of entity.related) set.add(r);
  }

  for (const node of layout.nodes) {
    if (node.chips) {
      const isChip = node.chips.some((c) => c.id === focusId);
      if (isChip || node.id === focusId) {
        set.add(node.id);
        for (const chip of node.chips) set.add(chip.id);
      }
    }
  }

  for (const frame of layout.frames) {
    if (frame.entityId === focusId && frame.members) {
      for (const m of frame.members) set.add(m);
    }
  }

  for (const edge of layout.edges) {
    if (set.has(edge.from) || set.has(edge.to)) set.add(edge.id);
  }

  for (const frame of layout.frames) {
    if (frame.entityId && set.has(frame.entityId)) set.add(frame.id);
  }

  return set;
}

// ── Rendering ────────────────────────────────────────────────────────────────

function applyCamera(): void {
  svgEl.setAttribute(
    "viewBox",
    `${camera.x} ${camera.y} ${camera.w} ${camera.h}`,
  );
}

function animateCamera(target: Camera, durationMs: number = 400): void {
  const start = { ...camera };
  const startTime = performance.now();

  function tick(now: number): void {
    const elapsed = now - startTime;
    const t = Math.min(elapsed / durationMs, 1);
    const ease = 1 - Math.pow(1 - t, 3);

    camera = {
      x: start.x + (target.x - start.x) * ease,
      y: start.y + (target.y - start.y) * ease,
      w: start.w + (target.w - start.w) * ease,
      h: start.h + (target.h - start.h) * ease,
    };
    applyCamera();

    if (t < 1) {
      requestAnimationFrame(tick);
    }
  }

  requestAnimationFrame(tick);
}

function applyHighlights(): void {
  const highlights = buildHighlightSet(activeId);
  const hasHighlight = Boolean(activeId);

  svgEl.classList.toggle("has-focus", hasHighlight);

  document.querySelectorAll<SVGGElement>("[data-node-id]").forEach((el) => {
    const id = el.dataset.nodeId!;
    el.classList.toggle("is-highlighted", highlights.has(id));
    el.classList.toggle("is-active", id === activeId);
  });

  document.querySelectorAll<SVGGElement>("[data-chip-id]").forEach((el) => {
    const id = el.dataset.chipId!;
    el.classList.toggle("is-highlighted", highlights.has(id));
    el.classList.toggle("is-active", id === activeId);
  });

  document.querySelectorAll<SVGGElement>("[data-frame-id]").forEach((el) => {
    const id = el.dataset.frameId!;
    const entityId = el.dataset.entityId ?? "";
    el.classList.toggle(
      "is-highlighted",
      highlights.has(id) || highlights.has(entityId),
    );
  });

  document.querySelectorAll<SVGGElement>("[data-edge-id]").forEach((el) => {
    const id = el.dataset.edgeId!;
    const edgePath = el.querySelector(".topo-edge");
    if (edgePath) {
      edgePath.classList.toggle("is-highlighted", highlights.has(id));
    }
  });
}

// ── Pop Card ─────────────────────────────────────────────────────────────────

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function showPopCard(entityId: string, anchorX: number, anchorY: number): void {
  const entity = getEntity(entityId);
  if (!entity) return;

  const badgesHtml = entity.badges
    .map((b) => `<span class="topo-popcard__badge">${escHtml(b)}</span>`)
    .join("");

  const relatedHtml =
    entity.related.length > 0
      ? `<div>
          <p class="topo-popcard__related-label">Connected to</p>
          <div class="topo-popcard__related-list">
            ${entity.related
              .map((id) => {
                const rel = getEntity(id);
                const title = rel ? rel.title : id;
                return `<button class="topo-popcard__related-btn" data-navigate="${escHtml(id)}">${escHtml(title)}</button>`;
              })
              .join("")}
          </div>
        </div>`
      : "";

  popcardEl.innerHTML = `
    <div class="topo-popcard" style="left:${anchorX}px;top:${anchorY}px">
      <p class="topo-popcard__eyebrow">${escHtml(entity.kind)}</p>
      <h3 class="topo-popcard__title">${escHtml(entity.title)}</h3>
      <p class="topo-popcard__summary">${escHtml(entity.summary)}</p>
      <div class="topo-popcard__badges">${badgesHtml}</div>
      ${relatedHtml}
    </div>
  `;

  const card = popcardEl.querySelector<HTMLElement>(".topo-popcard");
  if (card) {
    const cr = card.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (cr.right > vw - 16) card.style.left = `${vw - cr.width - 16}px`;
    if (cr.bottom > vh - 16) card.style.top = `${vh - cr.height - 16}px`;
    if (cr.left < 16) card.style.left = "16px";
    if (cr.top < 16) card.style.top = "16px";
  }

  popcardEl
    .querySelectorAll<HTMLButtonElement>("[data-navigate]")
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetId = btn.dataset.navigate as EntityId;
        focusEntity(targetId);
      });
    });
}

function hidePopCard(): void {
  popcardEl.innerHTML = "";
}

/** Convert world bounds to screen pixel position for pop card anchoring */
function worldToScreen(
  worldX: number,
  worldY: number,
): { x: number; y: number } {
  const rect = svgEl.getBoundingClientRect();
  const fracX = (worldX - camera.x) / camera.w;
  const fracY = (worldY - camera.y) / camera.h;
  return {
    x: rect.left + fracX * rect.width,
    y: rect.top + fracY * rect.height,
  };
}

// ── Actions ──────────────────────────────────────────────────────────────────

function focusEntity(entityId: EntityId): void {
  activeId = entityId;

  const bounds = getEntityBounds(entityId);
  if (bounds) {
    // Zoom to show the entity with context around it
    const focusW = clamp(bounds.w * 4, MIN_W, MAX_W);
    const target = centerOn(bounds, focusW);
    animateCamera(target);
  }

  applyHighlights();

  // Show pop card after animation settles
  setTimeout(() => {
    if (activeId === entityId && bounds) {
      const screenPt = worldToScreen(bounds.x + bounds.w, bounds.y);
      showPopCard(entityId, screenPt.x + 16, screenPt.y);
    }
  }, 420);
}

function resetView(): void {
  activeId = null;
  const resetW = computeFitW();
  animateCamera(centerOn(sb, resetW));
  applyHighlights();
  hidePopCard();
}

// ── Events: Pan ──────────────────────────────────────────────────────────────

svgEl.addEventListener("pointerdown", (e: PointerEvent) => {
  if (e.button !== 0) return;
  svgEl.setPointerCapture(e.pointerId);
  dragState = {
    pointerId: e.pointerId,
    startClientX: e.clientX,
    startClientY: e.clientY,
    startCamX: camera.x,
    startCamY: camera.y,
    moved: false,
  };
  svgEl.closest(".topology-screen")?.classList.add("topology-screen--dragging");
});

svgEl.addEventListener("pointermove", (e: PointerEvent) => {
  if (!dragState || e.pointerId !== dragState.pointerId) return;
  const dx = e.clientX - dragState.startClientX;
  const dy = e.clientY - dragState.startClientY;
  if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragState.moved = true;

  // Convert pixel delta to SVG world delta
  const rect = svgEl.getBoundingClientRect();
  const worldDx = -(dx / rect.width) * camera.w;
  const worldDy = -(dy / rect.height) * camera.h;

  camera = constrainCamera({
    ...camera,
    x: dragState.startCamX + worldDx,
    y: dragState.startCamY + worldDy,
  });
  applyCamera();
});

function endDrag(e: PointerEvent): void {
  if (!dragState || e.pointerId !== dragState.pointerId) return;
  if (dragState.moved) lastDragEndedAt = Date.now();
  dragState = null;
  svgEl
    .closest(".topology-screen")
    ?.classList.remove("topology-screen--dragging");
}

svgEl.addEventListener("pointerup", endDrag);
svgEl.addEventListener("pointercancel", endDrag);

// ── Events: Ctrl+Scroll to zoom (normal scroll passes through to browser) ───

svgEl.addEventListener(
  "wheel",
  (e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const mult = Math.exp(e.deltaY * 0.0012);
      camera = zoomAt(e.clientX, e.clientY, camera.w * mult);
      applyCamera();
    }
    // Normal scroll — don't prevent default, let browser handle it
  },
  { passive: false },
);

// ── Events: Click ────────────────────────────────────────────────────────────

document.addEventListener("click", (e: MouseEvent) => {
  if (Date.now() - lastDragEndedAt < 140) return;

  const target = e.target as Element;

  if (target.closest(".topo-popcard")) return;

  const entityEl = target.closest<HTMLElement>("[data-entity-click]");
  if (entityEl?.dataset.entityClick) {
    focusEntity(entityEl.dataset.entityClick as EntityId);
    return;
  }

  if (
    target === backgroundEl ||
    (target.closest("#topology-svg") && !target.closest("[data-entity-click]"))
  ) {
    resetView();
  }
});

document.addEventListener("keydown", (e: KeyboardEvent) => {
  if (e.key === "Escape" && activeId) resetView();
});

// ── Events: Zoom buttons ─────────────────────────────────────────────────────

document.getElementById("zoom-in")?.addEventListener("click", () => {
  const rect = svgEl.getBoundingClientRect();
  camera = zoomAt(
    rect.left + rect.width / 2,
    rect.top + rect.height / 2,
    camera.w / 1.3,
  );
  applyCamera();
});

document.getElementById("zoom-out")?.addEventListener("click", () => {
  const rect = svgEl.getBoundingClientRect();
  camera = zoomAt(
    rect.left + rect.width / 2,
    rect.top + rect.height / 2,
    camera.w * 1.3,
  );
  applyCamera();
});

document.getElementById("reset-view")?.addEventListener("click", resetView);

// ── Events: Pinch-to-zoom ────────────────────────────────────────────────────

svgEl.addEventListener(
  "touchstart",
  (e: TouchEvent) => {
    activeTouches = Array.from(e.touches).map((t) => ({
      id: t.identifier,
      x: t.clientX,
      y: t.clientY,
    }));

    if (activeTouches.length === 2) {
      e.preventDefault();
      pinchStartDist = touchDistance(activeTouches[0], activeTouches[1]);
      pinchStartW = camera.w;
    }
  },
  { passive: false },
);

svgEl.addEventListener(
  "touchmove",
  (e: TouchEvent) => {
    activeTouches = Array.from(e.touches).map((t) => ({
      id: t.identifier,
      x: t.clientX,
      y: t.clientY,
    }));

    if (activeTouches.length === 2) {
      e.preventDefault();
      const dist = touchDistance(activeTouches[0], activeTouches[1]);
      const center = touchCenter(activeTouches[0], activeTouches[1]);
      // Pinch in = smaller dist = larger viewBox width (zoom out)
      const newW = pinchStartW * (pinchStartDist / dist);
      camera = zoomAt(center.x, center.y, newW);
      applyCamera();
    }
  },
  { passive: false },
);

svgEl.addEventListener(
  "touchend",
  (e: TouchEvent) => {
    activeTouches = Array.from(e.touches).map((t) => ({
      id: t.identifier,
      x: t.clientX,
      y: t.clientY,
    }));
    if (activeTouches.length < 2) {
      pinchStartDist = 0;
    }
  },
  { passive: false },
);

// ── Events: Resize ───────────────────────────────────────────────────────────

window.addEventListener("resize", () => {
  camera = constrainCamera(camera);
  applyCamera();
});

// ── Init ─────────────────────────────────────────────────────────────────────

applyCamera();
applyHighlights();
