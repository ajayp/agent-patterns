/**
 * Pattern 1: Single Call
 *
 * When to use: The question is self-contained and a single prompt can answer it.
 *
 * Task: "Which product had the highest revenue in Q3, and what drove it?"
 *
 * Pass the full dataset as context. One llmCall, one structured response.
 * This is the baseline — when you don't need a workflow at all.
 */

import { fileURLToPath } from "node:url";
import { z } from "zod";
import { llmCall } from "./shared/openai.js";
import { datasetContext } from "./shared/data.js";

const RevenueAnalysisSchema = z.object({
  topProduct: z.string().describe("Full product name"),
  totalRevenue: z.number().describe("Total revenue in dollars (quantity × unitPrice across all orders)"),
  unitsSold: z.number().describe("Total units sold across all orders for this product"),
  keyDrivers: z.array(z.string()).describe("2-4 specific factors that explain why this product led revenue"),
  summary: z.string().describe("One paragraph explaining what drove the result"),
});

export type Result = z.infer<typeof RevenueAnalysisSchema>;

export async function run(): Promise<Result> {
  const prompt = `
You are an e-commerce analyst. Analyze this Q3 2024 dataset and identify the product with the highest total revenue.

Dataset:
${datasetContext}

Answer the question: "Which product had the highest revenue in Q3, and what drove it?"
`.trim();

  return llmCall(prompt, RevenueAnalysisSchema);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await run();
  console.log("=== Pattern 1: Single Call ===\n");
  console.log(`Top Product:    ${result.topProduct}`);
  console.log(`Total Revenue:  $${result.totalRevenue.toLocaleString()}`);
  console.log(`Units Sold:     ${result.unitsSold}`);
  console.log("\nKey Drivers:");
  result.keyDrivers.forEach((d) => console.log(`  • ${d}`));
  console.log(`\nSummary:\n${result.summary}`);
}
