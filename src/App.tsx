import React from "react";
import { createPortal } from "react-dom";
import {
  Activity, BarChart3, CircleDollarSign, Gauge, LineChart,
  Pause, Play, RotateCcw, Sparkles, Zap, ChevronRight,
} from "lucide-react";
import {
  BET_OPTIONS, PROGRESSIONS, SPEEDS,
  fmtMoney, fmtPct, getNumberColor, calculateSummary, makeStrategyState,
  spinOnce, runMonteCarlo, getPayout, coverageOf, expectedEdgeOf,
  houseEdge, pocketLabel,
  type Bet, type BetKind, type Progression, type ChartMode,
  type SpinResult, type SimOptions, type StrategyState,
  type MonteCarloSummary, type WheelType,
} from "./engine";
import { RouletteWheel } from "./Wheel";
import { BankrollChart, HistogramChart, SurvivalChart, FanChart } from "./Chart";
import { CasinoTable } from "./CasinoTable";

const BANKROLL_PRESETS = [100, 500, 1000, 5000, 10000];

function Help({ children }: { children: React.ReactNode }) {
  const ref = React.useRef<HTMLElement | null>(null);
  const [tip, setTip] = React.useState<{ left: number; top: number; place: "top" | "bottom" } | null>(null);

  const show = React.useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = Math.min(280, window.innerWidth - 24);
    const left = Math.max(12, Math.min(window.innerWidth - width - 12, rect.left + rect.width / 2 - width / 2));
    const place = rect.top < 130 ? "bottom" : "top";
    const top = place === "bottom" ? rect.bottom + 10 : rect.top - 10;
    setTip({ left, top, place });
  }, []);

  React.useEffect(() => {
    if (!tip) return undefined;
    const hide = () => setTip(null);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, [tip]);

  return (
    <>
      <i
        ref={ref}
        className="help"
        tabIndex={0}
        onMouseEnter={show}
        onMouseLeave={() => setTip(null)}
        onFocus={show}
        onBlur={() => setTip(null)}
      >
        !
      </i>
      {tip && createPortal(
        <div
          className={`floating-tip ${tip.place}`}
          style={{ left: tip.left, top: tip.top, width: "min(280px, calc(100vw - 24px))" }}
        >
          {children}
        </div>,
        document.body,
      )}
    </>
  );
}

export default function App() {
  const [startingBalance, setStartingBalance] = React.useState(1000);
  const [balance, setBalance] = React.useState(1000);

  const [wheelType, setWheelType] = React.useState<WheelType>("european");
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

  const [manualBets, setManualBets] = React.useState<Bet[]>([]);
  const [chipSize, setChipSize] = React.useState(10);

  const [mcRuns, setMcRuns] = React.useState(500);
  const [mcIterations, setMcIterations] = React.useState(1000);
  const [mcProgress, setMcProgress] = React.useState(0);
  const [mcRunning, setMcRunning] = React.useState(false);
  const [monteCarlo, setMonteCarlo] = React.useState<MonteCarloSummary | null>(null);
  type McChartMode = "ruin" | "survival" | "final" | "fan";
  const [mcChartMode, setMcChartMode] = React.useState<McChartMode>("ruin");

  const [flashKey, setFlashKey] = React.useState(0);

  const options: SimOptions = React.useMemo(
    () => ({ baseStake, progression, betKind, straightNumber, tableMax, manualBets, wheelType }),
    [baseStake, progression, betKind, straightNumber, tableMax, manualBets, wheelType],
  );
  const summary = React.useMemo(
    () => calculateSummary(history, results, startingBalance),
    [history, results, startingBalance],
  );
  const expectedEdge = React.useMemo(() => {
    if (progression === "manual") return houseEdge(wheelType);
    return expectedEdgeOf(betKind, wheelType);
  }, [betKind, progression, wheelType]);
  const expectedStake = React.useMemo(
    () => progression === "manual" ? manualBets.reduce((s, b) => s + b.amount, 0) : baseStake,
    [baseStake, manualBets, progression],
  );
  const wheelCopy = wheelType === "american"
    ? { name: "American double-zero", pockets: "38 pockets", edge: "5.26%" }
    : { name: "European single-zero", pockets: "37 pockets", edge: "2.70%" };

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

  const changeWheel = (next: WheelType) => {
    if (next === wheelType) return;
    setIsRunning(false);
    setWheelType(next);
    setMonteCarlo(null);
    setMcProgress(0);
    setLastResult(null);
    if (next === "european" && straightNumber === 37) setStraightNumber(0);
    if (next === "european") {
      setManualBets(prev => prev.filter(b => b.kind !== "straight" || b.number !== 37));
    }
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

  React.useEffect(() => {
    if (!isRunning) return;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const step = (t: number) => {
      const dt = t - last; last = t;
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
          <div className="wheel-toggle" aria-label="Wheel type">
            <button className={wheelType === "european" ? "active" : ""} onClick={() => changeWheel("european")}>European</button>
            <button className={wheelType === "american" ? "active" : ""} onClick={() => changeWheel("american")}>American</button>
          </div>
          <span className="eyebrow"><Sparkles size={14} /> {wheelCopy.name} - {wheelCopy.pockets}</span>
          <h1>Roulette Reality Check</h1>
        </div>
        <div className={`bankroll-panel ${balanceTone}`}>
          <span className="label">Total money</span>
          <strong className="amount">{fmtMoney(balance)}</strong>
          <span className="delta">
            {balance >= startingBalance ? "+" : ""}{fmtMoney(balance - startingBalance)} - {fmtPct(summary.roi)} vs baseline
          </span>
        </div>
      </section>

      <section className="workspace">
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
              <span className="label-row">Base stake <Help>The unit chip size used by every progression. Manual mode ignores this; use the chip selector on the table instead.</Help></span>
              <input type="number" min={1} value={baseStake}
                onChange={e => { const v = Math.max(1, Number(e.target.value)); setBaseStake(v); setStrategyState(makeStrategyState(v)); }} />
            </label>
            <label className="field" style={{ marginTop: 10 }}>
              <span className="label-row">Table maximum <Help>Casino-imposed cap on a single bet. Critical for Martingale-style systems: once capped, a win may not recover prior losses.</Help></span>
              <input type="number" min={1} value={tableMax} onChange={e => setTableMax(Math.max(1, Number(e.target.value)))} />
            </label>
            <label className="field" style={{ marginTop: 10 }}>
              <span className="label-row">Repetitions (target spins) <Help>How many spins to play before auto-stopping.</Help></span>
              <input type="number" min={1} value={targetSpins} onChange={e => setTargetSpins(Math.max(1, Number(e.target.value)))} />
            </label>
            <label className="field" style={{ marginTop: 10, flexDirection: "row", alignItems: "center", gap: 8, display: "flex" }}>
              <input type="checkbox" checked={stopOnBust} onChange={e => setStopOnBust(e.target.checked)} style={{ width: "auto", minHeight: 0 }} />
              <span className="label-row" style={{ fontSize: 12 }}>Stop on bust <Help>If on, the simulation stops when the bankroll cannot cover the next stake. If off, the run continues until no bet can be placed.</Help></span>
            </label>
          </div>

          <div className="panel">
            <div className="section-title"><Zap size={14} /> Strategy</div>
            <label className="field">
              <span className="label-row">Progression <Help>How the stake size changes from spin to spin. Manual lets you place chips on the casino table for each spin.</Help></span>
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
                  <span className="label-row">Bet target <Help>What the progression bets on each spin. Straight numbers pay 35:1 but hit only one pocket.</Help></span>
                  <select value={betKind} onChange={e => setBetKind(e.target.value as BetKind)}>
                    {BET_OPTIONS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                  </select>
                </label>
                <div className="strategy-note" style={{ marginTop: 8 }}>
                  <strong>{BET_OPTIONS.find(b => b.value === betKind)!.label} - {getPayout(betKind)}:1</strong>
                  {BET_OPTIONS.find(b => b.value === betKind)!.help}
                  <em>Coverage: {(coverageOf(betKind, wheelType) * 100).toFixed(2)}% of pockets - House edge: -{wheelCopy.edge}</em>
                </div>
                {betKind === "straight" && (
                  <label className="field" style={{ marginTop: 8 }}>
                    <span className="label-row">Straight pocket <Help>Pick a single pocket. American mode adds 00 as a separate green pocket.</Help></span>
                    <select value={straightNumber} onChange={e => setStraightNumber(Number(e.target.value))}>
                      <option value={0}>0</option>
                      {wheelType === "american" && <option value={37}>00</option>}
                      {Array.from({ length: 36 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </label>
                )}
              </>
            )}

            <div className="edge-box" style={{ marginTop: 12 }}>
              <span className="label-line">{progression === "manual" ? "Expected loss on current layout" : "Expected loss per base bet"}</span>
              <strong>{fmtMoney(expectedStake * expectedEdge)}</strong>
              <em>Every {wheelCopy.name.toLowerCase()} standard bet averages -{wheelCopy.edge} per unit staked, regardless of progression.</em>
            </div>
          </div>
        </aside>

        <section className="sim-column">
          <div className="panel">
            <div className="sim-topline">
              <div>
                <span className="eyebrow"><Gauge size={14} /> Spin engine</span>
                <h2>{results.length.toLocaleString()} / {targetSpins.toLocaleString()} spins</h2>
                <span className="progress-mini">
                  {summary.bustSpin ? `Busted at spin ${summary.bustSpin}` : isRunning ? "running..." : "paused"}
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
              <RouletteWheel result={lastResult} spinning={isRunning} wheelType={wheelType} />
              <div className="wheel-info">
                <div className="last-result">
                  <span
                    key={flashKey}
                    className={`result-chip ${lastResult ? getNumberColor(lastResult.number) : ""} ${lastResult ? "flash" : ""}`}
                  >
                    {lastResult ? pocketLabel(lastResult.number) : "-"}
                  </span>
                  <div>
                    <strong>{lastResult ? (lastResult.won ? "Win" : "Loss") : "Ready"}</strong>
                    <span>
                      {lastResult
                        ? `${lastResult.profit >= 0 ? "+" : ""}${fmtMoney(lastResult.profit)} on ${fmtMoney(lastResult.stake)} stake`
                        : `${wheelCopy.name} - ${wheelCopy.pockets}`}
                    </span>
                  </div>
                </div>

                <div>
                  <div style={{ color: "var(--muted)", fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>
                    Last 18 outcomes
                  </div>
                  <div className="last-numbers">
                    {lastNumbers.length ? lastNumbers.map((r, i) => (
                      <div key={i} className={`ln ${getNumberColor(r.number)}`}>{pocketLabel(r.number)}</div>
                    )) : <span style={{ color: "var(--muted)", fontSize: 12 }}>No spins yet.</span>}
                  </div>
                </div>

                <div className="speed-row">
                  <span className="label">Speed</span>
                  <Help>Spins per second multiplier. Higher speeds batch spins per frame for throughput.</Help>
                  <div className="speed-grid">
                    {SPEEDS.map(v => (
                      <button key={v} className={speed === v ? "active" : ""} onClick={() => setSpeed(v)}>{v}x</button>
                    ))}
                  </div>
                </div>

                <div className="action-row">
                  <span style={{ color: "var(--muted)", fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase" }}>Quick run</span>
                  <Help>Run a fixed batch of spins instantly without animation.</Help>
                  {[10, 100, 1000, 5000, 10000].map(n => (
                    <button key={n} className="btn" onClick={() => quickRun(n)} disabled={isRunning}>+{n.toLocaleString()}</button>
                  ))}
                </div>
              </div>
            </div>

            {progression === "manual" && (
              <CasinoTable bets={manualBets} chipSize={chipSize} setChipSize={setChipSize} onPlace={placeBet} onClear={clearBets} wheelType={wheelType} />
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
              <Metric label="Ruin spin" value={summary.bustSpin ? `#${summary.bustSpin.toLocaleString()}` : "-"} tone={summary.bustSpin ? "bad" : "good"} />
            </div>
          </div>

          <div className="panel">
            <div className="chart-header">
              <div>
                <span className="eyebrow"><BarChart3 size={14} /> Monte Carlo - multi-run analysis</span>
                <h2>Average ruin & ending outcomes</h2>
              </div>
              <div className="action-row">
                <label className="field" style={{ width: 110 }}>
                  <span className="label-row" style={{ fontSize: 11 }}>Runs <Help>Number of independent simulations to play.</Help></span>
                  <input type="number" min={10} max={20000} value={mcRuns} onChange={e => setMcRuns(Math.max(10, Number(e.target.value)))} />
                </label>
                <label className="field" style={{ width: 130 }}>
                  <span className="label-row" style={{ fontSize: 11 }}>Spins / run <Help>How long each simulated session lasts. If the bankroll busts before this many spins, the run ends early and is counted as ruin.</Help></span>
                  <input type="number" min={10} max={50000} value={mcIterations} onChange={e => setMcIterations(Math.max(10, Number(e.target.value)))} />
                </label>
                <button className="btn primary" onClick={computeMC} disabled={mcRunning}>
                  <Activity size={14} /> {mcRunning ? "Running..." : "Run analysis"}
                </button>
              </div>
            </div>
            {mcRunning || mcProgress > 0 ? (
              <div className="mc-progress"><div style={{ width: `${mcProgress * 100}%` }} /></div>
            ) : null}

            <div className="mode-tabs" style={{ marginBottom: 10 }}>
              {([
                ["ruin", "Spins until ruin"],
                ["survival", "Survival curve"],
                ["final", "Final bankroll"],
                ["fan", "Bankroll fan"],
              ] as [McChartMode, string][]).map(([v, l]) => (
                <button key={v} className={mcChartMode === v ? "active" : ""} onClick={() => setMcChartMode(v)}>{l}</button>
              ))}
              <Help>
                <strong>Spins until ruin:</strong> histogram of how long busted runs lasted.
                <br /><strong>Survival curve:</strong> % of runs still solvent at each spin.
                <br /><strong>Final bankroll:</strong> distribution of where every run ended.
                <br /><strong>Bankroll fan:</strong> p10/p25/median/p75/p90 bands at each checkpoint.
              </Help>
            </div>

            <div className="analytics-grid">
              <div>
                {mcChartMode === "ruin" && (
                  <HistogramChart
                    data={monteCarlo?.ruinHistogram ?? { labels: [], counts: [] }}
                    xLabel="Spins until ruin"
                    yLabel="# of busted runs"
                  />
                )}
                {mcChartMode === "survival" && (
                  <SurvivalChart
                    spins={monteCarlo?.survival.spins ?? []}
                    alive={monteCarlo?.survival.alive ?? []}
                  />
                )}
                {mcChartMode === "final" && (
                  <HistogramChart
                    data={monteCarlo?.finalHistogram ?? { labels: [], counts: [] }}
                    color="#4cc9f0"
                    xLabel="Final bankroll ($)"
                    yLabel="# of runs"
                  />
                )}
                {mcChartMode === "fan" && monteCarlo && (
                  <FanChart
                    spins={monteCarlo.fan.spins}
                    p1={monteCarlo.fan.p1}
                    p10={monteCarlo.fan.p10}
                    p25={monteCarlo.fan.p25}
                    p50={monteCarlo.fan.p50}
                    p75={monteCarlo.fan.p75}
                    p90={monteCarlo.fan.p90}
                    p99={monteCarlo.fan.p99}
                    mean={monteCarlo.fan.mean}
                    startingBalance={monteCarlo.startingBalance}
                  />
                )}
                {mcChartMode === "fan" && !monteCarlo && (
                  <FanChart spins={[]} p1={[]} p10={[]} p25={[]} p50={[]} p75={[]} p90={[]} p99={[]} mean={[]} startingBalance={startingBalance} />
                )}
              </div>
              <div>
                {monteCarlo ? (
                  <div className="summary-grid" style={{ marginTop: 0 }}>
                    <Metric label="Ruin probability" value={`${monteCarlo.ruinRate.toFixed(1)}%`} tone="bad" />
                    <Metric label="Avg spins to ruin" value={monteCarlo.avgRuinSpin ? monteCarlo.avgRuinSpin.toFixed(0) : "-"} sub={`median ${monteCarlo.medianRuinSpin ?? "-"}`} />
                    <Metric label="Profitable runs" value={`${monteCarlo.profitableRate.toFixed(1)}%`} tone={monteCarlo.profitableRate >= 50 ? "good" : "bad"} />
                    <Metric label="Avg final" value={fmtMoney(monteCarlo.avgEnding)} tone={monteCarlo.avgEnding >= startingBalance ? "good" : "bad"} />
                    <Metric label="Median final" value={fmtMoney(monteCarlo.medianEnding)} />
                    <Metric label="Best / worst" value={`${fmtMoney(monteCarlo.bestEnding)} / ${fmtMoney(monteCarlo.worstEnding)}`} />
                    <Metric label="Avg $ / spin" value={fmtMoney(monteCarlo.avgChangePerSpin)} tone={monteCarlo.avgChangePerSpin >= 0 ? "good" : "bad"} />
                    <Metric label="Realized edge" value={fmtPct(monteCarlo.realizedEdge * 100)} tone={monteCarlo.realizedEdge >= 0 ? "good" : "bad"} sub={`target ~= -${wheelCopy.edge}`} />
                    <Metric label="Trials x spins" value={`${monteCarlo.runs.toLocaleString()} x ${monteCarlo.iterations.toLocaleString()}`} />
                  </div>
                ) : (
                  <p className="empty-state">
                    Run a Monte Carlo to estimate how often this exact setup reaches ruin and where the bankroll
                    typically finishes after many independent sessions. The histogram on the left shows the
                    distribution of spins until ruin across all losing runs.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="footer-note">
            <strong>Why this exists.</strong> European roulette has a flat house edge of 1/37 ~= 2.70%;
            American double-zero roulette has 2/38 ~= 5.26%. Doubling-up systems trade many tiny wins
            for rare catastrophic losses; gentler systems trade fast ruin for slow erosion. The math
            does not change.
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
