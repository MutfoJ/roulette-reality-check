// ============================================================
//  Roulette engine — European single-zero (37 pockets)
// ============================================================

export const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
  5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
] as const;

export const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
export const POCKET_ANGLE = 360 / WHEEL_ORDER.length;
export const SPEEDS = [1, 2, 4, 8, 20, 50, 100] as const;

export type BetKind =
  | "red" | "black" | "even" | "odd" | "low" | "high"
  | "dozen1" | "dozen2" | "dozen3"
  | "column1" | "column2" | "column3"
  | "straight";

export type Progression =
  | "flat" | "martingale" | "reverse-martingale" | "dalembert"
  | "fibonacci" | "oscars" | "labouchere" | "manual";

export type ChartMode = "money" | "percent" | "profit" | "drawdown" | "stake";

export interface Bet { kind: BetKind; amount: number; number?: number; }

export interface SimOptions {
  baseStake: number;
  progression: Progression;
  betKind: BetKind;
  straightNumber: number;
  tableMax: number;
  manualBets?: Bet[];
}

export interface StrategyState {
  stake: number;
  fibIndex: number;
  oscarsProfit: number;
  labouchere: number[];
}

export interface SpinResult {
  number: number;
  won: boolean;
  stake: number;
  profit: number;
  payout: number;
  balance: number;
  bets: Bet[];
}

export interface Summary {
  spins: number;
  profit: number;
  roi: number;
  endingBalance: number;
  lowestBalance: number;
  maxBalance: number;
  maxDrawdown: number;
  hitRate: number;
  longestLossStreak: number;
  longestWinStreak: number;
  avgChangePerSpin: number;
  avgStake: number;
  totalStaked: number;
  bustSpin: number | null;
  stdDev: number;
}

export interface MonteCarloSummary {
  runs: number;
  iterations: number;
  ruinRate: number;
  avgRuinSpin: number | null;
  medianRuinSpin: number | null;
  medianEnding: number;
  avgEnding: number;
  worstEnding: number;
  bestEnding: number;
  profitableRate: number;
  expectedEdgePerSpin: number;
  ruinHistogram: { labels: number[]; counts: number[] };
}

export const BET_OPTIONS: { value: BetKind; label: string; payout: number; coverage: number; help: string }[] = [
  { value: "red",    label: "Red",      payout: 1, coverage: 18/37, help: "1:1. Wins on any red number; loses on black or 0." },
  { value: "black",  label: "Black",    payout: 1, coverage: 18/37, help: "1:1. Wins on any black number; loses on red or 0." },
  { value: "even",   label: "Even",     payout: 1, coverage: 18/37, help: "1:1. Wins on 2,4,6...36. Zero is NOT even." },
  { value: "odd",    label: "Odd",      payout: 1, coverage: 18/37, help: "1:1. Wins on 1,3,5...35." },
  { value: "low",    label: "1-18",     payout: 1, coverage: 18/37, help: "1:1. Wins on numbers 1 through 18." },
  { value: "high",   label: "19-36",    payout: 1, coverage: 18/37, help: "1:1. Wins on numbers 19 through 36." },
  { value: "dozen1", label: "1st dozen (1-12)",  payout: 2, coverage: 12/37, help: "2:1. Wins on 1-12." },
  { value: "dozen2", label: "2nd dozen (13-24)", payout: 2, coverage: 12/37, help: "2:1. Wins on 13-24." },
  { value: "dozen3", label: "3rd dozen (25-36)", payout: 2, coverage: 12/37, help: "2:1. Wins on 25-36." },
  { value: "column1",label: "Column 1", payout: 2, coverage: 12/37, help: "2:1. Wins on 1,4,7...34 (left column)." },
  { value: "column2",label: "Column 2", payout: 2, coverage: 12/37, help: "2:1. Wins on 2,5,8...35 (middle column)." },
  { value: "column3",label: "Column 3", payout: 2, coverage: 12/37, help: "2:1. Wins on 3,6,9...36 (right column)." },
  { value: "straight",label: "Straight number", payout: 35, coverage: 1/37, help: "35:1. Pick a single number 0-36. Highest payout, lowest hit rate." },
];

export const PROGRESSIONS: { value: Progression; label: string; help: string }[] = [
  { value: "flat", label: "Flat (no progression)",
    help: "Bet the SAME amount every spin. No progression. The honest baseline — pure house edge, no variance amplification." },
  { value: "martingale", label: "Martingale",
    help: "DOUBLE the stake after every loss. One win recovers all prior losses + 1 base unit. Catastrophic on long losing runs or once you hit the table max." },
  { value: "reverse-martingale", label: "Reverse Martingale (Paroli)",
    help: "DOUBLE after every WIN, reset on a loss. Rides hot streaks with small downside. Still a losing system long-term — house edge unchanged." },
  { value: "dalembert", label: "D'Alembert",
    help: "Add 1 unit after a loss, subtract 1 after a win. Slow, gentle progression. Feels safer than Martingale; same negative expectation." },
  { value: "fibonacci", label: "Fibonacci",
    help: "Stake follows Fibonacci (1,1,2,3,5,8,13...): +1 step on loss, -2 steps on win. Slower escalation than Martingale, same fate." },
  { value: "oscars", label: "Oscar's Grind",
    help: "Aim for +1 unit profit per series. Increase stake by 1 only after wins until target hit, then reset. Tight control; still negative EV." },
  { value: "labouchere", label: "Labouchère (cancellation)",
    help: "Sequence like 1-2-3-4. Stake = first + last. Win → cross both off. Loss → append the loss size. Long losing streaks balloon the line." },
  { value: "manual", label: "Manual (casino-style table)",
    help: "Place chips on the table yourself for every spin. The same chip layout repeats each spin; clear and re-bet to change." },
];

// ---------- PRNG ----------
let _seed = (Math.random() * 2 ** 31) | 0;
export function reseed(seed?: number) { _seed = seed ?? ((Math.random() * 2 ** 31) | 0); }
function rand() {
  _seed = (_seed + 0x6D2B79F5) | 0;
  let t = _seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const spinNumber = () => Math.floor(rand() * 37);

// ---------- bet evaluation ----------
export function getNumberColor(n: number): "red" | "black" | "green" {
  if (n === 0) return "green";
  return REDS.has(n) ? "red" : "black";
}
export function getPayout(kind: BetKind): number {
  if (kind === "straight") return 35;
  if (kind.startsWith("dozen") || kind.startsWith("column")) return 2;
  return 1;
}
export function isWinningBet(n: number, kind: BetKind, straight: number): boolean {
  if (n === 0) return kind === "straight" && straight === 0;
  switch (kind) {
    case "red": return REDS.has(n);
    case "black": return !REDS.has(n);
    case "even": return n % 2 === 0;
    case "odd": return n % 2 === 1;
    case "low": return n >= 1 && n <= 18;
    case "high": return n >= 19 && n <= 36;
    case "dozen1": return n >= 1 && n <= 12;
    case "dozen2": return n >= 13 && n <= 24;
    case "dozen3": return n >= 25 && n <= 36;
    case "column1": return n % 3 === 1;
    case "column2": return n % 3 === 2;
    case "column3": return n % 3 === 0;
    case "straight": return n === straight;
  }
}
export function evalBet(b: Bet, n: number): { won: boolean; profit: number } {
  const won = isWinningBet(n, b.kind, b.number ?? 0);
  return { won, profit: won ? b.amount * getPayout(b.kind) : -b.amount };
}

// ---------- strategy state ----------
export function makeStrategyState(baseStake: number): StrategyState {
  return { stake: baseStake, fibIndex: 0, oscarsProfit: 0, labouchere: [1, 2, 3, 4] };
}
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];
function fib(i: number) { return FIB[Math.min(Math.max(i, 0), FIB.length - 1)]; }

export function getStake(s: StrategyState, p: Progression, base: number, balance: number, max: number): number {
  let want = base;
  if (p === "flat") want = base;
  else if (p === "martingale") want = s.stake;
  else if (p === "reverse-martingale") want = s.stake;
  else if (p === "dalembert") want = s.stake;
  else if (p === "fibonacci") want = base * fib(s.fibIndex);
  else if (p === "oscars") want = s.stake;
  else if (p === "labouchere") {
    const line = s.labouchere.length ? s.labouchere : [1, 2, 3, 4];
    want = base * (line.length === 1 ? line[0] : line[0] + line[line.length - 1]);
  }
  return Math.max(0, Math.min(Math.floor(want), Math.floor(balance), max));
}

export function updateStrategyState(
  s: StrategyState, p: Progression, base: number,
  won: boolean, profit: number, stake: number,
): StrategyState {
  const out: StrategyState = { stake: s.stake, fibIndex: s.fibIndex, oscarsProfit: s.oscarsProfit, labouchere: [...s.labouchere] };
  if (p === "flat") out.stake = base;
  else if (p === "martingale") out.stake = won ? base : Math.max(base, s.stake * 2);
  else if (p === "reverse-martingale") out.stake = won ? Math.max(base, s.stake * 2) : base;
  else if (p === "dalembert") out.stake = won ? Math.max(base, s.stake - base) : s.stake + base;
  else if (p === "fibonacci") out.fibIndex = won ? Math.max(0, s.fibIndex - 2) : s.fibIndex + 1;
  else if (p === "oscars") {
    const next = s.oscarsProfit + profit;
    if (next >= base) { out.oscarsProfit = 0; out.stake = base; }
    else { out.oscarsProfit = next; out.stake = won ? Math.min(s.stake + base, base - next + base) : s.stake; }
  } else if (p === "labouchere") {
    if (won) {
      out.labouchere = out.labouchere.length <= 2 ? [] : out.labouchere.slice(1, -1);
      if (out.labouchere.length === 0) out.labouchere = [1, 2, 3, 4];
    } else {
      out.labouchere.push(Math.max(1, Math.round(stake / base)));
      if (out.labouchere.length > 16) out.labouchere = out.labouchere.slice(-16);
    }
  }
  return out;
}

// ---------- single spin ----------
export interface SpinReturn { result: SpinResult | null; state: StrategyState; balance: number; }

export function spinOnce(balance: number, state: StrategyState, opts: SimOptions): SpinReturn {
  // manual: use manualBets (any combination) — total stake is the sum
  if (opts.progression === "manual" && opts.manualBets && opts.manualBets.length > 0) {
    const totalStake = opts.manualBets.reduce((s, b) => s + b.amount, 0);
    if (totalStake > balance || totalStake <= 0) return { result: null, state, balance };
    const n = spinNumber();
    let profit = 0;
    for (const b of opts.manualBets) profit += evalBet(b, n).profit;
    const won = profit > 0;
    const newBalance = balance + profit;
    return {
      result: { number: n, won, stake: totalStake, profit, payout: 0, balance: newBalance, bets: opts.manualBets.map(b => ({ ...b })) },
      state, balance: newBalance,
    };
  }
  // strategy: single bet on opts.betKind
  const stake = getStake(state, opts.progression, opts.baseStake, balance, opts.tableMax);
  if (stake <= 0) return { result: null, state, balance };
  const n = spinNumber();
  const bet: Bet = { kind: opts.betKind, amount: stake, number: opts.betKind === "straight" ? opts.straightNumber : undefined };
  const { won, profit } = evalBet(bet, n);
  const newBalance = balance + profit;
  const newState = updateStrategyState(state, opts.progression, opts.baseStake, won, profit, stake);
  return {
    result: { number: n, won, stake, profit, payout: getPayout(opts.betKind), balance: newBalance, bets: [bet] },
    state: newState, balance: newBalance,
  };
}

// ---------- summary ----------
export function calculateSummary(history: number[], results: SpinResult[], starting: number): Summary {
  let peak = starting, maxDD = 0, low = starting, high = starting;
  let bust: number | null = null;
  history.forEach((v, i) => {
    if (v > peak) peak = v;
    if (peak - v > maxDD) maxDD = peak - v;
    if (v < low) low = v;
    if (v > high) high = v;
    if (v <= 0 && bust === null && i > 0) bust = i;
  });
  let lossStreak = 0, winStreak = 0, maxLoss = 0, maxWin = 0;
  let wins = 0, totalStaked = 0, sumDelta = 0, sumDelta2 = 0;
  for (const r of results) {
    if (r.won) { wins++; winStreak++; lossStreak = 0; if (winStreak > maxWin) maxWin = winStreak; }
    else { lossStreak++; winStreak = 0; if (lossStreak > maxLoss) maxLoss = lossStreak; }
    totalStaked += r.stake;
    sumDelta += r.profit;
    sumDelta2 += r.profit * r.profit;
  }
  const ending = history[history.length - 1] ?? starting;
  const profit = ending - starting;
  const n = results.length;
  const mean = n ? sumDelta / n : 0;
  const variance = n ? sumDelta2 / n - mean * mean : 0;
  return {
    spins: n,
    profit,
    roi: starting ? (profit / starting) * 100 : 0,
    endingBalance: ending,
    lowestBalance: low,
    maxBalance: high,
    maxDrawdown: maxDD,
    hitRate: n ? (wins / n) * 100 : 0,
    longestLossStreak: maxLoss,
    longestWinStreak: maxWin,
    avgChangePerSpin: n ? profit / n : 0,
    avgStake: n ? totalStaked / n : 0,
    totalStaked,
    bustSpin: bust,
    stdDev: Math.sqrt(Math.max(0, variance)),
  };
}

// ---------- monte carlo ----------
export async function runMonteCarlo(
  runs: number,
  iterations: number,
  starting: number,
  opts: SimOptions,
  onProgress?: (p: number) => void,
): Promise<MonteCarloSummary> {
  const endings: number[] = [];
  const ruinSpins: number[] = [];
  let profitable = 0;
  const batch = 25;
  for (let r = 0; r < runs; r++) {
    let bal = starting;
    let st = makeStrategyState(opts.baseStake);
    let ruin: number | null = null;
    for (let i = 1; i <= iterations; i++) {
      const next = spinOnce(bal, st, opts);
      if (!next.result) { ruin = i; break; }
      st = next.state; bal = next.balance;
      if (bal <= 0) { ruin = i; bal = 0; break; }
    }
    endings.push(bal);
    if (bal > starting) profitable++;
    if (ruin !== null) ruinSpins.push(ruin);
    if (r % batch === 0 && onProgress) {
      onProgress(r / runs);
      await new Promise(rs => setTimeout(rs, 0));
    }
  }
  endings.sort((a, b) => a - b);
  const sum = endings.reduce((a, b) => a + b, 0);
  const avgEnding = sum / endings.length;
  const median = endings[Math.floor(endings.length / 2)];
  const avgRuin = ruinSpins.length ? ruinSpins.reduce((a, b) => a + b, 0) / ruinSpins.length : null;
  const sortedRuin = [...ruinSpins].sort((a, b) => a - b);
  const medRuin = sortedRuin.length ? sortedRuin[Math.floor(sortedRuin.length / 2)] : null;
  const expEdge = (avgEnding - starting) / iterations;
  return {
    runs, iterations,
    ruinRate: (ruinSpins.length / runs) * 100,
    avgRuinSpin: avgRuin,
    medianRuinSpin: medRuin,
    medianEnding: median,
    avgEnding,
    worstEnding: endings[0],
    bestEnding: endings[endings.length - 1],
    profitableRate: (profitable / runs) * 100,
    expectedEdgePerSpin: expEdge,
    ruinHistogram: histogram(ruinSpins, 18),
  };
}

function histogram(arr: number[], bins: number): { labels: number[]; counts: number[] } {
  if (!arr.length) return { labels: [], counts: [] };
  const min = Math.min(...arr), max = Math.max(...arr);
  const w = Math.max(1, (max - min) / bins);
  const counts = new Array(bins).fill(0);
  for (const v of arr) counts[Math.min(bins - 1, Math.floor((v - min) / w))]++;
  return { labels: counts.map((_, i) => Math.round(min + i * w)), counts };
}

// ---------- formatters ----------
export function fmtMoney(v: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD",
    minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}
export function fmtPct(v: number) { return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`; }
