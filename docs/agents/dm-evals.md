# DM eval loop

Three layers for continuous answer-quality improvement:

| Layer | Command | Measures | When |
| --- | --- | --- | --- |
| Offline gate | `npm run dm:eval` | Stubbed-model pipeline: tool routing, deterministic blocks, refusals, no-leak | Every CI run |
| Live behavioral | `npm run dm:eval -- --live` | Same fixtures against real gateway models | Model/prompt/tool changes |
| Live judged | `npm run dm:eval -- --live --judge openai/gpt-4.1` | LLM-as-judge scores (grounded / honest / useful, 0-5) | Before switching `DM_MODEL` |

Latency stays separate: `npm run dm:bench` (`docs/agents/dm-latency-benchmark.md`).

## Model routing

With `AI_GATEWAY_API_KEY`, all model ids (including `openai/*`) route through the Vercel AI Gateway. Use full `<creator>/<model>` ids. `OPENAI_API_KEY` is still required for the `searchSources` RAG tool.

```bash
npm run dm:eval -- --live \
  --models anthropic/claude-sonnet-4.6,openai/gpt-4.1,google/gemini-2.5-pro \
  --judge openai/gpt-4.1 \
  --json-path ./.tmp/dm-eval-live.json

npm run dm:bench -- --models anthropic/claude-sonnet-4.6,openai/gpt-4.1 --iterations 5
```

## Improvement loop

1. Capture the exact bad question and what a good answer needed.
2. Classify: content gap (unpublished fact), retrieval/tool gap (`data-tools.ts` / system prompt), or model gap (prompt / `DM_MODEL`).
3. Add a failing fixture in `src/lib/dm/eval-fixtures.ts` before fixing.
4. Fix, then run offline + live (+ judge when changing models).
5. Keep `--json-path` reports as comparison artifacts; commit conclusions to the Linear issue, not the raw files.

Unknown projects (e.g. loom) are a content gap until published and/or given an approved RAG source. The `honesty: unknown project (loom)` fixture pins the honest fallback.

## Fixture expectations

- Assert on blocks and ids, not exact prose.
- Include a leak check (`candidate-hidden`) for project-data cases.
- Provide `modelText` so the offline gate can run the same `expect()`.
- Tone/concreteness belongs in the judge rubric, not `expect()`.
