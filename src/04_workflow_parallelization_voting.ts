/**
 * Pattern 4: Parallelization — Voting
 *
 * When to use: Confidence matters more than speed. Run the same task multiple times with
 * different perspectives and surface only findings that multiple reviewers agree on.
 *
 * Task: Detect anomalies in Q3 order data using three independent reviewers, each with a
 * different analytical lens. Only surface findings flagged by 2 or more reviewers.
 *
 * Reviewers:
 *   revenue   — unusual revenue concentrations, spikes, or gaps
 *   volume    — unusual order quantities or purchase frequency
 *   regional  — unexpected patterns in where customers buy or which segments dominate a region
 *
 * Same input, three independent opinions, majority threshold.
 * Demonstrates the key difference from sectioning: redundancy for confidence, not speed.
 *
 * See 04_workflow_parallelization_sectioning.ts for the sectioning variant.
 */

import { fileURLToPath } from "node:url";
import { z } from "zod";
import { llmCall } from "./shared/openai.js";
import { datasetContext } from "./shared/data.js";

// --- Schemas ---

const ReviewerSchema = z.object({
  findings: z.array(
    z.object({
      anomalyId: z.string().describe("Short snake_case identifier e.g. headphones_concentration"),
      description: z.string().describe("Specific observation with numbers — what is anomalous and by how much"),
      severity: z.enum(["high", "medium", "low"]).describe("How unusual this is relative to the rest of the data"),
    }),
  ).describe("All anomalies this reviewer found. Empty array if nothing stands out."),
});

const DATASET_CONTEXT = datasetContext;

// --- Three independent reviewers ---

async function revenueReviewer() {
  const prompt = `
You are an anomaly detection analyst focused on revenue patterns.
Scan this Q3 2024 e-commerce dataset for unusual revenue concentrations, spikes, or gaps.
Revenue per order = quantity × unitPrice.

Look for things like: one product or customer driving a disproportionate share of total revenue,
months with unusually high or low revenue relative to the quarter, single orders that are
outliers in dollar value.

Dataset:
${DATASET_CONTEXT}
`.trim();

  return llmCall(prompt, ReviewerSchema);
}

async function volumeReviewer() {
  const prompt = `
You are an anomaly detection analyst focused on order volume and purchase frequency.
Scan this Q3 2024 e-commerce dataset for unusual quantity patterns or buying behavior.

Look for things like: order quantities that are far above or below typical for that product,
customers who place orders at an unusual frequency, products with erratic unit counts across orders.

Dataset:
${DATASET_CONTEXT}
`.trim();

  return llmCall(prompt, ReviewerSchema);
}

async function regionalReviewer() {
  const prompt = `
You are an anomaly detection analyst focused on regional and customer-segment patterns.
Scan this Q3 2024 e-commerce dataset for unexpected geographic or segment behavior.

Look for things like: a region that punches far above or below its expected share of orders,
a customer segment concentrated in one region when you'd expect it spread across all four,
products that sell in some regions but not others.

Dataset:
${DATASET_CONTEXT}
`.trim();

  return llmCall(prompt, ReviewerSchema);
}

// --- Voting aggregation ---

type Finding = z.infer<typeof ReviewerSchema>["findings"][number];
type ReviewerName = "revenue" | "volume" | "regional";

function aggregateByVote(
  reviews: Record<ReviewerName, z.infer<typeof ReviewerSchema>>,
  threshold = 2,
): Array<{ description: string; severity: Finding["severity"]; flaggedBy: ReviewerName[] }> {
  // Collect all finding descriptions with their source reviewer
  const allFindings: Array<{ finding: Finding; reviewer: ReviewerName }> = [];
  for (const [reviewer, review] of Object.entries(reviews) as [ReviewerName, z.infer<typeof ReviewerSchema>][]) {
    for (const finding of review.findings) {
      allFindings.push({ finding, reviewer });
    }
  }

  // Group by anomalyId — findings with the same id across reviewers count as one vote each
  const byId = new Map<string, { descriptions: string[]; severities: Finding["severity"][]; reviewers: ReviewerName[] }>();
  for (const { finding, reviewer } of allFindings) {
    const key = finding.anomalyId;
    if (!byId.has(key)) byId.set(key, { descriptions: [], severities: [], reviewers: [] });
    const entry = byId.get(key)!;
    entry.descriptions.push(finding.description);
    entry.severities.push(finding.severity);
    entry.reviewers.push(reviewer);
  }

  // Surface only findings that meet the vote threshold
  const passed: Array<{ description: string; severity: Finding["severity"]; flaggedBy: ReviewerName[] }> = [];
  for (const [, entry] of byId) {
    if (entry.reviewers.length >= threshold) {
      // Use the most severe rating across reviewers; prefer the longest description (most detail)
      const severityOrder: Record<Finding["severity"], number> = { high: 2, medium: 1, low: 0 };
      const severity = entry.severities.reduce((a, b) => (severityOrder[a] >= severityOrder[b] ? a : b));
      const description = entry.descriptions.reduce((a, b) => (b.length > a.length ? b : a));
      passed.push({ description, severity, flaggedBy: entry.reviewers });
    }
  }

  return passed.sort((a, b) => {
    const order: Record<Finding["severity"], number> = { high: 2, medium: 1, low: 0 };
    return order[b.severity] - order[a.severity];
  });
}

export type Result = {
  reviews: Record<ReviewerName, z.infer<typeof ReviewerSchema>>;
  confirmed: ReturnType<typeof aggregateByVote>;
};

export async function run(): Promise<Result> {
  const [revenue, volume, regional] = await Promise.all([
    revenueReviewer(),
    volumeReviewer(),
    regionalReviewer(),
  ]);
  const reviews = { revenue, volume, regional };
  const confirmed = aggregateByVote(reviews);
  return { reviews, confirmed };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log("=== Pattern 4b: Parallelization — Voting ===\n");
  console.log("Running 3 independent anomaly reviewers concurrently...\n");

  const { reviews, confirmed } = await run();

  console.log("--- Individual reviewer findings ---");
  for (const [name, review] of Object.entries(reviews) as [ReviewerName, z.infer<typeof ReviewerSchema>][]) {
    console.log(`\n${name} reviewer (${review.findings.length} findings):`);
    review.findings.forEach((f) => console.log(`  [${f.severity}] ${f.anomalyId}: ${f.description}`));
  }

  console.log("\n--- Confirmed anomalies (flagged by ≥2 reviewers) ---");
  if (confirmed.length === 0) {
    console.log("  No anomalies met the voting threshold.");
  } else {
    confirmed.forEach((a) =>
      console.log(`  [${a.severity}] flagged by: ${a.flaggedBy.join(", ")}\n    ${a.description}`),
    );
  }
}
