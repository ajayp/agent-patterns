/**
 * Pattern 6: Evaluator-Optimizer
 *
 * When to use: Output quality can be judged, and iteration demonstrably improves it.
 *
 * Task: Generate a Q3 narrative for a board slide, then refine it.
 *
 * Generator: write a concise, insight-driven Q3 narrative (3-4 sentences)
 * Evaluator criteria:
 *   - Contains at least two specific numbers
 *   - Names a clear winner and a clear concern
 *   - No filler phrases ("it is worth noting", "overall", "in conclusion")
 *   - Reads like a CFO wrote it, not a chatbot
 *
 * Loop runs until evaluator returns PASS or 3 iterations, whichever comes first.
 * If max iterations are reached, the last generated result is returned (best-effort).
 */

import { fileURLToPath } from "node:url";
import { z } from "zod";
import { llmCall } from "./shared/openai.js";
import { datasetContext } from "./shared/data.js";

const MAX_ITERATIONS = 3;

const GeneratorSchema = z.object({
  thoughts: z.string().describe("Your plan: what you will emphasize and why, and how you addressed prior feedback"),
  narrative: z.string().describe("The 3-4 sentence board narrative — direct, specific numbers, no filler phrases"),
});

const EvaluatorSchema = z.object({
  status: z.enum(["PASS", "FAIL"]).describe("PASS only if ALL criteria are met, FAIL otherwise"),
  feedback: z.string().describe("Specific, actionable feedback on what to improve. Empty string if PASS"),
});

const DATASET_CONTEXT = datasetContext;

const GENERATOR_SYSTEM = `
You are a CFO preparing the Q3 narrative slide for a board presentation.
Write with the precision and directness of a seasoned finance executive.
Never use filler phrases like "it is worth noting", "overall", "in conclusion",
"it is important to", or "as we can see".
`.trim();

const EVALUATOR_SYSTEM = `
You are a strict editorial reviewer for board-level financial communications.
Evaluate only — do not rewrite.
`.trim();

// --- Generator ---

async function generate(previousNarrative?: string, feedback?: string) {
  const refinementContext =
    previousNarrative !== undefined && feedback !== undefined
      ? `\nPrevious attempt:\n${previousNarrative}\n\nFeedback to address:\n${feedback}\n`
      : "";

  const prompt = `
Q3 2024 Dataset:
${DATASET_CONTEXT}
${refinementContext}
Write a 3-4 sentence Q3 narrative for the board slide. It must:
- Contain at least two specific numbers (revenue figures, growth rates, or counts)
- Name a clear winner (top product or region)
- Name a clear concern (underperformer or risk)
- Sound like a CFO wrote it
`.trim();

  return llmCall(prompt, GeneratorSchema, GENERATOR_SYSTEM);
}

// --- Evaluator ---

async function evaluate(narrative: string) {
  const prompt = `
Evaluate this board narrative against these criteria:
1. Contains at least two specific numbers (dollar amounts, percentages, or counts)
2. Names a clear winner (specific product or region)
3. Names a clear concern (specific underperformer or risk)
4. Contains no filler phrases ("overall", "in conclusion", "it is worth noting", etc.)
5. Reads like a CFO wrote it — direct, precise, no hedging

Narrative to evaluate:
"${narrative}"
`.trim();

  return llmCall(prompt, EvaluatorSchema, EVALUATOR_SYSTEM);
}

// --- Evaluator-optimizer loop ---

async function generateAndRefine() {
  const history: Array<{ narrative: string; status: string; feedback: string }> = [];

  let lastNarrative: string | undefined;
  let lastFeedback: string | undefined;

  for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
    console.log(`\nIteration ${iteration}: generating narrative...`);
    const generated = await generate(lastNarrative, lastFeedback);
    console.log(`  Thoughts: ${generated.thoughts}`);
    console.log(`  Narrative: "${generated.narrative}"`);

    console.log(`Iteration ${iteration}: evaluating...`);
    const evaluation = await evaluate(generated.narrative);
    console.log(`  Status: ${evaluation.status}`);
    if (evaluation.feedback) console.log(`  Feedback: ${evaluation.feedback}`);

    history.push({
      narrative: generated.narrative,
      status: evaluation.status,
      feedback: evaluation.feedback,
    });

    if (evaluation.status === "PASS") {
      return { narrative: generated.narrative, iterations: iteration, history, passed: true };
    }

    lastNarrative = generated.narrative;
    lastFeedback = evaluation.feedback;
  }

  // Max iterations reached — return last result (best-effort)
  const last = history[history.length - 1];
  return { narrative: last.narrative, iterations: MAX_ITERATIONS, history, passed: false };
}

export type Result = Awaited<ReturnType<typeof generateAndRefine>>;

export async function run(): Promise<Result> {
  return generateAndRefine();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log("=== Pattern 5: Evaluator-Optimizer ===\n");
  console.log(`Task: Generate a board-slide Q3 narrative (max ${MAX_ITERATIONS} iterations)\n`);
  const result = await run();
  console.log("\n=== Final Result ===\n");
  console.log(`Iterations:  ${result.iterations}`);
  console.log(`Passed:      ${result.passed ? "Yes" : `No (best-effort after ${MAX_ITERATIONS} attempts)`}`);
  console.log(`\nNarrative:\n"${result.narrative}"`);
}
