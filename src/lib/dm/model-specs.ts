import type { DMRuntimeConfig } from './runtime';

/** Resolved model target for eval/benchmark scripts. `model` is always a full `<creator>/<model>` id. */
export interface DMModelSpec {
  provider: DMRuntimeConfig['provider'];
  model: string;
  label: string;
}

export interface DMModelKeyAvailability {
  hasGatewayKey: boolean;
  hasOpenaiKey: boolean;
}

export function readModelKeyAvailability(
  env: Record<string, string | undefined> = process.env,
): DMModelKeyAvailability {
  return {
    hasGatewayKey: Boolean(env.AI_GATEWAY_API_KEY?.trim()),
    hasOpenaiKey: Boolean(env.OPENAI_API_KEY?.trim()),
  };
}

/**
 * Resolve one model id to a provider route.
 * Gateway key → all models via gateway; OpenAI key only → openai/* direct; no keys → dry-mode parse.
 */
export function parseDMModelSpec(value: string, keys: DMModelKeyAvailability): DMModelSpec {
  const trimmed = value.trim();
  if (!trimmed) throw new Error('Model id must not be empty.');

  const id = trimmed.includes('/') ? trimmed : `openai/${trimmed}`;
  const slash = id.indexOf('/');
  const creator = id.slice(0, slash);
  const name = id.slice(slash + 1).trim();
  if (!creator || !name) {
    throw new Error(`Model id "${trimmed}" must use <creator>/<model> format (e.g. anthropic/claude-sonnet-4.6).`);
  }

  if (keys.hasGatewayKey) {
    return { provider: 'gateway', model: id, label: id };
  }
  if (creator === 'openai') {
    return { provider: 'openai', model: id, label: id };
  }
  if (keys.hasOpenaiKey) {
    throw new Error(
      `Model "${id}" needs AI_GATEWAY_API_KEY. Only OPENAI_API_KEY is set, which reaches openai/* models directly.`,
    );
  }
  return { provider: 'gateway', model: id, label: id };
}

export function parseDMModelSpecs(
  raw: string | undefined,
  keys: DMModelKeyAvailability,
  fallback: string[],
): DMModelSpec[] {
  const ids = (raw ? raw.split(',') : fallback).map((item) => item.trim()).filter(Boolean);
  const unique = [...new Set(ids)];
  if (unique.length === 0) throw new Error('No models configured.');
  return unique.map((id) => parseDMModelSpec(id, keys));
}
