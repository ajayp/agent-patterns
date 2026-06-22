/**
 * Pattern 4: Parallelization — Sectioning
 *
 * When to use: The task breaks into independent subtasks that don't depend on each other.
 *
 * Task: Simultaneously analyze revenue by region, by product category, and by customer segment.
 *
 * All three analyses are independent — no output feeds another. Running them concurrently
 * via Promise.all cuts latency proportionally to the number of branches.
 * Demonstrates the key difference from chaining: subtasks run simultaneously, not sequentially.
 *
 * See 04_workflow_parallelization_voting.ts for the voting variant.
 */

import { fileURLToPath } from "node:url";
import { z } from "zod";
import { llmCall } from "./shared/openai.js";
import { customers, orders, products } from "./shared/data.js";

// --- Schemas ---

const RegionSchema = z.object({
  rankings: z.array(
    z.object({
      region: z.string().describe("Region name"),
      totalRevenue: z.number().describe("Total revenue for this region"),
      orderCount: z.number().describe("Number of orders from this region"),
    }),
  ).describe("All four regions ranked by total revenue, highest first"),
  topRegion: z.string().describe("Region with the highest total revenue"),
  insight: z.string().describe("One specific observation about regional revenue distribution"),
});

const CategorySchema = z.object({
  rankings: z.array(
    z.object({
      category: z.string().describe("Product category name"),
      totalRevenue: z.number().describe("Total revenue for this category"),
      unitsSold: z.number().describe("Total units sold in this category"),
    }),
  ).describe("All three categories ranked by total revenue, highest first"),
  topCategory: z.string().describe("Category with the highest total revenue"),
  insight: z.string().describe("One specific observation about category revenue distribution"),
});

const SegmentSchema = z.object({
  rankings: z.array(
    z.object({
      segment: z.string().describe("Customer segment name"),
      totalRevenue: z.number().describe("Total revenue from this segment"),
      customerCount: z.number().describe("Number of distinct customers in this segment"),
      avgRevenuePerCustomer: z.number().describe("Average revenue per customer in this segment"),
    }),
  ).describe("All three segments ranked by total revenue, highest first"),
  topSegment: z.string().describe("Segment with the highest total revenue"),
  insight: z.string().describe("One specific observation about segment revenue distribution"),
});

// --- Parallel branches ---

async function analyzeByRegion() {
  const prompt = `
You are a regional sales analyst. Analyze this Q3 2024 e-commerce dataset and rank all four
regions (North, South, East, West) by total revenue. Revenue per order = quantity × unitPrice.

Orders:
${JSON.stringify(orders, null, 2)}
`.trim();

  return llmCall(prompt, RegionSchema);
}

async function analyzeByCategory() {
  const prompt = `
You are a product analyst. Analyze this Q3 2024 e-commerce dataset and rank all three product
categories (Electronics, Apparel, Home & Kitchen) by total revenue and units sold.
Revenue per order = quantity × unitPrice.

Orders:
${JSON.stringify(orders, null, 2)}

Products:
${JSON.stringify(products, null, 2)}
`.trim();

  return llmCall(prompt, CategorySchema);
}

async function analyzeBySegment() {
  const prompt = `
You are a customer analyst. Analyze this Q3 2024 e-commerce dataset and rank all three customer
segments (Enterprise, SMB, Consumer) by total revenue. Also compute average revenue per customer
within each segment. Revenue per order = quantity × unitPrice.

Orders:
${JSON.stringify(orders, null, 2)}

Customers:
${JSON.stringify(customers, null, 2)}
`.trim();

  return llmCall(prompt, SegmentSchema);
}

export type Result = {
  byRegion: z.infer<typeof RegionSchema>;
  byCategory: z.infer<typeof CategorySchema>;
  bySegment: z.infer<typeof SegmentSchema>;
};

export async function run(): Promise<Result> {
  const [byRegion, byCategory, bySegment] = await Promise.all([
    analyzeByRegion(),
    analyzeByCategory(),
    analyzeBySegment(),
  ]);
  return { byRegion, byCategory, bySegment };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log("=== Pattern 4: Parallelization ===\n");
  console.log("Running 3 independent analyses concurrently...\n");

  const { byRegion, byCategory, bySegment } = await run();

  console.log("--- By Region ---");
  byRegion.rankings.forEach((r) =>
    console.log(`  ${r.region}: $${r.totalRevenue.toLocaleString()} (${r.orderCount} orders)`),
  );
  console.log(`  Insight: ${byRegion.insight}\n`);

  console.log("--- By Category ---");
  byCategory.rankings.forEach((r) =>
    console.log(`  ${r.category}: $${r.totalRevenue.toLocaleString()} (${r.unitsSold} units)`),
  );
  console.log(`  Insight: ${byCategory.insight}\n`);

  console.log("--- By Customer Segment ---");
  bySegment.rankings.forEach((r) =>
    console.log(
      `  ${r.segment}: $${r.totalRevenue.toLocaleString()} (avg $${r.avgRevenuePerCustomer.toLocaleString()}/customer)`,
    ),
  );
  console.log(`  Insight: ${bySegment.insight}`);
}
