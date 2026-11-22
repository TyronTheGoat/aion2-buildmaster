/**
 * 80 % planning value for crafting.
 *
 * For n independent, identical attempts with a final success chance p per attempt:
 *   P(at least one success after n) = 1 - (1 - p)^n
 *   n80 = smallest whole n with that >= 0.8 = ceil(ln(0.2) / ln(1 - p))
 * The expected value E[N] = 1 / p is a different number and is shown separately.
 * Unknown stays unknown (null): it is never read as 0 % or 100 %.
 */

/** Probability 0..1, or null when it is not documented. */
export type Prob = number | null;

export const PLAN_TARGET = 0.8;

const valid = (p: Prob): p is number => typeof p === "number" && Number.isFinite(p) && p >= 0 && p <= 1;

/** Chance of at least one success after n attempts. */
export function chanceAfter(p: Prob, n: number): Prob {
  if (!valid(p)) return null;
  return 1 - Math.pow(1 - p, n);
}

/**
 * Smallest attempt count with at least `target` chance of one success.
 * null when p is unknown; Infinity when p is 0 (the goal can never be reached).
 */
export function attemptsFor(p: Prob, target = PLAN_TARGET): number | null {
  if (!valid(p)) return null;
  if (p === 0) return Infinity;
  if (p === 1) return 1;
  // ln(1-p) is negative; guard against floating point noise just under a whole number
  const raw = Math.log(1 - target) / Math.log(1 - p);
  let n = Math.max(1, Math.ceil(raw - 1e-9));
  while (1 - Math.pow(1 - p, n) < target - 1e-12) n++;
  while (n > 1 && 1 - Math.pow(1 - p, n - 1) >= target - 1e-12) n--;
  return n;
}

/** Mathematical expected number of attempts, 1 / p (not the 80 % value). */
export function expectedAttempts(p: Prob): number | null {
  if (!valid(p)) return null;
  return p === 0 ? Infinity : 1 / p;
}

/** The chances documented for one recipe at one mastery level. */
export interface RecipeChances {
  /** chance the base craft succeeds */
  pBase: Prob;
  /** chance a combo triggers, given the base craft succeeded */
  pComboActivation: Prob;
  /** chance the triggered combo succeeds */
  pComboSuccess: Prob;
  /** final chance per attempt for the combo item, when an official source states it directly */
  pFinal: Prob;
  /** the recipe always gives its normal result */
  guaranteed: boolean | null;
}

export type ChanceGoal = "normal" | "combo";

/**
 * Effective chance per attempt for one goal.
 * - normal result: 1 for guaranteed recipes, otherwise the base chance.
 * - combo result: the documented final chance if there is one, otherwise base × activation × combo success,
 *   but only when all three are known. A known activation chance alone is NOT the final chance.
 */
export function effectiveChance(c: RecipeChances, goal: ChanceGoal): Prob {
  if (goal === "normal") {
    if (c.guaranteed === true) return 1;
    return valid(c.pBase) ? c.pBase : null;
  }
  if (valid(c.pFinal)) return c.pFinal;
  const base = c.guaranteed === true ? 1 : c.pBase;
  if (valid(base) && valid(c.pComboActivation) && valid(c.pComboSuccess)) return base * c.pComboActivation * c.pComboSuccess;
  return null;
}

/** Plan summary for one goal: 80 % value, the chance it really gives, and the expected value. */
export function planFor(p: Prob) {
  const n80 = attemptsFor(p);
  return {
    p,
    n80,
    reached: n80 === null || !Number.isFinite(n80) ? null : chanceAfter(p, n80),
    expected: expectedAttempts(p),
  };
}

/** Small seeded random generator (mulberry32), so Monte Carlo runs are reproducible. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One step of a path for the whole-project simulation. */
export interface SimStep {
  /** chance per attempt that this step gives what the path needs */
  p: number;
  /** cost of a successful attempt */
  cost: number;
  /** cost of a failed attempt (what is lost); defaults to `cost` */
  failCost?: number;
}

/**
 * Whole-project 80 % budget by simulation: every run repeats each step until it succeeds and adds up the cost.
 * The 80 % budget is the cost that 80 % of the runs stay within; this is NOT the sum of the per-step 80 % values.
 * Returns null when a step can never succeed. Fixed seed, capped run count and attempts per step.
 */
export function simulateBudget(steps: SimStep[], opts: { runs?: number; seed?: number; maxAttemptsPerStep?: number } = {}) {
  const runs = Math.min(Math.max(opts.runs ?? 20000, 100), 200000);
  const cap = opts.maxAttemptsPerStep ?? 10000;
  if (steps.some((s) => !(s.p > 0))) return null;
  const rnd = seededRandom(opts.seed ?? 80);
  const costs = new Float64Array(runs);
  const tries = new Float64Array(runs);
  let capped = 0;
  for (let r = 0; r < runs; r++) {
    let cost = 0, n = 0;
    for (const s of steps) {
      let k = 0;
      for (;;) {
        k++;
        if (rnd() < s.p || k >= cap) { cost += s.cost; break; }
        cost += s.failCost ?? s.cost;
      }
      if (k >= cap) capped++;
      n += k;
    }
    costs[r] = cost; tries[r] = n;
  }
  const q = (arr: Float64Array, x: number) => { const a = Array.from(arr).sort((m, n) => m - n); return a[Math.min(a.length - 1, Math.ceil(x * a.length) - 1)]; };
  const mean = costs.reduce((a, b) => a + b, 0) / runs;
  // 95 % confidence interval of the 80 % quantile (order statistics, normal approximation)
  const sorted = Array.from(costs).sort((a, b) => a - b);
  const half = 1.96 * Math.sqrt(runs * PLAN_TARGET * (1 - PLAN_TARGET));
  const lo = sorted[Math.max(0, Math.floor(runs * PLAN_TARGET - half) - 1)];
  const hi = sorted[Math.min(runs - 1, Math.ceil(runs * PLAN_TARGET + half) - 1)];
  return { budget80: q(costs, PLAN_TARGET), attempts80: q(tries, PLAN_TARGET), expectedCost: mean, ci95: [lo, hi] as [number, number], runs, seed: opts.seed ?? 80, capped };
}
