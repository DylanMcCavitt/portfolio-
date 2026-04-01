import type { EntityId } from "./entities";

export type FrameTone = "management" | "service" | "signal" | "automation";
export type NodeTone =
  | "edge"
  | "network"
  | "platform"
  | "runtime"
  | "device"
  | "client";
export type ChipTone =
  | "service"
  | "controller"
  | "monitoring"
  | "agent"
  | "utility";

export type MapFrame = {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  tone: FrameTone;
  entityId?: EntityId;
  members?: EntityId[];
};

export type MapChip = {
  id: EntityId;
  label: string;
  tone: ChipTone;
};

export type MapNode = {
  id: EntityId;
  x: number;
  y: number;
  w: number;
  h: number;
  tone: NodeTone;
  eyebrow?: string;
  label?: string;
  caption?: string;
  chips?: MapChip[];
};

export type MapEdge = {
  id: string;
  from: EntityId;
  to: EntityId;
  kind: "physical" | "runtime" | "policy";
  path: string;
  label?: string;
  dashed?: boolean;
};

export const layout = {
  viewBox: "0 0 1200 1000",

  frames: [
    {
      id: "management-frame",
      label: "Management",
      x: 40,
      y: 390,
      w: 210,
      h: 200,
      tone: "management",
      entityId: "management-lane",
      members: ["unifi-vm", "unifi-controller"],
    },
    {
      id: "service-frame",
      label: "Services",
      x: 270,
      y: 390,
      w: 340,
      h: 310,
      tone: "service",
      entityId: "service-lane",
      members: ["shared-vm", "caddy", "ingress", "homepage", "vaultwarden"],
    },
    {
      id: "signal-frame",
      label: "Monitoring",
      x: 630,
      y: 390,
      w: 210,
      h: 200,
      tone: "signal",
      entityId: "signal-lane",
      members: ["kuma-lxc", "uptime-kuma"],
    },
    {
      id: "automation-frame",
      label: "Automation",
      x: 860,
      y: 390,
      w: 190,
      h: 200,
      tone: "automation",
      entityId: "automation-lane",
      members: ["hermes-vm", "hermes"],
    },
  ],

  nodes: [
    // ── Edge tier ──
    {
      id: "isp",
      x: 520,
      y: 30,
      w: 160,
      h: 60,
      tone: "edge",
      eyebrow: "WAN",
      label: "ISP",
      caption: "Upstream handoff",
    },

    // ── Infrastructure tier ──
    {
      id: "opnsense",
      x: 200,
      y: 160,
      w: 200,
      h: 80,
      tone: "edge",
      eyebrow: "Firewall",
      label: "OPNsense",
      caption: "Routing, DNS, policy",
    },
    {
      id: "switch",
      x: 450,
      y: 160,
      w: 180,
      h: 80,
      tone: "network",
      eyebrow: "Core Fabric",
      label: "Switch",
      caption: "Port map hub",
    },
    {
      id: "proxmox",
      x: 680,
      y: 160,
      w: 200,
      h: 80,
      tone: "platform",
      eyebrow: "Hypervisor",
      label: "Proxmox",
      caption: "VM & LXC host",
    },

    // ── Zone tier: Management ──
    {
      id: "unifi-vm",
      x: 55,
      y: 420,
      w: 180,
      h: 100,
      tone: "runtime",
      eyebrow: "VM1",
      label: "UniFi VM",
      caption: "Controller lane",
      chips: [
        {
          id: "unifi-controller",
          label: "UniFi Controller",
          tone: "controller",
        },
      ],
    },

    // ── Zone tier: Services ──
    {
      id: "shared-vm",
      x: 285,
      y: 420,
      w: 310,
      h: 250,
      tone: "runtime",
      eyebrow: "VM2",
      label: "Shared VM",
      caption: "Ubuntu + Docker Compose",
      chips: [
        { id: "caddy", label: "Caddy", tone: "service" },
        { id: "ingress", label: "Ingress", tone: "utility" },
        { id: "homepage", label: "Homepage", tone: "utility" },
        { id: "vaultwarden", label: "Vaultwarden", tone: "service" },
      ],
    },

    // ── Zone tier: Monitoring ──
    {
      id: "kuma-lxc",
      x: 645,
      y: 420,
      w: 180,
      h: 130,
      tone: "runtime",
      eyebrow: "LXC",
      label: "Kuma",
      caption: "Independent checks",
      chips: [{ id: "uptime-kuma", label: "Uptime Kuma", tone: "monitoring" }],
    },

    // ── Zone tier: Automation ──
    {
      id: "hermes-vm",
      x: 870,
      y: 420,
      w: 170,
      h: 130,
      tone: "runtime",
      eyebrow: "VM3",
      label: "Hermes VM",
      caption: "Agent lane",
      chips: [{ id: "hermes", label: "Hermes", tone: "agent" }],
    },

    // ── Client tier ──
    {
      id: "unifi-ap",
      x: 140,
      y: 820,
      w: 140,
      h: 60,
      tone: "device",
      eyebrow: "Wireless",
      label: "AP",
    },
    {
      id: "bazzite-pc",
      x: 330,
      y: 820,
      w: 140,
      h: 60,
      tone: "client",
      eyebrow: "Client",
      label: "PC",
    },
    {
      id: "jetkvm",
      x: 640,
      y: 820,
      w: 140,
      h: 60,
      tone: "device",
      eyebrow: "Recovery",
      label: "KVM",
    },
    {
      id: "nas",
      x: 830,
      y: 820,
      w: 140,
      h: 60,
      tone: "device",
      eyebrow: "Storage",
      label: "NAS",
    },
  ],

  edges: [
    {
      id: "wan-to-edge",
      from: "isp",
      to: "opnsense",
      kind: "physical",
      path: "M600,90 L600,120 L300,120 L300,160",
      label: "WAN uplink",
      dashed: true,
    },
    {
      id: "edge-to-switch",
      from: "opnsense",
      to: "switch",
      kind: "physical",
      path: "M400,200 L450,200",
    },
    {
      id: "switch-to-proxmox",
      from: "switch",
      to: "proxmox",
      kind: "physical",
      path: "M630,200 L680,200",
    },
  ],
} satisfies {
  viewBox: string;
  frames: MapFrame[];
  nodes: MapNode[];
  edges: MapEdge[];
};
