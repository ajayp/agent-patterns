# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # install dependencies
cp .env.example .env # then add OPENAI_API_KEY

# Run individual patterns
npm run 01           # Single Call
npm run 02           # Prompt Chaining
npm run 03           # Routing
npm run 04-sectioning
npm run 04-voting
npm run 05           # Orchestrator-Workers
npm run 06           # Evaluator-Optimizer

# Run all patterns and validate outputs against ground truth
npm run validate
```

No build step is needed — `tsx` executes TypeScript directly. TypeScript is checked implicitly by `tsx`; there is no separate `tsc` check script.

## Architecture

**Core abstraction — [src/openai.ts](src/openai.ts)**

Every pattern calls `llmCall<T>`, which wraps OpenAI's structured outputs API using Zod schemas:

```typescript
llmCall<T extends ZodRawShape>(
  prompt: string,
  schema: ZodObject<T>,
  system?: string,
  model?: string   // defaults to "gpt-4.1"
): Promise<ReturnType<ZodObject<T>["parse"]>>
```

The caller defines a Zod schema; `zodResponseFormat` instructs the model to emit JSON that satisfies it; `client.beta.chat.completions.parse` returns an already-validated typed object. There is no manual JSON parsing anywhere.

**Shared dataset — [src/data.ts](src/data.ts)**

All patterns import from `orders`, `products`, and `customers`. The dataset is synthetic Q3 2024 e-commerce data (25 orders, 8 products, 10 customers, 4 regions).

**Pattern files — [src/](src/)**

Each `0N_workflow_*.ts` is self-contained: it imports only from `openai.ts` and `data.ts`, defines its own Zod schemas inline, and exports a single `run()` function. There are no cross-pattern dependencies.

**Validation — [src/validate.ts](src/validate.ts)**

Imports all seven `run()` functions, computes expected values directly from `data.ts`, runs every pattern sequentially, and asserts key output fields match within a 10% numeric tolerance. Exits with code 1 on any failure. This is the closest thing to a test suite.

## Adding a new pattern

1. Create `src/0N_workflow_name.ts` — import `llmCall` from `./openai.js` and data from `./data.js` (`.js` extensions required for NodeNext module resolution even though files are `.ts`).
2. Define Zod schemas inline.
3. Export `async function run()` that returns the final typed result.
4. Add an `npm` script entry in `package.json`.
5. Optionally add assertions in `validate.ts`.
