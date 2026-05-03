import React from "react";
import {
  Activity, BarChart3, CircleDollarSign, Gauge, LineChart,
  Pause, Play, RotateCcw, Sparkles, Zap, ChevronRight,
} from "lucide-react";
import {
  BET_OPTIONS, PROGRESSIONS, SPEEDS,
  fmtMoney, fmtPct, getNumberColor, calculateSummary, makeStrategyState,
  spinOnce, runMonteCarlo, getPayout,
  type Bet, type BetKind, type Progression, type ChartMode,
  type SpinResult, type SimOptions, type StrategyState, type MonteCarloSummary,
} from "./engine";
import { RouletteWheel } from "./Wheel";
import { BankrollChart, HistogramChart } from "./Chart";
import { CasinoTable } from "./CasinoTable";

const BANKROLL_PRESETS = [100, 500, 1000, 5000, 10000];

// Tooltip "!" component
function Help({ children }: { children: React.ReactNode }) {
  return <i className="help" tabIndex={0}>!<span className="tip">{children}</span></i>;
}

export default function App() {
  const [startingBalance, setStartingBalance] = React.useState(1000);
  const [balance, setBalance] = React.useState(1000);

  const [progression, setProgression] = React.useState<Progression>("martingale");
  const [betKind, setBetKind] = React.useState<BetKind>("red");
  const [baseStake, setBaseStake] = React.useState(10);
  const [straightNumber, setStraightNumber] = React.useState(17);
  const [tableMax, setTableMax] = React.useState(5000);
  const [targetSpins, setTargetSpins] = React.useState(500);
  const [speed, setSpeed] = React.useState<number>(8);
  const [stopOnBust, setStopOnBust] = React.useState(true);

  const [isRunning, setIsRunning] = React.useState(false);
  const [history, setHistory] = React.useState<number[]>([1000]);
  const [results, setResults] = React.useState<SpinResult[]>([]);
  const [lastResult, setLastResult] = React.useState<SpinResult | null>(null);
  const [strategyState, setStrategyState] = React.useState<StrategyState>(makeStrategyState(10));
  const [chartMode, setChartMode] = React.useState<ChartMode>("money");

  // manual mode
  const [manualBets, setManualBets] = React.useState<Bet[]>([]);
  const [chipSize, setChipSize] = React.useState(10);

  // monte carlo
  const [mcRuns, setMcRuns] = React.useState(500);
  const [mcIterations, setMcIterations] = React.useState(1000);
  const [mcProgress, setMcProgress] = React.useState(0);
  const [mcRunning, setMcRunning] = React.useState(false);
  const [monteCarlo, setMonteCarlo] = React.useState<MonteCarloSummary | null>(null);

  const [flashKey, setFlashKey] = React.useState(0);

  const options: SimOptions = React.useMemo(
    () => ({ baseStake, progression, betKind, straightNumber, tableMax, manualBets }),
    [baseStake, progression, betKind, straightNumber, tableMax, manualBets],
  );
  const summary = React.useMemo(
    () => calculateSummary(history, results, startingBalance),
    [history, results, startingBalance],
  );
  const expectedEdge = React.useMemo(() => {
    // For configured single bet: P(win)*payout - P(lose)*1 (per unit staked)
    if (progression === "manual") return -1 / 37; // approx for any european bet
    const opt = BET_OPTIONS.find(b => b.value === betKind)!;
    return opt.coverage * opt.payout - (1 - opt.coverage);
  }, [betKind, progression]);

  const reset = React.useCallback(() => {
    setIsRunning(false);
    setBalance(startingBalance);
    setHistory([startingBalance]);
    setResults([]);
    setLastResult(null);
    setStrategyState(makeStrategyState(baseStake));
    setMonteCarlo(null);
    setMcProgress(0);
  }, [baseStake, startingBalance]);

  const updateStarting = (v: number) => {
    const value = Math.max(1, Math.floor(v));
    setStartingBalance(value);
    setBalance(value);
    setHistory([value]);
    setResults([]);
    setLastResult(null);
    setStrategyState(makeStrategyState(baseStake));
  };

  const runBatch = React.useCallback((count: number) => {
    let bal = balance;
    let st = strategyState;
    const histAdd: number[] = [];
    const resAdd: SpinResult[] = [];
    let last: SpinResult | null = null;
    for (let i = 0; i < count; i++) {
      if (results.length + resAdd.length >= targetSpins) break;
      if (stopOnBust && bal <= 0) break;
      const next = spinOnce(bal, st, options);
      if (!next.result) break;
      st = next.state; bal = next.balance;
      histAdd.push(bal);
      resAdd.push(next.result);
      last = next.result;
    }
    if (!resAdd.length) { setIsRunning(false); return false; }
    setBalance(bal);
    setStrategyState(st);
    setHistory(prev => [...prev, ...histAdd]);
    setResults(prev => [...prev, ...resAdd]);
    setLastResult(last);
    setFlashKey(k => k + 1);
    if (results.length + resAdd.length >= targetSpins || (stopOnBust && bal <= 0)) {
      setIsRunning(false);
      return false;
    }
    return true;
  }, [balance, strategyState, results.length, targetSpins, options, stopOnBust]);

  // animation loop driven by speed (spins per second roughly)
  React.useEffect(() => {
    if (!isRunning) return;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const step = (t: number) => {
      const dt = t - last; last = t;
      // base cadence: 1.4s per spin at 1x, scaled by speed
      acc += (dt / 1400) * speed;
      const n = Math.min(2000, Math.floor(acc));
      if (n > 0) { acc -= n; if (!runBatch(n)) return; }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [isRunning, speed, runBatch]);

  const quickRun = (n: number) => runBatch(n);

  const computeMC = async () => {
    setMcRunning(true);
    setMcProgress(0);
    const res = await runMonteCarlo(mcRuns, mcIterations, startingBalance, options, p => setMcProgress(p));
    setMonteCarlo(res);
    setMcProgress(1);
    setMcRunning(false);
  };

  const placeBet = (b: Bet) => setManualBets(prev => [...prev, b]);
  const clearBets = () => setManualBets([]);

  const balanceTone = balance >= startingBalance ? "positive" : "negative";
  const lastNumbers = results.slice(-18).reverse();

  return (
    <main>
      <section className="hero">
        <div>
          <span className="eyebrow"><Sparkles size={14} /> European single-zero · 37 pockets</span>
          <h1>Roulette Reality Check</h1>
        </div>
        <div className={`bankroll-panel ${balanceTone}`}>
          <span className="label">Total money</span>
          <strong className="amount">{fmtMoney(balance)}</strong>
          <span className="delta">
            {balance >= startingBalance ? "+" : ""}{fmtMoney(balance - startingBalance)} · {fmtPct(summary.roi)} vs baseline
          </span>
        </div>
      </section>

      <section className="workspace">
        {/* LEFT: controls */}
        <aside className="controls">
          <div className="panel">
            <div className="section-title"><CircleDollarSign size={14} /> Bankroll setup</div>
            <label className="field">
              <span className="label-row">Starting cash <Help>The money you sit down with. Reset is automatic when you change this.</Help></span>
              <input type="number" min={1} value={startingBalance} onChange={e => updateStarting(Number(e.target.value))} />
              <div className="chip-row">
                {BANKROLL_PRESETS.map(v => (
                  <button key={v} className={startingBalance === v ? "active" : ""} onClick={() => updateStarting(v)}>
                    ${v.toLocaleString()}
                  </button>
                ))}
              </div>
            </label>
            <label className="field" style={{ marginTop: 10 }}>
              <span className="label-row">Base stake <Help>The unit chip size used by every progression (Martingale, Fibonacci, etc.). Manual mode ignores this — use the chip selector on the table instead.</Help></span>
              <input type="number" min={1} value={baseStake}
                onChange={e => { const v = Math.max(1, Number(e.target.value)); setBaseStake(v); setStrategyState(makeStrategyState(v)); }} />
            </label>
            <label className="field" style={{ marginTop: 10 }}>
              <span className="label-row">Table maximum <Help>Casino-imposed cap on a single bet. Critical for Martingale-style systems — once you hit it, you can't double anymore and the system breaks.</Help></span>
              <input type="number" min={1} value={tableMax} onChange={e => setTableMax(Math.max(1, Number(e.target.value)))} />
            </label>
            <label className="field" style={{ marginTop: 10 }}>
              <span className="label-row">Repetitions (target spins) <Help>How many spins to play before auto-stopping. The strategy runs until either this many spins, the bankroll busts (if "stop on bust" is on), or you hit Pause.</Help></span>
              <input type="number" min={1} value={targetSpins} onChange={e => setTargetSpins(Math.max(1, Number(e.target.value)))} />
            </label>
            <label className="field" style={{ marginTop: 10, flexDirection: "row", alignItems: "center", gap: 8, display: "flex" }}>
              <input type="checkbox" checked={stopOnBust} onChange={e => setStopOnBust(e.target.checked)} style={{ width: "auto", minHeight: 0 }} />
              <span className="label-row" style={{ fontSize: 12 }}>Stop on bust <Help>If on, the simulation stops when the bankroll cannot cover the next stake. If off, the run continues but no further bets are placed.</Help></span>
            </label>
          </div>

          <div className="panel">
            <div className="section-title"><Zap size={14} /> Strategy</div>
            <label className="field">
              <span className="label-row">Progression <Help>How the stake size changes from spin to spin. "Flat" = same every time. "Manual" lets you place chips on the casino table for each spin. Combined with Bet target below, this fully describes the strategy.</Help></span>
              <select value={progression} onChange={e => { setProgression(e.target.value as Progression); setStrategyState(makeStrategyState(baseStake)); }}>
                {PROGRESSIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </label>
            <div className="strategy-note" style={{ marginTop: 8 }}>
              <strong>How {PROGRESSIONS.find(p => p.value === progression)!.label} works</strong>
              {PROGRESSIONS.find(p => p.value === progression)!.help}
            </div>

            {progression !== "manual" && (
              <>
                <label className="field" style={{ marginTop: 10 }}>
                  <span className="label-row">Bet target <Help>What the progression bets on each spin. Even-money bets (red, black, odd, even, 1-18, 19-36) have the highest hit rate; straight numbers pay 35:1 but hit only 1/37.</Help></span>
                  <select value={betKind} onChange={e => setBetKind(e.target.value as BetKind)}>
                    {BET_OPTIONS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                  </select>
                </label>
                <div className="strategy-note" style={{ marginTop: 8 }}>
                  <strong>{BET_OPTIONS.find(b => b.value === betKind)!.label} · {getPayout(betKind)}:1</strong>
                  {BET_OPTIONS.find(b => b.value === betKind)!.help}
                  <em>Coverage: {(BET_OPTIONS.find(b => b.value === betKind)!.coverage * 100).toFixed(2)}% of pockets · House edge: −2.70%</em>
                </div>
                {betKind === "straight" && (
                  <label className="field" style={{ marginTop: 8 }}>
                    <span className="label-row">Number 0-36 <Help>Pick which single number to bet on. All 37 numbers are equivalent — the wheel doesn't have memory.</Help></span>
                    <input type="number" min={0} max={36} value={straightNumber}
                      onChange={e => setStraightNumber(Math.max(0, Math.min(36, Number(e.target.value))))} />
                  </label>
                )}
              </>
            )}

            <div className="edge-box" style={{ marginTop: 12 }}>
              <span className="label-line">Expected edge per base bet</span>
              <strong>{fmtMoney(baseStake * expectedEdge)}</strong>
              <em>Every European bet averages a −2.70% return per unit staked, regardless of progression.</em>
            </div>
          </div>
        </aside>

        {/* RIGHT: simulator */}
        <section className="sim-column">
          <div className="panel">
            <div className="sim-topline">
              <div>
                <span className="eyebrow"><Gauge size={14} /> Spin engine</span>
                <h2>{results.length.toLocaleString()} / {targetSpins.toLocaleString()} spins</h2>
                <span className="progress-mini">
                  {summary.bustSpin ? `Busted at spin ${summary.bustSpin}` : isRunning ? "running…" : "paused"}
                </span>
              </div>
              <div className="action-row">
                <button className="btn primary" onClick={() => setIsRunning(v => !v)} title={isRunning ? "Pause" : "Run continuously"}>
                  {isRunning ? <><Pause size={16} /> Pause</> : <><Play size={16} /> Run</>}
                </button>
                <button className="btn" onClick={() => quickRun(1)} disabled={isRunning} title="Single spin">
                  <ChevronRight size={16} /> Spin
                </button>
                <button className="btn icon" onClick={reset} title="Reset bankroll & history"><RotateCcw size={16} /></button>
              </div>
            </div>

            <div className="wheel-shell">
              <RouletteWheel result={lastResult} spinning={isRunning} />
              <div className="wheel-info">
                <div className="last-result">
                  <span
                    key={flashKey}
                    className={`result-chip ${lastResult ? getNumberColor(lastResult.number) : ""} ${lastResult ? "flash" : ""}`}
                  >
                    {lastResult ? lastResult.number : "–"}
                  </span>
                  <div>
                    <strong>{lastResult ? (lastResult.won ? "Win" : "Loss") : "Ready"}</strong>
                    <span>
                      {lastResult
                        ? `${lastResult.profit >= 0 ? "+" : ""}${fmtMoney(lastResult.profit)} on ${fmtMoney(lastResult.stake)} stake`
                        : "European wheel · single zero"}
                    </span>
                  </div>
                </div>

                <div>
                  <div style={{ color: "var(--muted)", fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>
                    Last 18 outcomes
                  </div>
                  <div className="last-numbers">
                    {lastNumbers.length ? lastNumbers.map((r, i) => (
                      <div key={i} className={`ln ${getNumberColor(r.number)}`}>{r.number}</div>
                    )) : <span style={{ color: "var(--muted)", fontSize: 12 }}>No spins yet.</span>}
                  </div>
                </div>

                <div className="speed-row">
                  <span className="label">Speed</span>
                  <Help>Spins per second multiplier. 1× shows full wheel animation. Higher speeds skip animation and batch spins per frame for raw throughput.</Help>
                  <div className="speed-grid">
                    {SPEEDS.map(v => (
                      <button key={v} className={speed === v ? "active" : ""} onClick={() => setSpeed(v)}>{v}×</button>
                    ))}
                  </div>
                </div>

                <div className="action-row">
                  <span style={{ color: "var(--muted)", fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase" }}>Quick run</span>
                  <Help>Run a fixed batch of spins instantly without animation. Useful for fast-forwarding through a strategy.</Help>
                  {[10, 100, 1000, 5000].map(n => (
                    <button key={n} className="btn" onClick={() => quickRun(n)} disabled={isRunning}>+{n.toLocaleString()}</button>
                  ))}
                </div>
              </div>
            </div>

            {progression === "manual" && (
              <CasinoTable bets={manualBets} chipSize={chipSize} setChipSize={setChipSize} onPlace={placeBet} onClear={clearBets} />
            )}
          </div>

          <div className="panel">
            <div className="chart-header">
              <div>
                <span className="eyebrow"><LineChart size={14} /> Bankroll evolution</span>
                <h2>Money over iterations</h2>
              </div>
              <div className="mode-tabs">
                {([
                  ["money", "Raw $"],
                  ["profit", "Profit"],
                  ["percent", "% of start"],
                  ["drawdown", "Drawdown"],
                  ["stake", "Stake size"],
                ] as [ChartMode, string][]).map(([v, l]) => (
                  <button key={v} className={chartMode === v ? "active" : ""} onClick={() => setChartMode(v)}>{l}</button>
                ))}
              </div>
            </div>
            <BankrollChart history={history} results={results} mode={chartMode} startingBalance={startingBalance} />

            <div className="summary-grid">
              <Metric label="Ending bankroll" value={fmtMoney(summary.endingBalance)} tone={summary.profit >= 0 ? "good" : "bad"} />
              <Metric label="Profit / loss" value={fmtMoney(summary.profit)} tone={summary.profit >= 0 ? "good" : "bad"} />
              <Metric label="ROI" value={fmtPct(summary.roi)} tone={summary.roi >= 0 ? "good" : "bad"} />
              <Metric label="Max drawdown" value={fmtMoney(summary.maxDrawdown)} tone="bad" />
              <Metric label="Lowest balance" value={fmtMoney(summary.lowestBalance)} tone={summary.lowestBalance > 0 ? undefined : "bad"} />
              <Metric label="Peak balance" value={fmtMoney(summary.maxBalance)} tone="good" />
              <Metric label="Hit rate" value={`${summary.hitRate.toFixed(1)}%`} sub={`${summary.spins} spins`} />
              <Metric label="Avg / spin" value={fmtMoney(summary.avgChangePerSpin)} tone={summary.avgChangePerSpin >= 0 ? "good" : "bad"} />
              <Metric label="Avg stake" value={fmtMoney(summary.avgStake)} sub={`total staked ${fmtMoney(summary.totalStaked)}`} />
              <Metric label="Longest streaks" value={`${summary.longestWinStreak}W / ${summary.longestLossStreak}L`} />
              <Metric label="Std dev / spin" value={fmtMoney(summary.stdDev)} />
              <Metric label="Ruin spin" value={summary.bustSpin ? `#${summary.bustSpin.toLocaleString()}` : "—"} tone={summary.bustSpin ? "bad" : "good"} />
            </div>
          </div>

          <div className="panel">
            <div className="chart-header">
              <div>
                <span className="eyebrow"><BarChart3 size={14} /> Monte Carlo · multi-run analysis</span>
                <h2>Average ruin & ending outcomes</h2>
              </div>
              <div className="action-row">
                <label className="field" style={{ width: 110 }}>
                  <span className="label-row" style={{ fontSize: 11 }}>Runs <Help>Number of independent simulations to play. Higher = more reliable averages, slower compute.</Help></span>
                  <input type="number" min={10} max={20000} value={mcRuns} onChange={e => setMcRuns(Math.max(10, Number(e.target.value)))} />
                </label>
                <label className="field" style={{ width: 130 }}>
                  <span className="label-row" style={{ fontSize: 11 }}>Spins / run <Help>How long each simulated session lasts. If the bankroll busts before this many spins, the run ends early and is counted as ruin.</Help></span>
                  <input type="number" min={10} max={50000} value={mcIterations} onChange={e => setMcIterations(Math.max(10, Number(e.target.value)))} />
                </label>
                <button className="btn primary" onClick={computeMC} disabled={mcRunning}>
                  <Activity size={14} /> {mcRunning ? "Running…" : "Run analysis"}
                </button>
              </div>
            </div>
            {mcRunning || mcProgress > 0 ? (
              <div className="mc-progress"><div style={{ width: `${mcProgress * 100}%` }} /></div>
            ) : null}

            <div className="analytics-grid">
              <HistogramChart data={monteCarlo?.ruinHistogram ?? { labels: [], counts: [] }} />
              <div>
                {monteCarlo ? (
                  <div className="summary-grid" style={{ marginTop: 0 }}>
                    <Metric label="Ruin probability" value={`${monteCarlo.ruinRate.toFixed(1)}%`} tone="bad" />
                    <Metric label="Avg spins to ruin" value={monteCarlo.avgRuinSpin ? monteCarlo.avgRuinSpin.toFixed(0) : "—"} sub={`median ${monteCarlo.medianRuinSpin ?? "—"}`} />
                    <Metric label="Profitable runs" value={`${monteCarlo.profitableRate.toFixed(1)}%`} tone={monteCarlo.profitableRate >= 50 ? "good" : "bad"} />
                    <Metric label="Avg final" value={fmtMoney(monteCarlo.avgEnding)} tone={monteCarlo.avgEnding >= startingBalance ? "good" : "bad"} />
                    <Metric label="Median final" value={fmtMoney(monteCarlo.medianEnding)} />
                    <Metric label="Best / worst" value={`${fmtMoney(monteCarlo.bestEnding)} / ${fmtMoney(monteCarlo.worstEnding)}`} />
                    <Metric label="Edge / spin" value={fmtMoney(monteCarlo.expectedEdgePerSpin)} tone={monteCarlo.expectedEdgePerSpin >= 0 ? "good" : "bad"} sub="house edge ≈ −2.70%" />
                    <Metric label="Trials × spins" value={`${monteCarlo.runs.toLocaleString()} × ${monteCarlo.iterations.toLocaleString()}`} />
                  </div>
                ) : (
                  <p className="empty-state">
                    Run a Monte Carlo to estimate how often this exact setup reaches ruin and where the bankroll
                    typically finishes after many independent sessions. The histogram on the left shows the
                    distribution of "spins until ruin" across all losing runs.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="footer-note">
            <strong>Why this exists.</strong> European roulette has a flat house edge of 1/37 ≈ 2.70% on every standard bet.
            Doubling-up systems (Martingale, Fibonacci) trade many tiny wins for rare catastrophic losses; gentle
            systems (D'Alembert, Oscar's Grind) trade fast ruin for slow erosion. The math doesn't change. This
            simulator lets you watch any chosen system play out, with exact payouts and table caps.
          </div>
        </section>
      </section>
    </main>
  );
}

function Metric({ label, value, tone, sub }: { label: string; value: string; tone?: "good" | "bad"; sub?: string }) {
  return (
    <div className={`metric ${tone ?? ""}`}>
      <div className="m-label">{label}</div>
      <div className="m-value">{value}</div>
      {sub ? <div className="m-sub">{sub}</div> : null}
    </div>
  );
}
