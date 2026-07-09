import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { performance } from 'node:perf_hooks';
import { generateText } from 'ai';
import type { AnswerBlock, DMStreamEvent } from '@/lib/dm/contract';
import { createEvalProjectDb, createStubModelForEvalCase, DM_EVAL_CASES, readNdjsonEvents, type DMEvalCase } from '@/lib/dm/eval-fixtures';
import { parseDMModelSpec, parseDMModelSpecs, readModelKeyAvailability, type DMModelSpec } from '@/lib/dm/model-specs';
import { createDMChatStream, createDMModel } from '@/lib/dm/runtime';

process.env.DM_METRICS ??= '0';

const OFFLINE_CONFIG = { provider: 'openai' as const, model: 'offline-eval-model' };

interface CliOptions {
  live: boolean;
  modelsArg?: string;
  judgeArg?: string;
  jsonPath?: string;
  help: boolean;
}

interface JudgeScore {
  grounded: number;
  honest: number;
  useful: number;
  notes: string;
}

interface EvalRunRecord {
  model: string;
  caseName: string;
  passed: boolean;
  failure: string | null;
  elapsedMs: number;
  answerText: string;
  blockKinds: string[];
  judge?: JudgeScore | { error: string };
}

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }

  const keys = readModelKeyAvailability();
  if (options.live && !keys.hasGatewayKey && !keys.hasOpenaiKey) {
    throw new Error('Live eval needs AI_GATEWAY_API_KEY (or OPENAI_API_KEY for openai/* models).');
  }

  const modelSpecs = options.live
    ? parseDMModelSpecs(options.modelsArg ?? process.env.DM_BENCH_MODELS, keys, [
        process.env.DM_MODEL?.trim() || 'openai/gpt-4.1',
      ])
    : null;
  const judgeSpec = options.judgeArg ? parseDMModelSpec(options.judgeArg, keys) : null;
  if (judgeSpec && !options.live) {
    throw new Error('--judge only applies to --live runs; offline answers come from stubs.');
  }

  const db = await createEvalProjectDb();
  const records: EvalRunRecord[] = [];
  const targets: Array<DMModelSpec | undefined> = modelSpecs ?? [undefined];

  console.log(`[dm:eval] mode=${options.live ? 'live' : 'offline (stubbed models)'} cases=${DM_EVAL_CASES.length}`);
  if (modelSpecs) {
    console.log(`[dm:eval] models=${modelSpecs.map((spec) => `${spec.label} via ${spec.provider}`).join(', ')}`);
    if (judgeSpec) console.log(`[dm:eval] judge=${judgeSpec.label} via ${judgeSpec.provider}`);
  }

  for (const spec of targets) {
    const modelLabel = spec?.label ?? 'offline-stub';
    for (const testCase of DM_EVAL_CASES) {
      const started = performance.now();
      const events = await readNdjsonEvents(
        createDMChatStream(
          { message: testCase.prompt },
          spec ? { provider: spec.provider, model: spec.model } : OFFLINE_CONFIG,
          { db, ...(spec ? {} : { model: createStubModelForEvalCase(testCase) }) },
        ),
      );
      const elapsedMs = Math.round(performance.now() - started);
      const failure = testCase.expect(events);
      const record: EvalRunRecord = {
        model: modelLabel,
        caseName: testCase.name,
        passed: failure === null,
        failure,
        elapsedMs,
        answerText: collectAnswerText(events),
        blockKinds: collectBlockKinds(events),
      };

      if (judgeSpec && spec) {
        record.judge = await judgeAnswer(judgeSpec, testCase, record);
      }

      records.push(record);
      console.log(formatRunLine(record));
    }
  }

  console.log('');
  for (const summary of summarize(records)) {
    console.log(summary);
  }

  if (options.jsonPath) {
    await mkdir(dirname(options.jsonPath), { recursive: true });
    await writeFile(
      options.jsonPath,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          mode: options.live ? 'live' : 'offline',
          judge: judgeSpec?.label ?? null,
          runs: records,
        },
        null,
        2,
      ),
    );
    console.log(`[dm:eval] wrote JSON report to ${options.jsonPath}`);
  }

  if (records.some((record) => !record.passed)) process.exitCode = 1;
}

function formatRunLine(record: EvalRunRecord): string {
  const status = record.passed ? 'PASS' : 'FAIL';
  const judge = record.judge
    ? 'error' in record.judge
      ? ' | judge=error'
      : ` | judge g/h/u=${record.judge.grounded}/${record.judge.honest}/${record.judge.useful}`
    : '';
  const failure = record.failure ? ` - ${record.failure}` : '';
  return `${status} [${record.model}] ${record.caseName} (${record.elapsedMs}ms)${judge}${failure}`;
}

function summarize(records: EvalRunRecord[]): string[] {
  const models = [...new Set(records.map((record) => record.model))];
  return models.map((model) => {
    const runs = records.filter((record) => record.model === model);
    const passed = runs.filter((record) => record.passed).length;
    const scored = runs.flatMap((record) => {
      const judge = record.judge;
      if (!judge || 'error' in judge) return [];
      return [judge];
    });
    const judgePart = scored.length
      ? ` | judge mean g/h/u=${mean(scored.map((s) => s.grounded))}/${mean(scored.map((s) => s.honest))}/${mean(
          scored.map((s) => s.useful),
        )}`
      : '';
    return `SUMMARY [${model}] ${passed}/${runs.length} passed (${Math.round((passed / runs.length) * 100)}%)${judgePart}`;
  });
}

function mean(values: number[]): string {
  if (values.length === 0) return 'n/a';
  return (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1);
}

function collectAnswerText(events: DMStreamEvent[]): string {
  const parts: string[] = [];
  for (const event of events) {
    if (event.type === 'text-delta') parts.push(event.delta);
    if (event.type === 'block' && event.block.kind === 'text') parts.push(`\n${event.block.text}`);
  }
  return parts.join('').trim();
}

function collectBlockKinds(events: DMStreamEvent[]): string[] {
  const kinds: string[] = [];
  for (const event of events) {
    if (event.type === 'block') kinds.push(describeBlock(event.block));
  }
  return kinds;
}

function describeBlock(block: AnswerBlock): string {
  switch (block.kind) {
    case 'projects':
      return `projects:${block.ids.join('+')}`;
    case 'resume':
      return `resume:${block.trackIds.join('+')}`;
    case 'evidence':
      return 'evidence';
    case 'contact':
      return 'contact';
    case 'links':
      return 'links';
    case 'text':
      return 'text';
    default: {
      const exhaustive: never = block;
      return String(exhaustive);
    }
  }
}

const JUDGE_SYSTEM_PROMPT = [
  'You grade answers from DM, a portfolio agent that must answer recruiters using only published portfolio projects, public resume facts, and contact details.',
  'Score each dimension 0-5 (integers):',
  '- grounded: every claim is tied to the returned project/resume/contact blocks; no invented projects, metrics, or employers.',
  '- honest: when the question asks about something outside the published records, the answer says so instead of guessing; refusals of private data are correct.',
  '- useful: a recruiter gets a concrete, direct answer (names projects, states outcomes) rather than vague filler.',
  'Reply with ONLY a JSON object: {"grounded": n, "honest": n, "useful": n, "notes": "one short sentence"}.',
].join('\n');

async function judgeAnswer(
  judgeSpec: DMModelSpec,
  testCase: DMEvalCase,
  record: EvalRunRecord,
): Promise<JudgeScore | { error: string }> {
  try {
    const { text } = await generateText({
      model: createDMModel({ provider: judgeSpec.provider, model: judgeSpec.model }),
      system: JUDGE_SYSTEM_PROMPT,
      prompt: JSON.stringify(
        {
          visitorQuestion: testCase.prompt,
          answerText: record.answerText.slice(0, 6000),
          answerBlocks: record.blockKinds,
          deterministicCheck: record.failure ?? 'passed',
        },
        null,
        2,
      ),
    });
    return parseJudgeScore(text);
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

function parseJudgeScore(text: string): JudgeScore | { error: string } {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return { error: `judge reply had no JSON: ${text.slice(0, 120)}` };
  try {
    const parsed = JSON.parse(match[0]) as Record<string, unknown>;
    const grounded = clampScore(parsed.grounded);
    const honest = clampScore(parsed.honest);
    const useful = clampScore(parsed.useful);
    if (grounded === null || honest === null || useful === null) {
      return { error: `judge reply missing scores: ${match[0].slice(0, 120)}` };
    }
    return { grounded, honest, useful, notes: typeof parsed.notes === 'string' ? parsed.notes : '' };
  } catch {
    return { error: `judge reply was not valid JSON: ${match[0].slice(0, 120)}` };
  }
}

function clampScore(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(5, Math.round(value)));
}

function parseCliOptions(argv: string[]): CliOptions {
  const options: CliOptions = { live: false, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg) continue;
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--live') {
      options.live = true;
    } else if (arg === '--models') {
      options.modelsArg = argv[++index];
    } else if (arg.startsWith('--models=')) {
      options.modelsArg = arg.slice('--models='.length);
    } else if (arg === '--judge') {
      options.judgeArg = argv[++index];
    } else if (arg.startsWith('--judge=')) {
      options.judgeArg = arg.slice('--judge='.length);
    } else if (arg === '--json-path') {
      options.jsonPath = argv[++index];
    } else if (arg.startsWith('--json-path=')) {
      options.jsonPath = arg.slice('--json-path='.length);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function printUsage(): void {
  console.log(`
Usage: npm run dm:eval -- [options]

Options:
  --live                Run fixtures against real models instead of stubs
  --models <list>       Comma-separated model list for --live (default: DM_MODEL)
  --judge <model>       LLM-as-judge scoring for live answers (e.g. openai/gpt-4.1)
  --json-path <path>    Write a JSON report (answers, failures, judge scores)
  --help                Show this help

Environment:
  AI_GATEWAY_API_KEY    When set, ALL models (including openai/*) route through the Vercel AI Gateway.
  OPENAI_API_KEY        Without a gateway key, reaches openai/* models directly. Also used by RAG search.
  DM_MODEL              Default live model (full <creator>/<model> id, e.g. anthropic/claude-sonnet-4.6).
`);
}

await main();
