import {
  entities,
  type EntityId,
  type Entity,
} from "../data/topology/entities";
import { overviewLayout, type ViewMode } from "../data/topology/layout";

// ── Types ────────────────────────────────────────────────────────────────────

type Camera = { tx: number; ty: number; scale: number };
type Bounds = { x: number; y: number; w: number; h: number };
type DragState = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startTx: number;
  startTy: number;
  moved: boolean;
};

// ── Constants ────────────────────────────────────────────────────────────────

const VIEWBOX_W = 6588.16666666667;
const VIEWBOX_H = 4878.970184856642;
const SCENE_PADDING = 260;
const MIN_SCALE = 1;
const MAX_SCALE = 2.35;

const VIEW_MODE_HINTS: Record<ViewMode, string> = {
  overview: "Balanced physical, runtime, and policy context",
  runtime: "Emphasize Proxmox placement and hosted workloads",
  trust: "Emphasize VLAN lanes and firewall policy flows",
};

const trustFrameIds = new Set<string>([
  "management-lane",
  "service-lane",
  "signal-lane",
  "automation-lane",
]);

// Node stroke palette (by hardware row id or by tone)
const hardwareRowStrokes: Record<string, string> = {
  opnsense: "#7ed0ff",
  proxmox: "#9de07e",
  "unifi-ap": "#7adfd1",
  "bazzite-pc": "#d7a4ff",
  jetkvm: "#ffb27d",
  nas: "#f2d177",
};

const nodeToneStrokes: Record<string, string> = {
  edge: "#7ed0ff",
  network: "#7fb2ff",
  platform: "#9de07e",
  runtime: "#f2c779",
  device: "#f7ae73",
  client: "#e79cff",
};

const chipToneStrokes: Record<string, string> = {
  service: "#8ee49a",
  controller: "#8ec7ff",
  monitoring: "#85e0d8",
  agent: "#f1c575",
  utility: "#b6b4ff",
};

const frameToneStrokes: Record<string, string> = {
  hardware: "#456886",
  compute: "#314b63",
  management: "#75c7ff",
  service: "#84db91",
  signal: "#7fd8d0",
  automation: "#f1c575",
};

const edgeKindStrokes: Record<string, string> = {
  physical: "#7d95ac",
  runtime: "#f2c779",
  policy: "#79d89c",
};

// ── DOM refs ─────────────────────────────────────────────────────────────────

const svg = document.getElementById("topology-svg") as unknown as SVGSVGElement;
const cameraEl = document.getElementById(
  "topology-camera",
) as unknown as SVGGElement;
const bgEl = document.getElementById(
  "topology-bg",
) as unknown as SVGRectElement;
const drawer = document.getElementById("detail-drawer") as HTMLElement;
const hintEl = document.getElementById("view-mode-hint") as HTMLElement;

// ── State ────────────────────────────────────────────────────────────────────

let camera: Camera;
let activeId: EntityId | null = null;
let hoveredId: EntityId | null = null;
let viewMode: ViewMode = "overview";
let dragState: DragState | null = null;
let lastDragEndedAt = 0;

// ── Camera math ──────────────────────────────────────────────────────────────

function computeSceneBounds(): Bounds {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  for (const frame of overviewLayout.frames) {
    minX = Math.min(minX, frame.x);
    minY = Math.min(minY, frame.y);
    maxX = Math.max(maxX, frame.x + frame.w);
    maxY = Math.max(maxY, frame.y + frame.h);
  }
  for (const node of overviewLayout.nodes) {
    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
    maxX = Math.max(maxX, node.x + node.w);
    maxY = Math.max(maxY, node.y + node.h);
  }

  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function constrainCamera(c: Camera): Camera {
  const scale = clamp(c.scale, MIN_SCALE, MAX_SCALE);
  const rect = svg.getBoundingClientRect();
  const vpW = rect.width || window.innerWidth;
  const vpH = rect.height || window.innerHeight;

  // SVG units per screen pixel
  const svgPxX = VIEWBOX_W / vpW;
  const svgPxY = VIEWBOX_H / vpH;

  // Scene extents in screen pixels at current scale
  const scenePadPx = SCENE_PADDING / svgPxX;
  const sceneMinTx =
    -(sceneBounds.x + sceneBounds.w) * (scale / svgPxX) + vpW - scenePadPx;
  const sceneMaxTx = (-sceneBounds.x * scale) / svgPxX + scenePadPx;
  const sceneMinTy =
    -(sceneBounds.y + sceneBounds.h) * (scale / svgPxY) +
    vpH -
    (scenePadPx / svgPxY) * svgPxX;
  const sceneMaxTy =
    (-sceneBounds.y * scale) / svgPxY + (scenePadPx / svgPxX) * svgPxY;

  return {
    scale,
    tx: clamp(c.tx, sceneMinTx, sceneMaxTx),
    ty: clamp(c.ty, sceneMinTy, sceneMaxTy),
  };
}

function centerCameraForBounds(bounds: Bounds, scale: number): Camera {
  const rect = svg.getBoundingClientRect();
  const vpW = rect.width || window.innerWidth;
  const vpH = rect.height || window.innerHeight;

  const svgPxX = VIEWBOX_W / vpW;
  const svgPxY = VIEWBOX_H / vpH;

  // Center of subject in SVG coords
  const cx = bounds.x + bounds.w / 2;
  const cy = bounds.y + bounds.h / 2;

  // Translate so subject center maps to viewport center
  const tx = vpW / 2 - (cx * scale) / svgPxX;
  const ty = vpH / 2 - (cy * scale) / svgPxY;

  return constrainCamera({ tx, ty, scale });
}

function zoomCamera(
  cam: Camera,
  anchorX: number,
  anchorY: number,
  nextScale: number,
): Camera {
  const clamped = clamp(nextScale, MIN_SCALE, MAX_SCALE);
  const ratio = clamped / cam.scale;
  return constrainCamera({
    scale: clamped,
    tx: anchorX - ratio * (anchorX - cam.tx),
    ty: anchorY - ratio * (anchorY - cam.ty),
  });
}

// ── Scene bounds (computed once) ─────────────────────────────────────────────

const sceneBounds = computeSceneBounds();

// Init camera centered on whole scene
camera = centerCameraForBounds(sceneBounds, 1);
const DEFAULT_CAMERA: Camera = { ...camera };

// ── Entity bounds lookup ─────────────────────────────────────────────────────

function getEntityBounds(entityId: string): Bounds | null {
  // Check frames by entityId
  for (const frame of overviewLayout.frames) {
    if (frame.entityId === entityId) {
      return { x: frame.x, y: frame.y, w: frame.w, h: frame.h };
    }
  }

  // Check nodes by id
  for (const node of overviewLayout.nodes) {
    if (node.id === entityId) {
      return { x: node.x, y: node.y, w: node.w, h: node.h };
    }
    // Check chips
    if (node.chips) {
      for (const chip of node.chips) {
        if (chip.id === entityId) {
          return {
            x: node.x + chip.x,
            y: node.y + chip.y,
            w: chip.w,
            h: chip.h,
          };
        }
      }
    }
  }

  return null;
}

// ── Highlight set ────────────────────────────────────────────────────────────

function buildHighlightSet(focusId: string | null): Set<string> {
  if (!focusId) return new Set();
  const set = new Set<string>();
  set.add(focusId);

  const entity = (entities as Record<string, Entity>)[focusId];
  if (entity?.related) {
    for (const r of entity.related) set.add(r);
  }

  // If focusId is a chip, highlight the parent node and siblings
  for (const node of overviewLayout.nodes) {
    if (node.chips) {
      const isChip = node.chips.some((c) => c.id === focusId);
      if (isChip || node.id === focusId) {
        set.add(node.id);
        for (const chip of node.chips) set.add(chip.id);
      }
    }
  }

  // If focusId is a frame entityId, highlight its members
  for (const frame of overviewLayout.frames) {
    if (frame.entityId === focusId && frame.members) {
      for (const m of frame.members) set.add(m);
    }
  }

  // Highlight edges where both endpoints are in the highlight set
  for (const edge of overviewLayout.edges) {
    if (set.has(edge.from) || set.has(edge.to)) {
      set.add(edge.id);
    }
  }

  // Also highlight the frame that owns the entityId
  for (const frame of overviewLayout.frames) {
    if (frame.entityId && set.has(frame.entityId)) {
      set.add(frame.id);
    }
  }

  return set;
}

// ── Rendering ────────────────────────────────────────────────────────────────

function applyCamera(): void {
  cameraEl.setAttribute(
    "transform",
    `translate(${camera.tx} ${camera.ty}) scale(${camera.scale})`,
  );
}

function edgeOpacity(kind: string): number {
  if (viewMode === "overview") {
    if (kind === "physical") return 0.9;
    if (kind === "runtime") return 0.88;
    return 0.75; // policy
  }
  if (viewMode === "runtime") {
    if (kind === "runtime") return 0.96;
    if (kind === "physical") return 0.24;
    return 0.12; // policy
  }
  // trust
  if (kind === "policy") return 0.96;
  if (kind === "physical") return 0.18;
  return 0.26; // runtime
}

function applyHighlights(): void {
  const focused = activeId ?? hoveredId;
  const highlights = buildHighlightSet(focused);
  const hasHighlight = Boolean(focused);

  // Frames
  document.querySelectorAll<SVGGElement>("[data-frame-id]").forEach((el) => {
    const frameId = el.dataset.frameId!;
    const rect = el.querySelector("rect");
    if (!rect) return;

    // Find frame tone for palette reset
    const frame = overviewLayout.frames.find((f) => f.id === frameId);
    const paletteStroke = frame ? frameToneStrokes[frame.tone] : "#456886";

    if (!hasHighlight) {
      rect.setAttribute("stroke", paletteStroke);
      rect.setAttribute("stroke-width", "2");
      return;
    }

    if (
      highlights.has(frameId) ||
      (frame?.entityId && highlights.has(frame.entityId))
    ) {
      rect.setAttribute("stroke", "#f6fbff");
      rect.setAttribute("stroke-width", "10");
    } else {
      rect.setAttribute("stroke", paletteStroke);
      rect.setAttribute("stroke-width", "6");
    }
  });

  // Nodes
  document.querySelectorAll<SVGGElement>("[data-node-id]").forEach((el) => {
    const nodeId = el.dataset.nodeId!;
    const rect = el.querySelector("rect");
    if (!rect) return;

    const node = overviewLayout.nodes.find((n) => n.id === nodeId);
    const paletteStroke =
      hardwareRowStrokes[nodeId] ??
      (node ? nodeToneStrokes[node.tone] : "#7ed0ff");

    if (!hasHighlight) {
      rect.setAttribute("stroke", paletteStroke);
      rect.setAttribute("stroke-width", "2.5");
      return;
    }

    if (nodeId === activeId) {
      rect.setAttribute("stroke", "#f6fbff");
      rect.setAttribute("stroke-width", "12");
    } else if (highlights.has(nodeId)) {
      rect.setAttribute("stroke", "#d9ebfb");
      rect.setAttribute("stroke-width", "9");
    } else {
      rect.setAttribute("stroke", paletteStroke);
      rect.setAttribute("stroke-width", "2.5");
    }
  });

  // Chips
  document.querySelectorAll<SVGGElement>("[data-chip-id]").forEach((el) => {
    const chipId = el.dataset.chipId!;
    const rect = el.querySelector("rect");
    if (!rect) return;

    // Find chip tone
    let paletteStroke = "#8ee49a";
    for (const node of overviewLayout.nodes) {
      if (node.chips) {
        const chip = node.chips.find((c) => c.id === chipId);
        if (chip) {
          paletteStroke = chipToneStrokes[chip.tone];
          break;
        }
      }
    }

    if (!hasHighlight) {
      rect.setAttribute("stroke", paletteStroke);
      rect.setAttribute("stroke-width", "1.5");
      return;
    }

    if (chipId === activeId) {
      rect.setAttribute("stroke", "#f6fbff");
      rect.setAttribute("stroke-width", "8");
    } else if (highlights.has(chipId)) {
      rect.setAttribute("stroke", "#d9ebfb");
      rect.setAttribute("stroke-width", "6");
    } else {
      rect.setAttribute("stroke", paletteStroke);
      rect.setAttribute("stroke-width", "1.5");
    }
  });

  // Edges
  document.querySelectorAll<SVGGElement>("[data-edge-id]").forEach((el) => {
    const edgeId = el.dataset.edgeId!;
    const kind = el.dataset.edgeKind ?? "physical";
    const line = el.querySelector("polyline");
    if (!line) return;

    const paletteStroke = edgeKindStrokes[kind] ?? "#7d95ac";
    const opacity = edgeOpacity(kind);

    if (!hasHighlight) {
      line.setAttribute("stroke", paletteStroke);
      line.setAttribute("stroke-opacity", String(opacity));
      line.setAttribute("stroke-width", kind === "policy" ? "8" : "10");
      return;
    }

    if (highlights.has(edgeId)) {
      line.setAttribute("stroke", "#f6fbff");
      line.setAttribute("stroke-opacity", "1");
      line.setAttribute("stroke-width", "12");
    } else {
      line.setAttribute("stroke", paletteStroke);
      line.setAttribute("stroke-opacity", String(opacity * 0.3));
      line.setAttribute("stroke-width", kind === "policy" ? "8" : "10");
    }
  });
}

function applyViewMode(): void {
  document.querySelectorAll<SVGGElement>("[data-frame-id]").forEach((el) => {
    const entityId = el.dataset.entityId ?? "";
    const isTrustFrame = trustFrameIds.has(entityId);

    let opacity: number;
    if (viewMode === "trust") {
      opacity = isTrustFrame ? 1 : 0.78;
    } else if (viewMode === "runtime") {
      opacity = isTrustFrame ? 0.4 : 0.78;
    } else {
      opacity = 0.78;
    }

    el.setAttribute("opacity", String(opacity));
  });

  // Update edge opacity for view mode
  document.querySelectorAll<SVGGElement>("[data-edge-id]").forEach((el) => {
    const kind = el.dataset.edgeKind ?? "physical";
    const line = el.querySelector("polyline");
    if (!line) return;
    // Only update opacity if not highlighted
    if (!activeId && !hoveredId) {
      line.setAttribute("stroke-opacity", String(edgeOpacity(kind)));
    }
  });
}

function render(): void {
  applyCamera();
  applyHighlights();
  applyViewMode();
}

// ── Drawer ───────────────────────────────────────────────────────────────────

function renderDrawer(): void {
  if (!activeId) {
    drawer.className = "drawer-panel drawer-panel--empty";
    drawer.innerHTML = `
      <p class="drawer-eyebrow">Interactive overview</p>
      <h2>The map is the page.</h2>
      <p class="drawer-summary">Drag to pan, use the mouse wheel to zoom, and click a host, service, or VLAN lane to focus that part of the lab.</p>
      <div class="drawer-badges">
        <span class="drawer-badge">Drag to pan</span>
        <span class="drawer-badge">Wheel to zoom</span>
        <span class="drawer-badge">Click to focus</span>
      </div>
    `;
    return;
  }

  const entity = (entities as Record<string, Entity>)[activeId];
  if (!entity) return;

  drawer.className = "drawer-panel drawer-panel--active";

  const badgesHtml = entity.badges
    .map((b) => `<span class="drawer-badge">${escHtml(b)}</span>`)
    .join("");

  const relatedHtml =
    entity.related.length > 0
      ? `<div class="drawer-related">
        <p class="drawer-related__label">Related</p>
        <div class="drawer-related__list">
          ${entity.related
            .map((id) => {
              const rel = (entities as Record<string, Entity>)[id];
              const title = rel ? rel.title : id;
              return `<button class="drawer-related__btn" data-entity-click="${escAttr(id)}">${escHtml(title)}</button>`;
            })
            .join("")}
        </div>
      </div>`
      : "";

  const sectionsHtml = entity.sections
    .map(
      (s) => `
      <div class="drawer-section">
        <h3 class="drawer-section__title">${escHtml(s.title)}</h3>
        <ul class="drawer-section__list">
          ${s.items.map((item) => `<li>${escHtml(item)}</li>`).join("")}
        </ul>
      </div>
    `,
    )
    .join("");

  drawer.innerHTML = `
    <div class="drawer-heading-row">
      <p class="drawer-eyebrow">${escHtml(entity.kind)}</p>
      <button class="drawer-dismiss" aria-label="Close detail panel">✕</button>
    </div>
    <h2 class="drawer-title">${escHtml(entity.title)}</h2>
    <p class="drawer-summary">${escHtml(entity.summary)}</p>
    <div class="drawer-badges">${badgesHtml}</div>
    ${relatedHtml}
    ${sectionsHtml}
  `;

  drawer.querySelector(".drawer-dismiss")?.addEventListener("click", resetView);
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escAttr(str: string): string {
  return str.replace(/"/g, "&quot;");
}

// ── Actions ──────────────────────────────────────────────────────────────────

function focusEntity(entityId: EntityId): void {
  activeId = entityId;
  hoveredId = null;

  const bounds = getEntityBounds(entityId);
  if (bounds) {
    const focusScale = clamp(
      Math.min((VIEWBOX_W * 0.32) / bounds.w, (VIEWBOX_H * 0.38) / bounds.h),
      MIN_SCALE,
      MAX_SCALE,
    );
    camera = centerCameraForBounds(bounds, focusScale);
  }

  render();
  renderDrawer();
}

function resetView(): void {
  activeId = null;
  hoveredId = null;
  camera = { ...DEFAULT_CAMERA };
  render();
  renderDrawer();
}

// ── Event: Pan ───────────────────────────────────────────────────────────────

svg.addEventListener("pointerdown", (e: PointerEvent) => {
  if (e.button !== 0) return;
  svg.setPointerCapture(e.pointerId);
  dragState = {
    pointerId: e.pointerId,
    startClientX: e.clientX,
    startClientY: e.clientY,
    startTx: camera.tx,
    startTy: camera.ty,
    moved: false,
  };
  svg.closest(".topology-screen")?.classList.add("topology-screen--dragging");
});

svg.addEventListener("pointermove", (e: PointerEvent) => {
  if (!dragState || e.pointerId !== dragState.pointerId) return;
  const dx = e.clientX - dragState.startClientX;
  const dy = e.clientY - dragState.startClientY;
  if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragState.moved = true;
  camera = constrainCamera({
    scale: camera.scale,
    tx: dragState.startTx + dx,
    ty: dragState.startTy + dy,
  });
  applyCamera();
});

function endDrag(e: PointerEvent): void {
  if (!dragState || e.pointerId !== dragState.pointerId) return;
  if (dragState.moved) lastDragEndedAt = Date.now();
  dragState = null;
  svg
    .closest(".topology-screen")
    ?.classList.remove("topology-screen--dragging");
}

svg.addEventListener("pointerup", endDrag);
svg.addEventListener("pointercancel", endDrag);

// ── Event: Zoom ──────────────────────────────────────────────────────────────

svg.addEventListener(
  "wheel",
  (e: WheelEvent) => {
    e.preventDefault();
    const rect = svg.getBoundingClientRect();
    const anchorX = e.clientX - rect.left;
    const anchorY = e.clientY - rect.top;
    const multiplier = Math.exp(-e.deltaY * 0.0012);
    camera = zoomCamera(camera, anchorX, anchorY, camera.scale * multiplier);
    applyCamera();
  },
  { passive: false },
);

// ── Event: Click (delegated) ─────────────────────────────────────────────────

document.addEventListener("click", (e: MouseEvent) => {
  if (Date.now() - lastDragEndedAt < 140) return;

  const target = e.target as Element;
  const entityBtn = target.closest<HTMLElement>("[data-entity-click]");

  if (entityBtn?.dataset.entityClick) {
    focusEntity(entityBtn.dataset.entityClick as EntityId);
    return;
  }

  // Click on SVG background → reset
  if (target === bgEl || target.closest("#topology-svg")) {
    resetView();
  }
});

// ── Event: Hover ─────────────────────────────────────────────────────────────

svg.addEventListener("mouseover", (e: MouseEvent) => {
  if (activeId) return; // don't change hover highlights when something is focused
  const target = e.target as Element;
  const entityEl = target.closest<HTMLElement>("[data-entity-click]");
  const newHover = (entityEl?.dataset.entityClick as EntityId) ?? null;
  if (newHover !== hoveredId) {
    hoveredId = newHover;
    applyHighlights();
  }
});

svg.addEventListener("mouseout", (e: MouseEvent) => {
  if (activeId) return;
  const related = e.relatedTarget as Element | null;
  if (related && svg.contains(related)) return;
  hoveredId = null;
  applyHighlights();
});

// ── Event: Zoom buttons ──────────────────────────────────────────────────────

document.getElementById("zoom-in")?.addEventListener("click", () => {
  const rect = svg.getBoundingClientRect();
  const anchorX = rect.width / 2;
  const anchorY = rect.height / 2;
  camera = zoomCamera(camera, anchorX, anchorY, camera.scale * 1.15);
  applyCamera();
});

document.getElementById("zoom-out")?.addEventListener("click", () => {
  const rect = svg.getBoundingClientRect();
  const anchorX = rect.width / 2;
  const anchorY = rect.height / 2;
  camera = zoomCamera(camera, anchorX, anchorY, camera.scale / 1.15);
  applyCamera();
});

document.getElementById("reset-view")?.addEventListener("click", resetView);

// ── Event: View mode ─────────────────────────────────────────────────────────

document
  .querySelectorAll<HTMLButtonElement>("[data-view-mode]")
  .forEach((btn) => {
    btn.addEventListener("click", () => {
      viewMode = btn.dataset.viewMode as ViewMode;

      document
        .querySelectorAll<HTMLButtonElement>("[data-view-mode]")
        .forEach((b) => {
          const isActive = b === btn;
          b.classList.toggle("topology-button--active", isActive);
          b.setAttribute("aria-selected", String(isActive));
        });

      if (hintEl) hintEl.textContent = VIEW_MODE_HINTS[viewMode];

      render();
    });
  });

// ── Init ─────────────────────────────────────────────────────────────────────

render();
renderDrawer();
