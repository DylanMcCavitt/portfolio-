import {
  ProjectDetailEntrySchema,
  ProjectLinkSchema,
  ProjectMediaSchema,
  ProjectMetricSchema,
  ProjectSeekSchema,
  ProjectStatusSchema,
  type ProjectDetailEntry,
  type ProjectLink,
  type ProjectMedia,
  type ProjectMetric,
  type ProjectSeek,
  type ProjectStatus,
} from './schema';

function legacyError(projectId: string, field: string): Error {
  return new Error(`Project record ${projectId} has invalid legacy ${field}.`);
}

export function adaptLegacyProjectLinks(value: unknown, projectId: string): ProjectLink[] {
  if (!Array.isArray(value)) throw legacyError(projectId, 'links');
  return value.map((item) => {
    const candidate = Array.isArray(item) && item.length === 2
      ? { label: item[0], href: item[1] }
      : item;
    const parsed = ProjectLinkSchema.safeParse(candidate);
    if (!parsed.success) throw legacyError(projectId, 'links');
    return parsed.data;
  });
}

export function adaptLegacyProjectMetrics(value: unknown, projectId: string): ProjectMetric[] {
  if (!Array.isArray(value)) throw legacyError(projectId, 'metrics');
  return value.map((item) => {
    const candidate = Array.isArray(item) && item.length === 2
      ? { value: item[0], label: item[1] }
      : item;
    const parsed = ProjectMetricSchema.safeParse(candidate);
    if (!parsed.success) throw legacyError(projectId, 'metrics');
    return parsed.data;
  });
}

export function adaptLegacyProjectDetailEntries(value: unknown, projectId: string): ProjectDetailEntry[] {
  if (!Array.isArray(value)) throw legacyError(projectId, 'detail entries');
  return value.map((item) => {
    const candidate = Array.isArray(item) && item.length === 2
      ? { label: item[0], value: item[1] }
      : item;
    const parsed = ProjectDetailEntrySchema.safeParse(candidate);
    if (!parsed.success) throw legacyError(projectId, 'detail entries');
    return parsed.data;
  });
}

export function adaptLegacyProjectMedia(value: unknown, projectId: string): ProjectMedia[] {
  if (!Array.isArray(value)) throw legacyError(projectId, 'media');
  return value.map((item) => {
    const candidate = legacyMediaCandidate(item);
    const parsed = ProjectMediaSchema.safeParse(candidate);
    if (!parsed.success) throw legacyError(projectId, 'media');
    return parsed.data;
  });
}

export function adaptLegacyProjectStatus(value: unknown, projectId: string): ProjectStatus {
  const parsed = ProjectStatusSchema.safeParse(value);
  if (!parsed.success) throw legacyError(projectId, 'status');
  return parsed.data;
}

export function adaptLegacyProjectSeek(value: unknown, projectId: string): ProjectSeek {
  const parsed = ProjectSeekSchema.safeParse(value);
  if (!parsed.success) throw legacyError(projectId, 'seek');
  return parsed.data;
}

function legacyMediaCandidate(value: unknown): unknown {
  if (!isRecord(value) || typeof value.cap !== 'string') return value;
  const legacyKinds = ['img', 'video', 'kind'].filter((field) => Object.hasOwn(value, field));
  if (legacyKinds.length !== 1) return value;
  if (typeof value.img === 'string') {
    return { kind: 'image', src: value.img, caption: value.cap, ...(typeof value.phone === 'boolean' ? { phone: value.phone } : {}) };
  }
  if (typeof value.video === 'string') {
    return {
      kind: 'video',
      src: value.video,
      caption: value.cap,
      ...(typeof value.poster === 'string' ? { poster: value.poster } : {}),
      ...(typeof value.phone === 'boolean' ? { phone: value.phone } : {}),
    };
  }
  if (typeof value.kind === 'string') {
    return { kind: 'skeleton', skeletonKind: value.kind, caption: value.cap };
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
