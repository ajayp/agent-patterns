/**
 * Pattern 5: Adaptive Orchestrator-Workers
 *
 * When to use: The subtasks needed depend on the specific input and can't be predetermined,
 * AND the orchestrator needs to observe intermediate results and re-plan mid-task.
 *
 * Task: "Give me a full Q3 business review."
 *
 * Loop: orchestrate → workers → reviewAndReplan → repeat (max 3 iterations) → synthesize
 *
 * The feedback loop — observe results, then decide to continue, pivot, or stop — is what
 * distinguishes this from parallelization-sectioning with a dynamic slicer.
 */

import { fileURLToPath } from "node:url";
import { z } from "zod";
import { llmCall } from "./shared/openai.js";
import { datasetContext } from "./shared/data.js";

// --- Schemas ---

const SubtaskSchema = z.object({
  id: z.string().describe("Short snake_case identifier e.g. revenue_summary"),
  title: z.string().describe("Human-readable title for this sub-analysis"),
  instruction: z.string().describe("Detailed instruction for the analyst worker who will execute this subtask"),
});

const OrchestratorSchema = z.object({
  analysis: z.string().describe("Your reasoning for why you chose these subtasks given what you see in the data"),
  subtasks: z.array(SubtaskSchema).describe("3-5 distinct analytical sub-tasks that together tell the complete Q3 story"),
});

const WorkerSchema = z.object({
  findings: z.string().describe("Detailed analytical findings (2-4 paragraphs)"),
  keyMetrics: z.array(z.string()).describe("3-5 specific metrics with values and context e.g. 'Total Q3 revenue: $42,180'"),
});

const ReviewDecisionSchema = z.object({
  reasoning: z.string().describe("Why this decision was made"),
  action: z.enum(["done", "add_tasks", "replace_tasks"]),
  newSubtasks: z.array(SubtaskSchema).nullable().describe("Populated when action is add_tasks or replace_tasks; null otherwise"),
  obsoleteIds: z.array(z.string()).nullable().describe("IDs to drop from accumulated results when action is replace_tasks; null otherwise"),
  synthesisInstruction: z.string().nullable().describe("What to emphasize in the final report when action is done; null otherwise"),
});

const SynthesisSchema = z.object({
  executiveSummary: z.string(),
  sections: z.array(z.object({ title: z.string(), narrative: z.string() })),
  topRecommendations: z.array(z.string()),
});

// --- Types ---

export type WorkerResult = { subtask: z.infer<typeof SubtaskSchema>; result: z.infer<typeof WorkerSchema> };
export type ReviewDecision = z.infer<typeof ReviewDecisionSchema>;
export type SynthesisResult = z.infer<typeof SynthesisSchema>;
export type OrchestratorResult = z.infer<typeof OrchestratorSchema>;

export type Result = {
  iterations: number;
  plan: OrchestratorResult;
  history: Array<{ iteration: number; workerResults: WorkerResult[]; review: ReviewDecision }>;
  synthesis: SynthesisResult;
};

// --- Orchestrator ---

async function orchestrate(): Promise<OrchestratorResult> {
  const prompt = `
You are a business intelligence orchestrator. Inspect this Q3 2024 e-commerce dataset and decide
which sub-analyses would be most valuable for a full business review.

Identify 3-5 distinct analytical sub-tasks that together tell the complete Q3 story.
Choose based on what you actually see in the data — don't use a fixed template.
For example: if a product dominates revenue, make category-mix a subtask.
If regional patterns look uneven, make regional breakdown a subtask.

Dataset:
${datasetContext}
`.trim();

  return llmCall(prompt, OrchestratorSchema);
}

// --- Worker ---

async function runWorker(subtask: z.infer<typeof SubtaskSchema>): Promise<WorkerResult> {
  const prompt = `
You are a data analyst executing one focused sub-analysis as part of a larger Q3 business review.

Assignment: ${subtask.title}
Instructions: ${subtask.instruction}

Dataset (Q3 2024):
${datasetContext}
`.trim();

  const result = await llmCall(prompt, WorkerSchema, undefined, "gpt-4.1-mini");
  return { subtask, result };
}

// --- Review & Replan ---

async function reviewAndReplan(allResults: WorkerResult[], iteration: number): Promise<ReviewDecision> {
  const completedSummary = allResults
    .map((r) => `- ${r.subtask.title} [id: ${r.subtask.id}]\n  Metrics: ${r.result.keyMetrics.join(" | ")}`)
    .join("\n");

  const coveredIds = allResults.map((r) => r.subtask.id).join(", ");

  const doneGuidance =
    iteration === 1
      ? `This is the first review. Do NOT choose "done" — always find at least one surprising signal or uncovered angle worth drilling into (e.g. month-over-month trend, margin outlier, customer concentration risk).`
      : `You may choose "done" if the coverage is genuinely complete and actionable.`;

  const prompt = `
You are a business intelligence orchestrator reviewing intermediate results from a Q3 2024 business review.

Original goal: Produce a full Q3 business review covering revenue, growth, products, customers, and regional performance.

Completed subtasks so far:
${completedSummary}

Decide what to do next:
- "done": The completed analyses together tell a complete, actionable Q3 story. Set synthesisInstruction to guide the final report. Set newSubtasks and obsoleteIds to null.
- "add_tasks": An important angle is missing or a surprising metric warrants deeper investigation. Add 1-2 new subtasks. Set obsoleteIds and synthesisInstruction to null.
- "replace_tasks": A completed thread was unproductive or redundant. Drop it (set obsoleteIds) and replace with a better-targeted subtask. Set synthesisInstruction to null.

Already-covered subtask IDs (do not duplicate): ${coveredIds}

${doneGuidance}
`.trim();

  return llmCall(prompt, ReviewDecisionSchema);
}

// --- Synthesize ---

async function synthesize(allResults: WorkerResult[], instruction?: string): Promise<SynthesisResult> {
  const resultDetails = allResults
    .map(
      (r) =>
        `### ${r.subtask.title}\n${r.result.findings}\n\nKey metrics:\n${r.result.keyMetrics.map((m) => `- ${m}`).join("\n")}`,
    )
    .join("\n\n");

  const prompt = `
You are a senior business analyst writing the final Q3 2024 business review report.

${instruction ? `Synthesis instruction: ${instruction}\n` : ""}
Compile the following sub-analyses into a single structured report with an executive summary,
thematic sections, and top recommendations. Each recommendation must include a specific number or metric.

Sub-analyses:
${resultDetails}
`.trim();

  return llmCall(prompt, SynthesisSchema);
}

// --- Main run loop ---

export async function run(): Promise<Result> {
  const plan = await orchestrate();

  let allResults: WorkerResult[] = [];
  const history: Result["history"] = [];
  let currentSubtasks = plan.subtasks;
  let lastReview: ReviewDecision | undefined;

  for (let iteration = 1; iteration <= 3; iteration++) {
    const settled = await Promise.allSettled(currentSubtasks.map(runWorker));
    const iterationResults = settled.flatMap((r, i) => {
      if (r.status === "fulfilled") return [r.value];
      console.error(`Worker "${currentSubtasks[i].title}" failed:`, r.reason);
      return [];
    });
    allResults = [...allResults, ...iterationResults];

    const review = await reviewAndReplan(allResults, iteration);
    lastReview = review;
    history.push({ iteration, workerResults: iterationResults, review });

    const replacements = review.newSubtasks ?? [];
    if (review.action === "replace_tasks" && review.obsoleteIds?.length && replacements.length > 0) {
      const drop = new Set(review.obsoleteIds);
      allResults = allResults.filter((r) => !drop.has(r.subtask.id));
    }

    if (review.action === "done" || iteration === 3) break;

    currentSubtasks = replacements;
    if (currentSubtasks.length === 0) break;
  }

  const synthesis = await synthesize(allResults, lastReview?.synthesisInstruction ?? undefined);
  return { iterations: history.length, plan, history, synthesis };
}

// --- CLI output ---

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log("=== Pattern 5: Adaptive Orchestrator-Workers ===\n");
  console.log("Orchestrator: analyzing dataset and planning initial subtasks...");
  const result = await run();
  console.log(`\nOrchestrator reasoning:\n${result.plan.analysis}\n`);
  console.log(`\nCompleted in ${result.iterations} iteration(s)\n`);

  for (const { iteration, workerResults, review } of result.history) {
    console.log(`--- Iteration ${iteration} ---`);
    for (const { subtask, result: r } of workerResults) {
      console.log(`  [${subtask.id}] ${subtask.title}`);
      r.keyMetrics.forEach((m) => console.log(`    • ${m}`));
    }
    console.log(`  Review → ${review.action}: ${review.reasoning.slice(0, 120)}...`);
    console.log();
  }

  console.log("=== Final Q3 Business Review ===\n");
  console.log(result.synthesis.executiveSummary);
  console.log("\nSections:");
  for (const { title, narrative } of result.synthesis.sections) {
    console.log(`\n  ${title}\n  ${narrative}`);
  }
  console.log("\nTop Recommendations:");
  result.synthesis.topRecommendations.forEach((r, i) => console.log(`  ${i + 1}. ${r}`));
}
