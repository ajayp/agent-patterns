/**
 * Pattern 3: Routing
 *
 * When to use: Input varies in type and each type deserves a specialist handler.
 *
 * Task: Incoming analyst queries are classified, then dispatched to a specialist.
 *
 * Routes:
 *   revenue   — totals, growth, comparisons
 *   inventory — units sold, stockout risk, velocity
 *   customer  — segment mix, repeat rate, LTV signals
 *   anomaly   — outliers, spikes, drops, unusual patterns
 *
 * Two LLM calls: classifier → specialist.
 * Demonstrates clean separation of concerns and why a single "analyst" prompt degrades quality.
 */

import { fileURLToPath } from "node:url";
import { z } from "zod";
import { llmCall } from "./shared/openai.js";
import { datasetContext } from "./shared/data.js";

const ROUTE_KEYS = ["revenue", "inventory", "customer", "anomaly"] as const;
type RouteKey = (typeof ROUTE_KEYS)[number];

const ClassificationSchema = z.object({
  route: z.enum(ROUTE_KEYS).describe("The specialist route that best matches the query intent"),
  reasoning: z.string().describe("Brief explanation of why this route was chosen"),
});

const AnswerSchema = z.object({
  answer: z.string().describe("Detailed analytical answer to the query"),
  supportingData: z.array(z.string()).describe("2-4 specific data points from the dataset that support the answer"),
});

const SPECIALISTS: Record<RouteKey, string> = {
  revenue: `You are a revenue analyst specializing in totals, growth rates, and period-over-period
comparisons. Focus on revenue numbers, trends, and growth drivers. Be precise with dollar amounts.`,

  inventory: `You are an inventory analyst specializing in units sold, sell-through velocity,
and stockout risk. Focus on quantity movements, fast/slow movers, and restocking signals.`,

  customer: `You are a customer analyst specializing in segment mix, repeat purchase behavior,
and lifetime value signals. Focus on Enterprise vs SMB vs Consumer patterns and loyalty indicators.`,

  anomaly: `You are an anomaly detection analyst. Look for outliers, unexpected spikes or drops,
unusual regional patterns, and anything that deviates significantly from baseline. Quantify the deviation.`,
};

const DATASET_CONTEXT = datasetContext;

async function classify(query: string) {
  const prompt = `
Classify this analyst query and route it to the most appropriate specialist.

Available routes:
  revenue   — questions about totals, growth, revenue comparisons
  inventory — questions about units sold, stock levels, product velocity
  customer  — questions about customer segments, retention, LTV
  anomaly   — questions about outliers, unexpected patterns, spikes or drops

Query: "${query}"
`.trim();

  return llmCall(prompt, ClassificationSchema, undefined, "gpt-4.1-mini");
}

async function runSpecialist(route: RouteKey, query: string) {
  const prompt = `
${query}

Dataset (Q3 2024):
${DATASET_CONTEXT}
`.trim();

  return llmCall(prompt, AnswerSchema, SPECIALISTS[route]);
}

async function route(query: string) {
  const classification = await classify(query);
  const answer = await runSpecialist(classification.route, query);
  return { classification, answer };
}

export type RouteResult = { query: string; classification: z.infer<typeof ClassificationSchema>; answer: z.infer<typeof AnswerSchema> };

export const DEMO_QUERIES = [
  "What was our total revenue for Q3 and how did it trend month over month?",
  "Which products are at risk of stocking out based on Q3 velocity?",
  "Is there anything anomalous in the Q3 order data I should flag for leadership?",
];

export async function run(queries = DEMO_QUERIES): Promise<RouteResult[]> {
  return Promise.all(queries.map(async (query) => ({ query, ...(await route(query)) })));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log("=== Pattern 3: Routing ===\n");
  const results = await run();
  for (const { query, classification, answer } of results) {
    console.log(`Query: "${query}"`);
    console.log(`Route:     ${classification.route}`);
    console.log(`Reasoning: ${classification.reasoning}`);
    console.log(`Answer:    ${answer.answer}`);
    console.log("Supporting data:");
    answer.supportingData.forEach((d) => console.log(`  • ${d}`));
    console.log();
  }
}
