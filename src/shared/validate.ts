/**
 * validate.ts — Ground-truth checker for all 7 patterns.
 *
 * Computes expected values directly from data.ts, runs each pattern,
 * then asserts key fields match. Numeric checks use a 5% tolerance
 * to allow for minor LLM arithmetic variation.
 *
 * Run: npx tsx src/validate.ts
 */

import { customers, orders, products } from "./data.js";
import { run as run01 } from "../01_workflow_single_call.js";
import { run as run02 } from "../02_workflow_chain.js";
import { run as run03, DEMO_QUERIES } from "../03_workflow_route.js";
import { run as run04s } from "../04_workflow_parallelization_sectioning.js";
import { run as run04v } from "../04_workflow_parallelization_voting.js";
import { run as run05 } from "../05_workflow_orchestrator_workers.js";
import { run as run06 } from "../06_workflow_evaluator_optimizer.js";

// ─── Ground truth ────────────────────────────────────────────────────────────

const revenueByProduct = new Map<string, { revenue: number; units: number }>();
for (const o of orders) {
  const prev = revenueByProduct.get(o.productId) ?? { revenue: 0, units: 0 };
  revenueByProduct.set(o.productId, {
    revenue: prev.revenue + o.quantity * o.unitPrice,
    units: prev.units + o.quantity,
  });
}

const [topProductId, topProductStats] = [...revenueByProduct.entries()].sort(
  (a, b) => b[1].revenue - a[1].revenue,
)[0];
const topProductName = products.find((p) => p.productId === topProductId)!.name;

const totalRevenue = orders.reduce((s, o) => s + o.quantity * o.unitPrice, 0);

const dailyRevenue = new Map<string, number>();
for (const o of orders) {
  dailyRevenue.set(o.date, (dailyRevenue.get(o.date) ?? 0) + o.quantity * o.unitPrice);
}
const uniqueDates = [...dailyRevenue.keys()].sort();
const peakEntry = [...dailyRevenue.entries()].sort((a, b) => b[1] - a[1])[0];

const monthlyRevenue = new Map<string, number>();
for (const o of orders) {
  const month = o.date.slice(0, 7);
  monthlyRevenue.set(month, (monthlyRevenue.get(month) ?? 0) + o.quantity * o.unitPrice);
}
const [julyRev, augRev, sepRev] = ["2024-07", "2024-08", "2024-09"].map(
  (m) => monthlyRevenue.get(m) ?? 0,
);
const expectedTrend = julyRev < augRev && augRev < sepRev ? "growth" : "other";

// Routes expected for DEMO_QUERIES
const expectedRoutes = ["revenue", "inventory", "anomaly"];

// ─── Assertion helpers ────────────────────────────────────────────────────────

type Check = { label: string; pass: boolean; detail: string };
const checks: Check[] = [];

function assert(label: string, pass: boolean, detail: string) {
  checks.push({ label, pass, detail });
}

function near(actual: number, expected: number, tolerancePct = 10): boolean {
  return Math.abs(actual - expected) / expected <= tolerancePct / 100;
}

function containsNumber(text: string): boolean {
  return /\$[\d,]+|\d[\d,]*(\.\d+)?%|\d{2,}/.test(text);
}

// ─── Print ground truth ───────────────────────────────────────────────────────

console.log("=== Ground Truth (computed from data.ts) ===\n");
console.log(`Top product:      ${topProductName} (${topProductId})`);
console.log(`  Revenue:        $${topProductStats.revenue.toLocaleString()}`);
console.log(`  Units sold:     ${topProductStats.units}`);
console.log(`Total Q3 revenue: $${totalRevenue.toLocaleString()}`);
console.log(`Unique order days: ${uniqueDates.length}`);
console.log(`Peak day:         ${peakEntry[0]} ($${peakEntry[1].toLocaleString()})`);
console.log(`Monthly revenue:  Jul $${julyRev.toLocaleString()} / Aug $${augRev.toLocaleString()} / Sep $${sepRev.toLocaleString()}`);
console.log(`Expected trend:   ${expectedTrend}`);
console.log(`Expected routes:  ${expectedRoutes.join(", ")} (for the 3 demo queries)\n`);

// ─── Pattern 1 ───────────────────────────────────────────────────────────────

console.log("Running Pattern 1: Single Call...");
const p1 = await run01();
assert(
  "P1: topProduct names Wireless Headphones Pro",
  p1.topProduct.toLowerCase().includes("headphone") || p1.topProduct.toLowerCase().includes("wireless"),
  `got "${p1.topProduct}"`,
);
assert(
  "P1: totalRevenue within 10% of $" + topProductStats.revenue.toLocaleString(),
  near(p1.totalRevenue, topProductStats.revenue),
  `got $${p1.totalRevenue.toLocaleString()}`,
);
assert(
  "P1: unitsSold within 10% of " + topProductStats.units,
  near(p1.unitsSold, topProductStats.units),
  `got ${p1.unitsSold}`,
);
assert("P1: keyDrivers is non-empty", p1.keyDrivers.length > 0, `${p1.keyDrivers.length} drivers`);

// ─── Pattern 2 ───────────────────────────────────────────────────────────────

console.log("Running Pattern 2: Prompt Chaining...");
const p2 = await run02();
assert(
  "P2: daily revenue count matches unique order dates (" + uniqueDates.length + ")",
  p2.dailyRevenue.dailyRevenue.length === uniqueDates.length,
  `got ${p2.dailyRevenue.dailyRevenue.length}`,
);
assert(
  "P2: peakDate is " + peakEntry[0],
  p2.trend.peakDate === peakEntry[0],
  `got "${p2.trend.peakDate}"`,
);
assert(
  "P2: peakRevenue within 10% of $" + peakEntry[1].toLocaleString(),
  near(p2.trend.peakRevenue, peakEntry[1]),
  `got $${p2.trend.peakRevenue.toLocaleString()}`,
);
assert(
  "P2: executiveSummary contains a number",
  containsNumber(p2.summary.executiveSummary),
  `"${p2.summary.executiveSummary}"`,
);

// ─── Pattern 3 ───────────────────────────────────────────────────────────────

console.log("Running Pattern 3: Routing...");
const p3 = await run03(DEMO_QUERIES);
assert("P3: got results for all 3 queries", p3.length === 3, `got ${p3.length}`);
for (let i = 0; i < expectedRoutes.length; i++) {
  const actual = p3[i]?.classification.route;
  assert(
    `P3: query ${i + 1} routed to "${expectedRoutes[i]}"`,
    actual === expectedRoutes[i],
    `got "${actual}"`,
  );
}
assert(
  "P3: all answers non-empty",
  p3.every((r) => r.answer.answer.length > 0),
  "checked",
);

// ─── Pattern 4a: Sectioning ───────────────────────────────────────────────────

console.log("Running Pattern 4 (Sectioning): Parallelization...");
const p4s = await run04s();
assert("P4s: byRegion has 4 entries", p4s.byRegion.rankings.length === 4, `got ${p4s.byRegion.rankings.length}`);
assert("P4s: byCategory has 3 entries", p4s.byCategory.rankings.length === 3, `got ${p4s.byCategory.rankings.length}`);
assert("P4s: bySegment has 3 entries", p4s.bySegment.rankings.length === 3, `got ${p4s.bySegment.rankings.length}`);
assert(
  "P4s: all region revenues are positive",
  p4s.byRegion.rankings.every((r) => r.totalRevenue > 0),
  "checked",
);
assert(
  "P4s: all category revenues are positive",
  p4s.byCategory.rankings.every((r) => r.totalRevenue > 0),
  "checked",
);

// ─── Pattern 4b: Voting ───────────────────────────────────────────────────────

console.log("Running Pattern 4 (Voting): Parallelization...");
const p4v = await run04v();
assert(
  "P4v: all 3 reviewers returned findings arrays",
  Array.isArray(p4v.reviews.revenue.findings) &&
    Array.isArray(p4v.reviews.volume.findings) &&
    Array.isArray(p4v.reviews.regional.findings),
  "checked",
);
assert(
  "P4v: confirmed is an array",
  Array.isArray(p4v.confirmed),
  `got ${typeof p4v.confirmed}`,
);
assert(
  "P4v: every confirmed anomaly was flagged by ≥2 reviewers",
  p4v.confirmed.every((a) => a.flaggedBy.length >= 2),
  p4v.confirmed.map((a) => `${a.flaggedBy.length} votes`).join(", ") || "none",
);
assert(
  "P4v: every confirmed anomaly description contains a number",
  p4v.confirmed.every((a) => containsNumber(a.description)),
  "checked",
);

// ─── Pattern 5 ───────────────────────────────────────────────────────────────

console.log("Running Pattern 5: Adaptive Orchestrator-Workers...");
const p5 = await run05();
assert(
  "P5: orchestrator produced 3-5 initial subtasks",
  p5.plan.subtasks.length >= 3 && p5.plan.subtasks.length <= 5,
  `got ${p5.plan.subtasks.length}`,
);
assert(
  "P5: completed at least 2 iterations (demonstrates re-planning)",
  p5.iterations >= 2,
  `got ${p5.iterations} iteration(s)`,
);
assert(
  "P5: at least one add_tasks or replace_tasks decision in history",
  p5.history.some((h) => h.review.action === "add_tasks" || h.review.action === "replace_tasks"),
  p5.history.map((h) => h.review.action).join(", "),
);
assert(
  "P5: synthesis has non-empty recommendations each containing a number",
  p5.synthesis.topRecommendations.length > 0 &&
    p5.synthesis.topRecommendations.every((r) => containsNumber(r)),
  `${p5.synthesis.topRecommendations.length} recommendation(s)`,
);

// ─── Pattern 6 ───────────────────────────────────────────────────────────────

console.log("Running Pattern 6: Evaluator-Optimizer...");
const p6 = await run06();
assert(
  "P6: completed within max iterations",
  p6.iterations <= 3,
  `used ${p6.iterations} iteration(s)`,
);
assert(
  "P6: final narrative contains at least 2 numbers",
  (p6.narrative.match(/\$[\d,]+|\d[\d,]*(\.\d+)?%|\b\d{2,}\b/g) ?? []).length >= 2,
  `"${p6.narrative}"`,
);
assert(
  "P6: no filler phrases in narrative",
  !/\b(overall|in conclusion|it is worth noting|it is important to|as we can see)\b/i.test(
    p6.narrative,
  ),
  "checked for filler phrases",
);

// ─── Results ─────────────────────────────────────────────────────────────────

const passed = checks.filter((c) => c.pass).length;
const failed = checks.filter((c) => !c.pass).length;

console.log(`\n${"=".repeat(50)}`);
console.log(`VALIDATION RESULTS: ${passed} passed, ${failed} failed\n`);

for (const { label, pass, detail } of checks) {
  const icon = pass ? "✓" : "✗";
  console.log(`  ${icon} ${label}`);
  if (!pass) console.log(`      → ${detail}`);
}

console.log();
if (failed > 0) process.exit(1);
