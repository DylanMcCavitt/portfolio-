import type { DMRuntimeConfig } from './runtime';

/**
 * A resolved model target for eval/benchmark scripts.
 *
 * `model` is always the full `<creator>/<model>` id. The DM runtime strips the
 * `openai/` prefix itself when the direct OpenAI provider is selected, and the
 * Vercel AI Gateway requires the full prefixed id — so the id is never stripped
 * here (stripping it broke gateway runs: `gateway('claude-sonnet-4.5')` is not
 * a valid gateway model id).
 */
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
 *
 * - With `AI_GATEWAY_API_KEY`: every model (including `openai/*`) routes
 *   through the gateway, so one key benchmarks any creator's models.
 * - With only `OPENAI_API_KEY`: `openai/*` models route directly; other
 *   creators fail fast with an actionable message.
 * - With no keys (dry mode): ids parse for plumbing checks; non-OpenAI
 *   creators are labeled as gateway routes.
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
