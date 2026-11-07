/** Paid-plan gate shared by team-orchestrate (mirrors UI subscriptionGating). */
const PAID_PLANS = [
  "starter", "pro", "pro_plus", "plus", "elite", "max",
  "business", "team", "enterprise", "ultimate", "premium",
];

export function isPaidUser(plan: string | null | undefined): boolean {
  return PAID_PLANS.includes((plan || "free").toLowerCase());
}
