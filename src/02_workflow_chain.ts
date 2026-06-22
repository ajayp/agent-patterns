/**
 * Pattern 2: Prompt Chaining
 *
 * When to use: The task has a fixed sequence of steps where each output feeds the next.
 *
 * Task: Raw orders → daily revenue totals → trend identification → executive one-liner
 *
 * Each step receives only the output of the previous step, not the raw data.
 * Demonstrates how chaining lets you apply focused prompts instead of one overloaded prompt.
 */

import { fileURLToPath } from "node:url";
import { z } from "zod";
import { llmCall } from "./shared/openai.js";
import { orders } from "./shared/data.js";

// --- Step schemas ---

const DailyRevenueSchema = z.object({
  dailyRevenue: z.array(
    z.object({
      date: z.string().describe("ISO date string e.g. 2024-07-03"),
      revenue: z.number().describe("Total revenue for this date (sum of quantity × unitPrice across all orders on this date)"),
    }),
  ).describe("All order dates sorted chronologically, one entry per date"),
});

const TrendSchema = z.object({
  shape: z.enum(["growth", "decline", "volatile", "flat"]).describe("Overall revenue trend shape across Q3"),
  supportingPoints: z.array(z.string()).describe("2-3 specific data points that support the trend classification"),
  peakDate: z.string().describe("Date with the highest single-day revenue"),
  peakRevenue: z.number().describe("Revenue on the peak date"),
  troughDate: z.string().describe("Date with the lowest single-day revenue"),
  troughRevenue: z.number().describe("Revenue on the trough date"),
});

const SummarySchema = z.object({
  executiveSummary: z.string().describe("One sentence a CFO would put in a board deck — specific numbers, no filler phrases"),
});

// --- Chain steps ---

async function aggregateDailyRevenue() {
  const prompt = `
You are a data analyst. Aggregate these Q3 2024 orders into daily revenue totals.
Revenue for each order = quantity × unitPrice. Include every date in the orders, sorted chronologically.

Orders:
${JSON.stringify(orders, null, 2)}
`.trim();

  return llmCall(prompt, DailyRevenueSchema, undefined, "gpt-4.1-mini");
}

async function identifyTrend(dailyRevenue: z.infer<typeof DailyRevenueSchema>) {
  const prompt = `
You are a revenue analyst. Given these daily revenue totals, identify the overall trend shape
and find the peak and trough dates.

For trend shape, assess the month-over-month direction across the full quarter, not day-to-day
fluctuations. Use: growth (revenue generally rises over the quarter), decline (generally falls),
volatile (no clear directional trend), or flat (roughly constant throughout).

Daily Revenue:
${JSON.stringify(dailyRevenue.dailyRevenue, null, 2)}
`.trim();

  return llmCall(prompt, TrendSchema);
}

async function writeExecutiveSummary(trend: z.infer<typeof TrendSchema>) {
  const prompt = `
You are a CFO communicator. Translate this revenue trend analysis into a single executive sentence.
No filler phrases. Be specific with numbers.

Trend data:
${JSON.stringify(trend, null, 2)}
`.trim();

  return llmCall(prompt, SummarySchema);
}

export type Result = {
  dailyRevenue: z.infer<typeof DailyRevenueSchema>;
  trend: z.infer<typeof TrendSchema>;
  summary: z.infer<typeof SummarySchema>;
};

export async function run(): Promise<Result> {
  const step1 = await aggregateDailyRevenue();
  const step2 = await identifyTrend(step1);
  const step3 = await writeExecutiveSummary(step2);
  return { dailyRevenue: step1, trend: step2, summary: step3 };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log("=== Pattern 2: Prompt Chaining ===\n");

  console.log("Step 1: Aggregating daily revenue...");
  const { dailyRevenue, trend, summary } = await run();
  console.log(`  → ${dailyRevenue.dailyRevenue.length} days of revenue data`);

  console.log("Step 2: Identifying trend...");
  console.log(`  → Trend shape: ${trend.shape}`);
  console.log(`  → Peak: $${trend.peakRevenue.toLocaleString()} on ${trend.peakDate}`);

  console.log("Step 3: Writing executive summary...");
  console.log("\n--- Result ---");
  console.log(`Trend shape: ${trend.shape}`);
  console.log("Supporting points:");
  trend.supportingPoints.forEach((p) => console.log(`  • ${p}`));
  console.log(`\nExecutive summary:\n  "${summary.executiveSummary}"`);
}
