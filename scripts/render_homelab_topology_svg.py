#!/usr/bin/env python3

from __future__ import annotations

import json
import math
import random
from pathlib import Path
from xml.sax.saxutils import escape


WIDTH = 1480
HEIGHT = 1200
OFFSET_Y = 150
FONT_STACK = "Virgil, 'Comic Sans MS', 'Bradley Hand', cursive"
TITLE_FONT = "Virgil, 'Comic Sans MS', 'Bradley Hand', cursive"
SIDE_SIGN = {"left": -1, "right": 1, "top": -1, "bottom": 1}
VLAN_LEGEND = [
    {
        "key": "vlan10",
        "label": "VLAN10 Trusted",
        "detail": "Trusted user devices",
        "fill": "#f8fafc",
        "stroke": "#334155",
    },
    {
        "key": "vlan20",
        "label": "VLAN20 Servers",
        "detail": "Hypervisor and core services",
        "fill": "#ecfeff",
        "stroke": "#0891b2",
    },
    {
        "key": "vlan30",
        "label": "VLAN30 Mgmt",
        "detail": "Network and infra management",
        "fill": "#eef2ff",
        "stroke": "#4f46e5",
    },
    {
        "key": "vlan40",
        "label": "VLAN40 Guest",
        "detail": "Guest wireless",
        "fill": "#fefce8",
        "stroke": "#ca8a04",
    },
    {
        "key": "vlan50",
        "label": "VLAN50 IoT",
        "detail": "IoT and untrusted devices",
        "fill": "#ecfdf5",
        "stroke": "#16a34a",
    },
]


def load_spec() -> dict:
    return json.loads(
        Path("src/data/diagrams/homelab-topology.spec.json").read_text(encoding="utf-8")
    )


def center(node: dict) -> tuple[float, float]:
    return (
        node["x"] + node["width"] / 2,
        node["y"] + OFFSET_Y + node["height"] / 2,
    )


def node_bounds(node: dict) -> dict[str, float]:
    return {
        "x": node["x"],
        "y": node["y"] + OFFSET_Y,
        "width": node["width"],
        "height": node["height"],
    }


def seeded_rng(*parts: object) -> random.Random:
    return random.Random("|".join(str(part) for part in parts))


def jitter(value: float, rng: random.Random, amount: float) -> float:
    return value + rng.uniform(-amount, amount)


def sketch_path(points: list[tuple[float, float]], key: str) -> list[str]:
    paths: list[str] = []
    for attempt in range(2):
        rng = seeded_rng(key, attempt)
        stroke_width = 2.3 if attempt == 0 else 1.7
        opacity = 0.9 if attempt == 0 else 0.55
        jittered = [
            (jitter(x, rng, 2.0 if i in (0, len(points) - 1) else 3.0), jitter(y, rng, 2.0 if i in (0, len(points) - 1) else 3.0))
            for i, (x, y) in enumerate(points)
        ]
        path_data = f"M {jittered[0][0]:.1f} {jittered[0][1]:.1f}"
        for x, y in jittered[1:]:
            path_data += f" L {x:.1f} {y:.1f}"
        paths.append(
            f'<path d="{path_data}" '
            f'stroke="#4b5563" stroke-width="{stroke_width}" stroke-linecap="round" fill="none" opacity="{opacity}"/>'
        )
    return paths


def sketch_arrowhead(x1: float, y1: float, x2: float, y2: float, key: str) -> str:
    rng = seeded_rng(key, "arrow")
    angle = math.atan2(y2 - y1, x2 - x1)
    length = 12
    spread = math.pi / 7
    left_x = x2 - length * math.cos(angle - spread)
    left_y = y2 - length * math.sin(angle - spread)
    right_x = x2 - length * math.cos(angle + spread)
    right_y = y2 - length * math.sin(angle + spread)
    points = [
        (jitter(left_x, rng, 1.8), jitter(left_y, rng, 1.8)),
        (jitter(x2, rng, 1.8), jitter(y2, rng, 1.8)),
        (jitter(right_x, rng, 1.8), jitter(right_y, rng, 1.8)),
    ]
    point_str = " ".join(f"{x:.1f},{y:.1f}" for x, y in points)
    return (
        f'<polyline points="{point_str}" stroke="#4b5563" stroke-width="2" '
        'stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.85"/>'
    )


def preferred_sides(source: dict, target: dict) -> tuple[str, str]:
    sx, sy = center(source)
    tx, ty = center(target)
    dx = tx - sx
    dy = ty - sy
    if abs(dx) > abs(dy):
        return ("right", "left") if dx >= 0 else ("left", "right")
    return ("bottom", "top") if dy >= 0 else ("top", "bottom")


def anchor_for_side(bounds: dict[str, float], side: str, slot: int, total: int) -> tuple[float, float]:
    spread = total + 1
    ratio = (slot + 1) / spread
    if side in {"top", "bottom"}:
        x = bounds["x"] + bounds["width"] * (0.18 + 0.64 * ratio)
        y = bounds["y"] if side == "top" else bounds["y"] + bounds["height"]
        return x, y
    y = bounds["y"] + bounds["height"] * (0.18 + 0.64 * ratio)
    x = bounds["x"] if side == "left" else bounds["x"] + bounds["width"]
    return x, y


def dedupe_points(points: list[tuple[float, float]]) -> list[tuple[float, float]]:
    cleaned: list[tuple[float, float]] = []
    for point in points:
        if not cleaned or (
            abs(cleaned[-1][0] - point[0]) > 0.5 or abs(cleaned[-1][1] - point[1]) > 0.5
        ):
            cleaned.append(point)
    return cleaned


def route_edge(
    source_bounds: dict[str, float],
    target_bounds: dict[str, float],
    source_side: str,
    target_side: str,
    source_slot: int,
    source_total: int,
    target_slot: int,
    target_total: int,
    lane_offset: float,
) -> list[tuple[float, float]]:
    start = anchor_for_side(source_bounds, source_side, source_slot, source_total)
    end = anchor_for_side(target_bounds, target_side, target_slot, target_total)
    pad = 18
    start_stub = (
        start[0] + (pad * SIDE_SIGN[source_side] if source_side in {"left", "right"} else 0),
        start[1] + (pad * SIDE_SIGN[source_side] if source_side in {"top", "bottom"} else 0),
    )
    end_stub = (
        end[0] + (pad * SIDE_SIGN[target_side] if target_side in {"left", "right"} else 0),
        end[1] + (pad * SIDE_SIGN[target_side] if target_side in {"top", "bottom"} else 0),
    )

    points = [start, start_stub]
    if source_side in {"top", "bottom"} and target_side in {"top", "bottom"}:
        mid_y = (start_stub[1] + end_stub[1]) / 2 + lane_offset
        points.extend([(start_stub[0], mid_y), (end_stub[0], mid_y)])
    elif source_side in {"left", "right"} and target_side in {"left", "right"}:
        mid_x = (start_stub[0] + end_stub[0]) / 2 + lane_offset
        points.extend([(mid_x, start_stub[1]), (mid_x, end_stub[1])])
    elif source_side in {"left", "right"}:
        bend_x = end_stub[0] + lane_offset
        points.extend([(bend_x, start_stub[1]), (bend_x, end_stub[1])])
    else:
        bend_y = end_stub[1] + lane_offset
        points.extend([(start_stub[0], bend_y), (end_stub[0], bend_y)])
    points.extend([end_stub, end])
    return dedupe_points(points)


def label_position(points: list[tuple[float, float]]) -> tuple[float, float]:
    longest_index = 0
    longest_length = -1.0
    for i in range(len(points) - 1):
        x1, y1 = points[i]
        x2, y2 = points[i + 1]
        length = abs(x2 - x1) + abs(y2 - y1)
        if length > longest_length:
            longest_length = length
            longest_index = i
    x1, y1 = points[longest_index]
    x2, y2 = points[longest_index + 1]
    if abs(x2 - x1) >= abs(y2 - y1):
        return ((x1 + x2) / 2, y1 - 14)
    return (x1 + 34, (y1 + y2) / 2)


def rounded_rect_path(x: float, y: float, w: float, h: float, r: float, key: str, attempt: int) -> str:
    rng = seeded_rng(key, attempt)
    tlx, tly = jitter(x + r, rng, 2.5), jitter(y, rng, 2.5)
    trx, try_ = jitter(x + w - r, rng, 2.5), jitter(y, rng, 2.5)
    rtx, rty = jitter(x + w, rng, 2.5), jitter(y + r, rng, 2.5)
    rbx, rby = jitter(x + w, rng, 2.5), jitter(y + h - r, rng, 2.5)
    brx, bry = jitter(x + w - r, rng, 2.5), jitter(y + h, rng, 2.5)
    blx, bly = jitter(x + r, rng, 2.5), jitter(y + h, rng, 2.5)
    lbx, lby = jitter(x, rng, 2.5), jitter(y + h - r, rng, 2.5)
    ltx, lty = jitter(x, rng, 2.5), jitter(y + r, rng, 2.5)
    return (
        f"M {tlx:.1f} {tly:.1f} "
        f"Q {jitter(x + w * 0.78, rng, 4):.1f} {jitter(y, rng, 4):.1f} {trx:.1f} {try_:.1f} "
        f"Q {jitter(x + w, rng, 4):.1f} {jitter(y + h * 0.22, rng, 4):.1f} {rtx:.1f} {rty:.1f} "
        f"Q {jitter(x + w, rng, 4):.1f} {jitter(y + h * 0.78, rng, 4):.1f} {rbx:.1f} {rby:.1f} "
        f"Q {jitter(x + w * 0.22, rng, 4):.1f} {jitter(y + h, rng, 4):.1f} {blx:.1f} {bly:.1f} "
        f"Q {jitter(x, rng, 4):.1f} {jitter(y + h * 0.78, rng, 4):.1f} {lbx:.1f} {lby:.1f} "
        f"Q {jitter(x, rng, 4):.1f} {jitter(y + h * 0.22, rng, 4):.1f} {tlx:.1f} {tly:.1f} Z"
    )


def sketch_node(node: dict) -> list[str]:
    x = node["x"]
    y = node["y"] + OFFSET_Y
    w = node["width"]
    h = node["height"]
    key = node["id"]
    parts = [
        f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="22" fill="{node["fill"]}"/>'
    ]
    for attempt in range(2):
        stroke_width = "2.2" if attempt == 0 else "1.5"
        opacity = "0.96" if attempt == 0 else "0.58"
        parts.append(
            f'<path d="{rounded_rect_path(x, y, w, h, 22, key, attempt)}" '
            f'stroke="{node["stroke"]}" stroke-width="{stroke_width}" fill="none" opacity="{opacity}" '
            'stroke-linecap="round" stroke-linejoin="round"/>'
        )

    lines = [escape(line) for line in node["label"].split("\n")]
    cx = x + w / 2
    cy = y + h / 2
    start_y = cy - ((len(lines) - 1) * 14)
    for index, line in enumerate(lines):
        rng = seeded_rng(key, "text", index)
        rotation = rng.uniform(-1.1, 1.1)
        weight = "700" if index == 0 else "500"
        size = "18" if index == 0 else "15"
        parts.append(
            f'<text x="{cx:.1f}" y="{start_y + index * 28:.1f}" fill="#1f2937" font-size="{size}" '
            f'font-family="{FONT_STACK}" font-weight="{weight}" text-anchor="middle" '
            f'transform="rotate({rotation:.2f} {cx:.1f} {start_y + index * 28:.1f})">{line}</text>'
        )
    return parts


def sketch_vlan_legend(x: float, y: float) -> list[str]:
    width = 430
    row_height = 29
    header_height = 50
    footer_height = 30
    height = header_height + len(VLAN_LEGEND) * row_height + footer_height
    parts = [f'<rect x="{x}" y="{y}" width="{width}" height="{height}" rx="20" fill="#fffdfa"/>']
    for attempt in range(2):
        stroke_width = "2.0" if attempt == 0 else "1.3"
        opacity = "0.92" if attempt == 0 else "0.5"
        parts.append(
            f'<path d="{rounded_rect_path(x, y, width, height, 20, "vlan-legend", attempt)}" '
            f'stroke="#cbd5e1" stroke-width="{stroke_width}" fill="none" opacity="{opacity}" '
            'stroke-linecap="round" stroke-linejoin="round"/>'
        )

    parts.append(
        f'<text x="{x + 22}" y="{y + 30}" fill="#0f172a" font-size="20" font-family="{FONT_STACK}" '
        'font-weight="700">VLAN Split</text>'
    )
    divider_y = y + 42
    parts.append(
        f'<line x1="{x + 20}" y1="{divider_y}" x2="{x + width - 20}" y2="{divider_y}" '
        'stroke="#e2e8f0" stroke-width="1.2" stroke-linecap="round"/>'
    )
    base_y = y + 59
    for index, item in enumerate(VLAN_LEGEND):
        row_y = base_y + index * row_height
        chip_x = x + 20
        chip_y = row_y - 13
        chip_w = 30
        chip_h = 18
        parts.append(
            f'<rect x="{chip_x}" y="{chip_y}" width="{chip_w}" height="{chip_h}" rx="7" fill="{item["fill"]}"/>'
        )
        for attempt in range(2):
            parts.append(
                f'<path d="{rounded_rect_path(chip_x, chip_y, chip_w, chip_h, 7, item["key"], attempt)}" '
                f'stroke="{item["stroke"]}" stroke-width="{2.0 if attempt == 0 else 1.2}" fill="none" '
                f'opacity="{0.94 if attempt == 0 else 0.55}" stroke-linecap="round" stroke-linejoin="round"/>'
            )
        parts.append(
            f'<text x="{x + 66}" y="{row_y}" fill="#1f2937" font-size="14" font-family="{FONT_STACK}" '
            f'font-weight="700">{escape(item["label"])}</text>'
        )
        parts.append(
            f'<text x="{x + 190}" y="{row_y}" fill="#64748b" font-size="12.5" font-family="{FONT_STACK}">{escape(item["detail"])}</text>'
        )

    footer_y = y + height - 12
    parts.append(
        f'<text x="{x + 20}" y="{footer_y}" fill="#64748b" font-size="11.5" font-family="{FONT_STACK}">'
        'AP mgmt on VLAN30; SSIDs carry VLAN10/40/50.</text>'
    )
    return parts


def build_svg(spec: dict) -> str:
    nodes = {node["id"]: node for node in spec["nodes"]}
    edges = spec["edges"]
    side_usage: dict[tuple[str, str], list[str]] = {}
    edge_sides: dict[str, tuple[str, str]] = {}
    for edge in edges:
        edge_key = f'{edge["from"]}-{edge["to"]}'
        source_side, target_side = preferred_sides(nodes[edge["from"]], nodes[edge["to"]])
        edge_sides[edge_key] = (source_side, target_side)
        side_usage.setdefault((edge["from"], source_side), []).append(edge_key)
        side_usage.setdefault((edge["to"], target_side), []).append(edge_key)

    lane_groups: dict[str, list[str]] = {}
    for edge in edges:
        edge_key = f'{edge["from"]}-{edge["to"]}'
        source_side, target_side = edge_sides[edge_key]
        orientation = "vertical" if source_side in {"top", "bottom"} and target_side in {"top", "bottom"} else "horizontal"
        lane_groups.setdefault(f"{edge['from']}:{orientation}", []).append(edge_key)

    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{WIDTH}" height="{HEIGHT}" viewBox="0 0 {WIDTH} {HEIGHT}" fill="none">',
        "  <defs>",
        '    <filter id="paperShadow" x="-10%" y="-10%" width="120%" height="120%">',
        '      <feDropShadow dx="0" dy="12" stdDeviation="18" flood-color="#0f172a" flood-opacity="0.08"/>',
        "    </filter>",
        '    <linearGradient id="paperBg" x1="0" y1="0" x2="1" y2="1">',
        '      <stop offset="0%" stop-color="#fffdf8"/>',
        '      <stop offset="100%" stop-color="#f8fbff"/>',
        "    </linearGradient>",
        "  </defs>",
        f'  <rect width="{WIDTH}" height="{HEIGHT}" fill="url(#paperBg)" rx="28"/>',
        f'  <g filter="url(#paperShadow)"><rect x="18" y="18" width="{WIDTH - 56}" height="{HEIGHT - 90}" rx="22" fill="#fffdfa"/></g>',
    ]

    title_x = 58
    title_y = 74
    parts.append(
        f'  <text x="{title_x}" y="{title_y}" fill="#0f172a" font-size="35" font-family="{TITLE_FONT}" font-weight="700" transform="rotate(-0.9 {title_x} {title_y})">Homelab Topology</text>'
    )
    parts.append(
        f'  <text x="58" y="108" fill="#475569" font-size="18" font-family="{FONT_STACK}" transform="rotate(-0.4 58 108)">Excalidraw-style sketch render linked from the site.</text>'
    )

    parts.extend(f"  {item}" for item in sketch_vlan_legend(WIDTH - 490, 56))

    for edge in edges:
        source = nodes[edge["from"]]
        target = nodes[edge["to"]]
        edge_key = f'{edge["from"]}-{edge["to"]}'
        source_side, target_side = edge_sides[edge_key]
        source_edges = side_usage[(edge["from"], source_side)]
        target_edges = side_usage[(edge["to"], target_side)]
        orientation = "vertical" if source_side in {"top", "bottom"} and target_side in {"top", "bottom"} else "horizontal"
        lane_edges = lane_groups[f"{edge['from']}:{orientation}"]
        lane_index = lane_edges.index(edge_key)
        lane_offset = (lane_index - (len(lane_edges) - 1) / 2) * 18
        points = route_edge(
            node_bounds(source),
            node_bounds(target),
            source_side,
            target_side,
            source_edges.index(edge_key),
            len(source_edges),
            target_edges.index(edge_key),
            len(target_edges),
            lane_offset,
        )
        parts.extend(f"  {path}" for path in sketch_path(points, edge_key))
        parts.append(f"  {sketch_arrowhead(points[-2][0], points[-2][1], points[-1][0], points[-1][1], edge_key)}")
    for node in spec["nodes"]:
        parts.extend(f"  {item}" for item in sketch_node(node))

    parts.append("</svg>")
    return "\n".join(parts) + "\n"


def main() -> None:
    spec = load_spec()
    svg = build_svg(spec)
    Path("public/diagrams/homelab-topology.svg").write_text(svg, encoding="utf-8")


if __name__ == "__main__":
    main()
