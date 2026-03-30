export type EntityKind =
  | "zone"
  | "edge"
  | "network"
  | "platform"
  | "runtime"
  | "service"
  | "device"
  | "client";

export type DetailSection = {
  title: string;
  items: string[];
};

export type Entity = {
  id: string;
  title: string;
  kind: EntityKind;
  summary: string;
  badges: string[];
  related: string[];
  sections: DetailSection[];
};

export const entities = {
  "management-lane": {
    id: "management-lane",
    title: "VLAN30 / Management",
    kind: "zone",
    summary: "Admin-only lane for infrastructure control surfaces and controller traffic.",
    badges: ["VLAN30", "admin", "controllers"],
    related: ["opnsense", "proxmox", "unifi-vm", "unifi-controller", "unifi-ap"],
    sections: [
      {
        title: "Role",
        items: [
          "Keeps control-plane access separate from the published app lane.",
          "Holds infrastructure management surfaces and the UniFi controller path.",
        ],
      },
      {
        title: "Policy shape",
        items: [
          "Admin clients are allowed into this lane.",
          "Guest and broad internal access stay constrained by firewall policy.",
        ],
      },
    ],
  },
  "service-lane": {
    id: "service-lane",
    title: "VLAN20 / Service Lane",
    kind: "zone",
    summary: "Shared application lane for the reverse proxy and public-facing internal services.",
    badges: ["VLAN20", "apps", "ingress"],
    related: ["opnsense", "shared-vm", "caddy", "ingress", "homepage", "vaultwarden"],
    sections: [
      {
        title: "Role",
        items: [
          "Carries the shared VM and the services it publishes.",
          "Presents a clean front door for service discovery and app access.",
        ],
      },
      {
        title: "Policy shape",
        items: [
          "Published services are reached through the ingress layer instead of direct host exposure.",
          "Trusted and management paths are the intended audience for this lane.",
        ],
      },
    ],
  },
  "signal-lane": {
    id: "signal-lane",
    title: "VLAN20 / Signal Lane",
    kind: "zone",
    summary: "Dedicated monitoring lane so health checks do not live in the same blast radius as the app VM.",
    badges: ["VLAN20", "monitoring", "independent"],
    related: ["opnsense", "proxmox", "kuma-lxc", "uptime-kuma"],
    sections: [
      {
        title: "Role",
        items: [
          "Hosts Uptime Kuma outside the shared app VM.",
          "Keeps service checks useful even when the shared VM has problems.",
        ],
      },
      {
        title: "Policy shape",
        items: [
          "Needs reachability into published services and selected management paths.",
          "Acts as the observation layer rather than a user-facing app lane.",
        ],
      },
    ],
  },
  "automation-lane": {
    id: "automation-lane",
    title: "VLAN20 / Agent Lane",
    kind: "zone",
    summary: "Space for utility and automation workloads that support the rest of the lab.",
    badges: ["VLAN20", "agents", "automation"],
    related: ["opnsense", "proxmox", "hermes-vm", "hermes"],
    sections: [
      {
        title: "Role",
        items: [
          "Keeps experimental or utility workloads visible without crowding the shared app VM.",
          "Makes room for future automations and helper services.",
        ],
      },
      {
        title: "Policy shape",
        items: [
          "Shares the services VLAN but represents a separate function from the main app lane.",
          "Useful for background jobs, agents, and future orchestration helpers.",
        ],
      },
    ],
  },
  isp: {
    id: "isp",
    title: "ISP",
    kind: "edge",
    summary: "Upstream WAN handoff that feeds the firewall edge.",
    badges: ["wan", "upstream"],
    related: ["opnsense"],
    sections: [
      {
        title: "Role",
        items: [
          "Represents the internet boundary rather than a directly managed homelab component.",
          "Terminates at the firewall before any internal routing occurs.",
        ],
      },
    ],
  },
  opnsense: {
    id: "opnsense",
    title: "OPNsense",
    kind: "edge",
    summary: "Firewall, routing, DNS, and policy boundary for the entire lab.",
    badges: ["firewall", "routing", "dns", "policy"],
    related: [
      "isp",
      "switch",
      "management-lane",
      "service-lane",
      "signal-lane",
      "automation-lane",
    ],
    sections: [
      {
        title: "Responsibilities",
        items: [
          "Owns the WAN edge and the internal trust boundaries.",
          "Controls which VLANs can reach services, controllers, and monitoring paths.",
        ],
      },
      {
        title: "Why it matters",
        items: [
          "Everything in the map flows through the firewall's policy model.",
          "It is the anchor point for published apps, admin access, and lane separation.",
        ],
      },
    ],
  },
  switch: {
    id: "switch",
    title: "Switch",
    kind: "network",
    summary: "Core wired fabric that fans the firewall edge out to compute, clients, and management devices.",
    badges: ["fabric", "ports", "lan"],
    related: ["opnsense", "proxmox", "unifi-ap", "bazzite-pc", "jetkvm", "nas"],
    sections: [
      {
        title: "Role",
        items: [
          "Acts as the central handoff between edge, compute, and attached devices.",
          "Carries the port map that gives the physical floor its shape.",
        ],
      },
      {
        title: "Design note",
        items: [
          "The map keeps the switch central because nearly every physical path fans out from it.",
        ],
      },
    ],
  },
  proxmox: {
    id: "proxmox",
    title: "Proxmox",
    kind: "platform",
    summary: "Primary hypervisor that hosts the VM and LXC lanes shown in the map.",
    badges: ["hypervisor", "compute", "parent host"],
    related: [
      "switch",
      "management-lane",
      "service-lane",
      "signal-lane",
      "automation-lane",
      "unifi-vm",
      "shared-vm",
      "kuma-lxc",
      "hermes-vm",
    ],
    sections: [
      {
        title: "Placement role",
        items: [
          "Provides the runtime parent for the lab's controller, app, signal, and agent lanes.",
          "Turns the physical host into several independently understandable slices.",
        ],
      },
      {
        title: "Why the map centers it",
        items: [
          "It bridges the physical floor and the runtime topology.",
          "Most drill-down journeys naturally pass through Proxmox on the way to a service.",
        ],
      },
    ],
  },
  "unifi-ap": {
    id: "unifi-ap",
    title: "AP",
    kind: "device",
    summary: "Wireless access point that extends the network lanes into Wi-Fi.",
    badges: ["wireless", "access point"],
    related: ["switch", "management-lane", "unifi-controller"],
    sections: [
      {
        title: "Role",
        items: [
          "Handles wireless client access while remaining managed from the controller lane.",
          "Represents the bridge between the wired floor and the Wi-Fi experience.",
        ],
      },
    ],
  },
  "bazzite-pc": {
    id: "bazzite-pc",
    title: "PC",
    kind: "client",
    summary: "Primary admin workstation used to validate management and published-service paths.",
    badges: ["client", "admin"],
    related: ["switch", "management-lane", "service-lane"],
    sections: [
      {
        title: "Role",
        items: [
          "Acts as the human operator point of view for the map.",
          "Useful as the reference client when verifying routes, TLS, and admin reachability.",
        ],
      },
    ],
  },
  jetkvm: {
    id: "jetkvm",
    title: "KVM",
    kind: "device",
    summary: "Out-of-band console path for recovery and break-glass access.",
    badges: ["oob", "recovery"],
    related: ["switch", "proxmox"],
    sections: [
      {
        title: "Role",
        items: [
          "Keeps a console path available even when normal management access is in trouble.",
          "Adds resilience to the platform side of the map.",
        ],
      },
    ],
  },
  nas: {
    id: "nas",
    title: "NAS",
    kind: "device",
    summary: "Storage-side placeholder in the floor plan for future heavier data workloads.",
    badges: ["storage", "future growth"],
    related: ["switch"],
    sections: [
      {
        title: "Role",
        items: [
          "Marks where shared storage and backup capacity can grow into the topology.",
          "Shown in the overview so compute placement decisions keep future storage in mind.",
        ],
      },
    ],
  },
  "unifi-vm": {
    id: "unifi-vm",
    title: "UniFi VM",
    kind: "runtime",
    summary: "Management-lane VM dedicated to the controller stack.",
    badges: ["VM1", "controller lane"],
    related: ["management-lane", "proxmox", "unifi-controller", "unifi-ap"],
    sections: [
      {
        title: "Role",
        items: [
          "Keeps wireless management separate from shared application services.",
          "Shows the pattern of placing controllers in the management plane instead of the app lane.",
        ],
      },
    ],
  },
  "unifi-controller": {
    id: "unifi-controller",
    title: "UniFi Controller",
    kind: "service",
    summary: "Controller surface for the AP and wireless management path.",
    badges: ["controller", "management only"],
    related: ["unifi-vm", "management-lane", "unifi-ap"],
    sections: [
      {
        title: "Role",
        items: [
          "Owns access-point management and wireless control-plane visibility.",
          "Intentionally sits in the management lane instead of the shared public app lane.",
        ],
      },
    ],
  },
  "shared-vm": {
    id: "shared-vm",
    title: "Shared VM",
    kind: "runtime",
    summary: "Shared Ubuntu VM that carries the reverse proxy and light user-facing services.",
    badges: ["VM2", "docker", "shared lane"],
    related: ["proxmox", "service-lane", "caddy", "ingress", "homepage", "vaultwarden"],
    sections: [
      {
        title: "Role",
        items: [
          "Groups together light services that can share the same maintenance window.",
          "Acts as the public-facing app lane behind the ingress layer.",
        ],
      },
      {
        title: "Design note",
        items: [
          "The map presents this VM as a cluster because several services are intentionally colocated here.",
        ],
      },
    ],
  },
  caddy: {
    id: "caddy",
    title: "Caddy",
    kind: "service",
    summary: "Reverse proxy and TLS front door for the published service lane.",
    badges: ["proxy", "tls", "front door"],
    related: ["shared-vm", "ingress", "homepage", "vaultwarden", "service-lane", "opnsense"],
    sections: [
      {
        title: "Role",
        items: [
          "Provides the common front door instead of exposing each app directly.",
          "Makes the service lane feel like one coherent system rather than a pile of containers.",
        ],
      },
    ],
  },
  ingress: {
    id: "ingress",
    title: "Ingress",
    kind: "service",
    summary: "Public-facing entry pattern that collects internal services behind a single path.",
    badges: ["routing", "entrypoint"],
    related: ["shared-vm", "caddy", "service-lane", "homepage", "vaultwarden"],
    sections: [
      {
        title: "Role",
        items: [
          "Shows the architectural idea behind the proxy layer, not just the software name.",
          "Useful in the overview because it explains how the published apps stay tidy.",
        ],
      },
    ],
  },
  homepage: {
    id: "homepage",
    title: "Homepage",
    kind: "service",
    summary: "Operator-facing dashboard and the first visual stop once ingress is working.",
    badges: ["dashboard", "portal"],
    related: ["shared-vm", "service-lane", "caddy", "ingress"],
    sections: [
      {
        title: "Role",
        items: [
          "Acts as the control-room style surface for browsing the lab.",
          "Makes a strong portfolio example because it sits at the intersection of UX and operations.",
        ],
      },
    ],
  },
  vaultwarden: {
    id: "vaultwarden",
    title: "Vaultwarden",
    kind: "service",
    summary: "Password manager published through the shared ingress path.",
    badges: ["secrets", "https", "published"],
    related: ["shared-vm", "service-lane", "caddy", "ingress", "opnsense"],
    sections: [
      {
        title: "Role",
        items: [
          "Flagship example of a user-facing service that still respects trust boundaries.",
          "Good drill-down target because it connects ingress, app hosting, backup thinking, and policy design.",
        ],
      },
    ],
  },
  "kuma-lxc": {
    id: "kuma-lxc",
    title: "Kuma LXC",
    kind: "runtime",
    summary: "Dedicated lightweight runtime for monitoring so checks stay independent from the shared app VM.",
    badges: ["LXC", "monitoring", "independent"],
    related: ["proxmox", "signal-lane", "uptime-kuma", "opnsense"],
    sections: [
      {
        title: "Role",
        items: [
          "Separates the monitoring plane from the services it observes.",
          "Makes outages easier to reason about because the observer is not sharing the same runtime.",
        ],
      },
    ],
  },
  "uptime-kuma": {
    id: "uptime-kuma",
    title: "Uptime Kuma",
    kind: "service",
    summary: "Health-check and alerting surface for network, service, and management-path validation.",
    badges: ["checks", "alerts", "visibility"],
    related: ["kuma-lxc", "signal-lane", "opnsense", "shared-vm", "homepage", "vaultwarden"],
    sections: [
      {
        title: "Role",
        items: [
          "Turns the topology from a static diagram into something that can be validated.",
          "Useful in the portfolio because it shows how architecture and signals fit together.",
        ],
      },
    ],
  },
  "hermes-vm": {
    id: "hermes-vm",
    title: "Hermes VM",
    kind: "runtime",
    summary: "Separate VM reserved for automation and helper workloads.",
    badges: ["VM3", "agents"],
    related: ["proxmox", "automation-lane", "hermes"],
    sections: [
      {
        title: "Role",
        items: [
          "Keeps automation experiments and agents visible without muddying the shared app lane.",
          "Demonstrates how the lab can scale into more specialized slices over time.",
        ],
      },
    ],
  },
  hermes: {
    id: "hermes",
    title: "Hermes",
    kind: "service",
    summary: "Agent-style workload living in its own lane rather than the primary shared service cluster.",
    badges: ["agent", "automation"],
    related: ["hermes-vm", "automation-lane"],
    sections: [
      {
        title: "Role",
        items: [
          "Represents the next step beyond static services: automation that acts on the environment.",
          "Its dedicated lane suggests where future orchestration or assistant workflows could live.",
        ],
      },
    ],
  },
} as const satisfies Record<string, Entity>;

export type EntityId = keyof typeof entities;

export const entityList = Object.values(entities);
