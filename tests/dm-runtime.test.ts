import assert from 'node:assert/strict';
import test from 'node:test';
import { simulateReadableStream, type LanguageModel } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { observeDMResponse } from '@/lib/dm/response-observer';
import {
  buildDMSystemInstructions,
  createDMChatResponse,
  readDMBudgetConfig,
  readDMRuntimeConfig,
} from '@/lib/dm/runtime';
import type { DMChatRequest } from '@/lib/dm/contract';
import { buildDMSiteBrief } from '@/lib/dm/site-brief';
import { createTestProjectSource } from './fixtures/dm-project-source';

const config = { provider: 'openai' as const, model: 'openai/test-model' };

test('runtime configuration requires an explicit model and provider credential', () => {
  assert.throws(() => readDMRuntimeConfig({}), /DM_MODEL, OPENAI_API_KEY/);
  assert.throws(() => readDMRuntimeConfig({ OPENAI_API_KEY: 'configured' }), /DM_MODEL/);
  assert.deepEqual(
    readDMRuntimeConfig({ DM_MODEL: 'openai/runtime-model', OPENAI_API_KEY: 'configured' }),
    { provider: 'openai', model: 'openai/runtime-model' },
  );
  assert.deepEqual(
    readDMRuntimeConfig({ DM_MODEL: 'anthropic/runtime-model', AI_GATEWAY_API_KEY: 'configured' }),
    { provider: 'gateway', model: 'anthropic/runtime-model' },
  );
});

test('runtime budgets remain bounded', () => {
  assert.deepEqual(readDMBudgetConfig({}), {
    deadlineMs: 45_000,
    maxOutputTokens: 1_200,
    maxSteps: 6,
  });
  assert.throws(() => readDMBudgetConfig({ DM_MAX_STEPS: '1' }), /safeguards/);
  assert.throws(() => readDMBudgetConfig({ DM_REQUEST_DEADLINE_MS: '500000' }), /safeguards/);
});

test('system instructions retain the public-source and same-run evidence boundary', async () => {
  const source = await createTestProjectSource();
  const brief = buildDMSiteBrief(await source.projectLoader());
  const instructions = buildDMSystemInstructions(brief);

  assert.match(instructions, /published project/i);
  assert.match(instructions, /same run/i);
  assert.match(instructions, /Never claim access to Slack, admin drafts, candidate evidence, private notes/i);
  assert.match(instructions, /finalizeAnswer/);
});

test('a conversational answer completes through the single structured contract', async () => {
  const source = await createTestProjectSource();
  const request = chatRequest('Hello');
  const response = createDMChatResponse(request, config, {
    db: emptyDb(),
    projectLoader: source.projectLoader,
    model: toolSequenceModel([{
      toolName: 'finalizeAnswer',
      input: {
        segments: [{ kind: 'conversational', act: 'greeting' }],
        artifactIntent: 'none',
        artifacts: [],
        limitations: [],
      },
    }]),
  });
  const observation = await observeDMResponse(response, request);

  assert.equal(observation.outcome, 'completed');
  assert.equal(observation.result?.status, 'accepted');
  assert.equal(observation.answerText, "Hi — I'm DM, Dylan's public portfolio guide.");
  assert.deepEqual(observation.result?.answer.artifacts, []);
});

test('model prose outside the structured answer is not visitor-visible', async () => {
  const source = await createTestProjectSource();
  const request = chatRequest('What can you do?');
  const response = createDMChatResponse(request, config, {
    db: emptyDb(),
    projectLoader: source.projectLoader,
    model: toolSequenceModel([{
      toolName: 'finalizeAnswer',
      prose: 'unvalidated model preamble',
      input: {
        segments: [{ kind: 'conversational', act: 'capabilities' }],
        artifactIntent: 'none',
        artifacts: [],
        limitations: [],
      },
    }]),
  });
  const observation = await observeDMResponse(response, request);

  assert.equal(observation.outcome, 'completed');
  assert.doesNotMatch(observation.answerText, /unvalidated model preamble/);
  assert.equal(
    observation.answerText,
    "I can help with Dylan's published projects, public resume, and contact details.",
  );
});

function chatRequest(text: string): DMChatRequest {
  return { messages: [{ id: 'user-1', role: 'user', parts: [{ type: 'text', text }] }] };
}

function emptyDb() {
  return {
    async query<Row = unknown>() {
      return { rows: [] as Row[] };
    },
  };
}

type MockToolCall = { toolName: string; input: unknown; prose?: string };

function toolSequenceModel(calls: MockToolCall[]): LanguageModel {
  let index = 0;
  return new MockLanguageModelV4({
    doStream: async () => {
      const call = calls[index++];
      if (!call) throw new Error('mock model received an unexpected extra step');
      const id = `call-${index}`;
      const textId = `text-${index}`;
      return {
        stream: simulateReadableStream({ chunks: [
          { type: 'stream-start' as const, warnings: [] },
          { type: 'response-metadata' as const, id: `response-${index}`, modelId: 'mock-tool-loop', timestamp: new Date(0) },
          ...(call.prose ? [
            { type: 'text-start' as const, id: textId },
            { type: 'text-delta' as const, id: textId, delta: call.prose },
            { type: 'text-end' as const, id: textId },
          ] : []),
          { type: 'tool-call' as const, toolCallId: id, toolName: call.toolName, input: JSON.stringify(call.input) },
          {
            type: 'finish' as const,
            finishReason: { unified: 'tool-calls' as const, raw: 'tool-calls' },
            usage: {
              inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
              outputTokens: { total: 8, text: 8, reasoning: undefined },
            },
          },
        ] }),
      };
    },
  });
}
