import type { EntityId } from "./entities";

export type ViewMode = "overview" | "runtime" | "trust";

export type FrameTone =
  | "hardware"
  | "compute"
  | "management"
  | "service"
  | "signal"
  | "automation";

export type NodeTone = "edge" | "network" | "platform" | "runtime" | "device" | "client";
export type ChipTone = "service" | "controller" | "monitoring" | "agent" | "utility";

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
  x: number;
  y: number;
  w: number;
  h: number;
  tone: ChipTone;
  lines?: string[];
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
  points: [number, number][];
  label?: string;
  dashed?: boolean;
};

export const overviewLayout = {
  viewBox: "0 0 6588.16666666667 4878.970184856642",
  referenceSvg: "/reference/overview-map.svg",
  frames: [
    {
      id: "management-frame",
      label: "VLAN30 / Management",
      x: 2065,
      y: 3025,
      w: 390,
      h: 330,
      tone: "management",
      entityId: "management-lane",
      members: ["unifi-vm", "unifi-controller"],
    },
    {
      id: "compute-frame",
      label: "Proxmox Runtime",
      x: 2020,
      y: 2980,
      w: 4510,
      h: 1770,
      tone: "compute",
      members: ["unifi-vm", "shared-vm", "hermes-vm", "kuma-lxc"],
    },
    {
      id: "service-frame",
      label: "VLAN20 / Service Lane",
      x: 2580,
      y: 4334,
      w: 1150,
      h: 430,
      tone: "service",
      entityId: "service-lane",
      members: ["shared-vm", "caddy", "ingress", "homepage", "vaultwarden"],
    },
    {
      id: "automation-frame",
      label: "VLAN20 / Agent Lane",
      x: 4618,
      y: 4110,
      w: 440,
      h: 335,
      tone: "automation",
      entityId: "automation-lane",
      members: ["hermes-vm", "hermes"],
    },
    {
      id: "signal-frame",
      label: "VLAN20 / Signal Lane",
      x: 6158,
      y: 3080,
      w: 290,
      h: 400,
      tone: "signal",
      entityId: "signal-lane",
      members: ["kuma-lxc", "uptime-kuma"],
    },
  ] satisfies MapFrame[],
  nodes: [
    {
      id: "isp",
      x: 4788,
      y: 1202,
      w: 180,
      h: 88,
      tone: "edge",
      eyebrow: "WAN",
      label: "ISP",
      caption: "Upstream handoff",
    },
    {
      id: "opnsense",
      x: 4028,
      y: 2348,
      w: 250,
      h: 144,
      tone: "edge",
      eyebrow: "WAN / LAN",
      label: "OPNsense",
      caption: "Routing, DNS, and policy",
    },
    {
      id: "proxmox",
      x: 4365,
      y: 2348,
      w: 350,
      h: 144,
      tone: "platform",
      eyebrow: "Hardware",
      label: "Proxmox",
      caption: "Primary virtualization host",
    },
    {
      id: "unifi-ap",
      x: 4738,
      y: 2348,
      w: 180,
      h: 144,
      tone: "device",
      eyebrow: "Wireless",
      label: "AP",
      caption: "Managed by UniFi",
    },
    {
      id: "bazzite-pc",
      x: 5005,
      y: 2348,
      w: 192,
      h: 144,
      tone: "client",
      eyebrow: "Client",
      label: "PC",
      caption: "Operator workstation",
    },
    {
      id: "jetkvm",
      x: 5254,
      y: 2348,
      w: 180,
      h: 144,
      tone: "device",
      eyebrow: "Recovery",
      label: "KVM",
      caption: "Out-of-band console",
    },
    {
      id: "nas",
      x: 5484,
      y: 2348,
      w: 206,
      h: 144,
      tone: "device",
      eyebrow: "Storage",
      label: "NAS",
      caption: "Future storage lane",
    },
    {
      id: "switch",
      x: 4418,
      y: 2820,
      w: 470,
      h: 188,
      tone: "network",
      eyebrow: "Core Fabric",
      label: "Switch",
      caption: "Port map fans out from here",
    },
    {
      id: "unifi-vm",
      x: 2094,
      y: 3060,
      w: 304,
      h: 250,
      tone: "runtime",
      eyebrow: "VM1",
      label: "UniFi VM",
      caption: "Controller lane",
      chips: [
        {
          id: "unifi-controller",
          x: 26,
          y: 142,
          w: 252,
          h: 88,
          tone: "controller",
          lines: ["UniFi", "Controller"],
        },
      ],
    },
    {
      id: "shared-vm",
      x: 2618,
      y: 4348,
      w: 1080,
      h: 384,
      tone: "runtime",
      eyebrow: "VM2",
      label: "Shared VM",
      caption: "Ubuntu + Docker Compose",
      chips: [
        {
          id: "caddy",
          x: 34,
          y: 160,
          w: 286,
          h: 84,
          tone: "service",
          lines: ["Caddy"],
        },
        {
          id: "ingress",
          x: 350,
          y: 160,
          w: 286,
          h: 84,
          tone: "utility",
          lines: ["Ingress"],
        },
        {
          id: "vaultwarden",
          x: 664,
          y: 160,
          w: 382,
          h: 84,
          tone: "service",
          lines: ["Vaultwarden"],
        },
        {
          id: "homepage",
          x: 350,
          y: 262,
          w: 286,
          h: 84,
          tone: "utility",
          lines: ["Homepage"],
        },
      ],
    },
    {
      id: "hermes-vm",
      x: 4648,
      y: 4140,
      w: 380,
      h: 250,
      tone: "runtime",
      eyebrow: "VM3",
      label: "Hermes VM",
      caption: "Agent lane",
      chips: [
        {
          id: "hermes",
          x: 34,
          y: 144,
          w: 230,
          h: 86,
          tone: "agent",
          lines: ["Hermes"],
        },
      ],
    },
    {
      id: "kuma-lxc",
      x: 6192,
      y: 3090,
      w: 250,
      h: 342,
      tone: "runtime",
      eyebrow: "LXC",
      label: "Kuma",
      caption: "Independent checks",
      chips: [
        {
          id: "uptime-kuma",
          x: 24,
          y: 188,
          w: 202,
          h: 98,
          tone: "monitoring",
          lines: ["Uptime", "Kuma"],
        },
      ],
    },
  ] satisfies MapNode[],
  edges: [
    {
      id: "wan-to-edge",
      from: "isp",
      to: "opnsense",
      kind: "physical",
      points: [
        [4878, 1290],
        [4878, 1740],
        [4226, 1740],
        [4226, 2348],
      ],
      label: "WAN uplink",
      dashed: true,
    },
    {
      id: "edge-to-switch",
      from: "opnsense",
      to: "switch",
      kind: "physical",
      points: [
        [4154, 2492],
        [4154, 2914],
        [4418, 2914],
      ],
    },
    {
      id: "switch-to-proxmox",
      from: "switch",
      to: "proxmox",
      kind: "physical",
      points: [
        [4582, 2820],
        [4582, 2492],
      ],
    },
    {
      id: "switch-to-ap",
      from: "switch",
      to: "unifi-ap",
      kind: "physical",
      points: [
        [4706, 2820],
        [4706, 2620],
        [4828, 2620],
        [4828, 2492],
      ],
    },
    {
      id: "switch-to-pc",
      from: "switch",
      to: "bazzite-pc",
      kind: "physical",
      points: [
        [4792, 2898],
        [5100, 2898],
        [5100, 2492],
      ],
    },
    {
      id: "switch-to-kvm",
      from: "switch",
      to: "jetkvm",
      kind: "physical",
      points: [
        [4792, 2940],
        [5344, 2940],
        [5344, 2492],
      ],
    },
    {
      id: "switch-to-nas",
      from: "switch",
      to: "nas",
      kind: "physical",
      points: [
        [4792, 2980],
        [5587, 2980],
        [5587, 2492],
      ],
    },
    {
      id: "proxmox-to-unifi-vm",
      from: "proxmox",
      to: "unifi-vm",
      kind: "runtime",
      points: [
        [4424, 2492],
        [4424, 3175],
        [2398, 3175],
      ],
      label: "VM placement",
    },
    {
      id: "proxmox-to-shared-vm",
      from: "proxmox",
      to: "shared-vm",
      kind: "runtime",
      points: [
        [4520, 2492],
        [4520, 4190],
        [3158, 4190],
        [3158, 4348],
      ],
      label: "VM placement",
    },
    {
      id: "proxmox-to-hermes-vm",
      from: "proxmox",
      to: "hermes-vm",
      kind: "runtime",
      points: [
        [4608, 2492],
        [4608, 3920],
        [4838, 3920],
        [4838, 4140],
      ],
    },
    {
      id: "proxmox-to-kuma-lxc",
      from: "proxmox",
      to: "kuma-lxc",
      kind: "runtime",
      points: [
        [4698, 2492],
        [4698, 3180],
        [6192, 3180],
      ],
    },
    {
      id: "policy-to-management",
      from: "opnsense",
      to: "management-lane",
      kind: "policy",
      points: [
        [4028, 2418],
        [3605, 2418],
        [3605, 3140],
        [2455, 3140],
      ],
      label: "Admin reach",
      dashed: true,
    },
    {
      id: "policy-to-services",
      from: "opnsense",
      to: "service-lane",
      kind: "policy",
      points: [
        [4028, 2460],
        [3505, 2460],
        [3505, 4548],
        [3730, 4548],
      ],
      label: "Publish + trust",
      dashed: true,
    },
    {
      id: "policy-to-automation",
      from: "opnsense",
      to: "automation-lane",
      kind: "policy",
      points: [
        [4152, 2492],
        [4320, 2492],
        [4320, 4272],
        [4618, 4272],
      ],
      label: "Utility access",
      dashed: true,
    },
    {
      id: "policy-to-signals",
      from: "opnsense",
      to: "signal-lane",
      kind: "policy",
      points: [
        [4278, 2428],
        [5950, 2428],
        [5950, 3280],
        [6158, 3280],
      ],
      label: "Checks + alerts",
      dashed: true,
    },
  ] satisfies MapEdge[],
} as const;
