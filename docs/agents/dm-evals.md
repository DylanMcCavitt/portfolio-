# DM eval loop — continuous answer-quality improvement

How to find, measure, and fix DM answer-quality problems (like "I asked about
loom and it didn't know") instead of one-off spot checks.

## The three eval layers

| Layer | Command | What it measures | When it runs |
| --- | --- | --- | --- |
| Offline gate | `npm run dm:eval` | Pipeline behavior with stubbed models: tool routing, deterministic blocks, refusals, no-leak guarantees. Free, deterministic. | Every CI run |
| Live behavioral | `npm run dm:eval -- --live` | The same fixtures against real models via the gateway: do real models pick the right tools and produce grounded blocks? | On model/prompt/tool changes |
| Live judged | `npm run dm:eval -- --live --judge openai/gpt-4.1` | LLM-as-judge scores each live answer 0-5 on **grounded / honest / useful**. Catches quality regressions the deterministic checks can't express. | On model/prompt changes; before switching `DM_MODEL` |

Latency comparison stays separate: `npm run dm:bench` (see
`docs/agents/dm-latency-benchmark.md`).

## Model routing (gateway-first)

With `AI_GATEWAY_API_KEY` set, **all** model ids — including `openai/*` — route
through the Vercel AI Gateway, so one key benchmarks any creator's models.
Model ids must be full `<creator>/<model>` gateway ids (e.g.
`anthropic/claude-sonnet-4.6`, `openai/gpt-4.1`). `OPENAI_API_KEY` remains
required for the `searchSources` RAG tool (Vector Store Search API) regardless
of which model answers.

Compare candidate `DM_MODEL` values:

```bash
npm run dm:eval -- --live \
  --models anthropic/claude-sonnet-4.6,openai/gpt-4.1,google/gemini-2.5-pro \
  --judge openai/gpt-4.1 \
  --json-path ./.tmp/dm-eval-live.json

npm run dm:bench -- --models anthropic/claude-sonnet-4.6,openai/gpt-4.1 --iterations 5
```

Read them together: eval pass rate + judge means for quality, benchmark
median/p95 first-token and completion for latency.

## The improvement loop

1. **Capture the failure.** When DM answers badly in preview, write down the
   exact question and what a good answer needed (which project, which tool,
   which fact).
2. **Decide the failure class.**
   - *Content gap* — the fact isn't in any published record (the "loom" case;
     see below). No prompt or model change fixes this; publish the content.
   - *Retrieval/tool gap* — the fact exists but search/ranking missed it
     (fix `TERM_SYNONYMS` / scoring in `src/lib/dm/data-tools.ts`, or the
     tool-selection rules in the system prompt in `src/lib/dm/runtime.ts`).
   - *Model gap* — tools returned the right data but the answer was vague or
     wrong (prompt or `DM_MODEL` change; verify with `--live --judge`).
3. **Add a fixture before fixing.** Every real failure becomes a case in
   `src/lib/dm/eval-fixtures.ts` with an `expect()` that fails today. The
   "loom" incident is captured as
   `honesty: unknown project (loom) never fabricates or leaks drafts`.
4. **Fix, then run all three layers.** Offline must stay green in CI; live
   confirms real models behave; judge scores confirm quality didn't regress
   elsewhere.
5. **Keep reports.** `--json-path` reports are the comparison artifact between
   runs — commit conclusions (not the raw files) to the relevant Linear issue.

## Why DM can't answer about loom (worked example)

DM answers **only** from: published DB project rows (+ catalog overlay),
approved public RAG sources, and static resume/contact data
(`src/data/resume.ts`). `loom` is not a published project record and has no
approved RAG source, so the honest behavior is "not in my published records" +
closest published work — not a made-up answer. To make loom answerable:

1. Run it through the discovery → Slack draft → admin review → **publish**
   flow so a published project row exists, and/or
2. Approve + ingest a RAG source for it via `/api/admin/rag/*` so
   `searchSources` can cite it.

The eval fixture above pins the honest-fallback behavior either way.

## Writing good fixture expectations

- Assert on **blocks and ids**, not exact prose — prose varies per model;
  blocks are the grounded contract (`projects` ids, `resume` trackIds,
  `contact` email, refusal text block).
- Always include a leak check (`candidate-hidden` fixture id) in cases that
  touch project data.
- Give each case a `modelText` stub so the offline gate can run it; the same
  `expect()` then runs unchanged against live models.
- Expectations that only a judge can grade (tone, concreteness) belong in the
  judge rubric, not in `expect()`.
