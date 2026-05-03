import React from "react";
import { fmtMoney, type ChartMode, type SpinResult } from "./engine";

interface Props {
  history: number[];
  results: SpinResult[];
  mode: ChartMode;
  startingBalance: number;
}

// "nice" tick step — standard 1/2/5×10^n picker for axis ticks
function niceTicks(min: number, max: number, target = 6): number[] {
  if (max <= min) { max = min + 1; }
  const span = max - min;
  const rough = span / target;
  const pow = Math.pow(10, Math.floor(Math.log10(Math.abs(rough) || 1)));
  const norm = rough / pow;
  let step: number;
  if (norm < 1.5) step = 1;
  else if (norm < 3) step = 2;
  else if (norm < 7) step = 5;
  else step = 10;
  step *= pow;
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + step * 0.5; v += step) ticks.push(v);
  return ticks;
}

function formatTick(v: number, mode: ChartMode): string {
  if (mode === "percent") return `${v >= 0 ? "" : ""}${v.toFixed(0)}%`;
  const a = Math.abs(v);
  if (a >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (a >= 1_000) return `$${(v / 1_000).toFixed(a >= 10_000 ? 0 : 1)}k`;
  return `$${v.toFixed(0)}`;
}

function formatSpin(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(v >= 10_000 ? 0 : 1)}k`;
  return v.toFixed(0);
}

const Y_AXIS_TITLE: Record<ChartMode, string> = {
  money: "Bankroll ($)",
  profit: "Profit / loss ($)",
  percent: "Return vs start (%)",
  drawdown: "Drawdown from peak ($)",
  stake: "Stake size ($)",
};

export function BankrollChart({ history, results, mode, startingBalance }: Props) {
  const ref = React.useRef<HTMLCanvasElement | null>(null);

  React.useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth * dpr;
    const H = canvas.clientHeight * dpr;
    canvas.width = W;
    canvas.height = H;
    ctx.clearRect(0, 0, W, H);

    // padding: leave room for axis titles + tick labels
    const padL = 70 * dpr;
    const padR = 24 * dpr;
    const padT = 20 * dpr;
    const padB = 50 * dpr;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    let runningPeak = startingBalance;
    let values: number[];
    if (mode === "money") values = history.slice();
    else if (mode === "profit") values = history.map(b => b - startingBalance);
    else if (mode === "percent") values = history.map(b => startingBalance ? ((b - startingBalance) / startingBalance) * 100 : 0);
    else if (mode === "drawdown") values = history.map(b => { runningPeak = Math.max(runningPeak, b); return runningPeak - b; });
    else /* stake */ values = [0, ...results.map(r => r.stake)];

    if (values.length < 2) {
      ctx.fillStyle = "rgba(139, 149, 173, 0.6)";
      ctx.font = `${14 * dpr}px Inter, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("No spins yet — press Run to start", W / 2, H / 2);
      return;
    }

    let minV = Math.min(...values);
    let maxV = Math.max(...values);
    if (mode === "money") {
      minV = Math.min(minV, startingBalance);
      maxV = Math.max(maxV, startingBalance);
    } else if (mode === "drawdown" || mode === "stake") {
      minV = 0;
    }
    if (maxV - minV < 1e-6) maxV = minV + 1;

    const yTicks = niceTicks(minV, maxV, 6);
    const yMin = yTicks[0];
    const yMax = yTicks[yTicks.length - 1];
    const ySpan = yMax - yMin || 1;
    const xMax = values.length - 1;

    const x2px = (i: number) => padL + (i / Math.max(1, xMax)) * plotW;
    const y2px = (v: number) => padT + (1 - (v - yMin) / ySpan) * plotH;

    // ---- Y grid + tick labels ----
    ctx.font = `${11 * dpr}px "JetBrains Mono", monospace`;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    yTicks.forEach((t) => {
      const y = y2px(t);
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(W - padR, y);
      ctx.stroke();
      ctx.fillStyle = "rgba(203, 213, 225, 0.8)";
      ctx.fillText(formatTick(t, mode), padL - 8 * dpr, y);
    });

    // ---- X axis ticks ----
    const xTicks = niceTicks(0, xMax, Math.min(8, Math.max(2, Math.floor(plotW / (90 * dpr)))));
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    xTicks.forEach((t) => {
      if (t < 0 || t > xMax) return;
      const x = x2px(t);
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.beginPath();
      ctx.moveTo(x, padT);
      ctx.lineTo(x, H - padB);
      ctx.stroke();
      ctx.strokeStyle = "rgba(203, 213, 225, 0.4)";
      ctx.beginPath();
      ctx.moveTo(x, H - padB);
      ctx.lineTo(x, H - padB + 4 * dpr);
      ctx.stroke();
      ctx.fillStyle = "rgba(203, 213, 225, 0.8)";
      ctx.fillText(formatSpin(t), x, H - padB + 7 * dpr);
    });

    // ---- axis lines ----
    ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
    ctx.lineWidth = 1.2 * dpr;
    ctx.beginPath();
    ctx.moveTo(padL, padT);
    ctx.lineTo(padL, H - padB);
    ctx.lineTo(W - padR, H - padB);
    ctx.stroke();

    // ---- baseline (start bankroll / zero) ----
    if (mode === "money" || mode === "profit" || mode === "percent") {
      const baselineV = mode === "money" ? startingBalance : 0;
      if (baselineV >= yMin && baselineV <= yMax) {
        const y = y2px(baselineV);
        ctx.strokeStyle = "rgba(244, 199, 98, 0.7)";
        ctx.setLineDash([6 * dpr, 6 * dpr]);
        ctx.lineWidth = 1.2 * dpr;
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(W - padR, y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "rgba(244, 199, 98, 0.85)";
        ctx.font = `${10 * dpr}px Inter, sans-serif`;
        ctx.textAlign = "left";
        ctx.textBaseline = "bottom";
        ctx.fillText("baseline", padL + 6 * dpr, y - 2 * dpr);
      }
    }

    // ---- area fill ----
    const finalUp = values[values.length - 1] >= values[0];
    const lineColor =
      mode === "drawdown" ? "#fb7185" :
      mode === "stake" ? "#f4c762" :
      finalUp ? "#4ade80" : "#fb7185";
    const fillTop =
      mode === "drawdown" ? "rgba(251, 113, 133, 0.30)" :
      mode === "stake" ? "rgba(244, 199, 98, 0.26)" :
      finalUp ? "rgba(74, 222, 128, 0.26)" : "rgba(251, 113, 133, 0.26)";

    // clip to plot area
    ctx.save();
    ctx.beginPath();
    ctx.rect(padL, padT, plotW, plotH);
    ctx.clip();

    ctx.beginPath();
    values.forEach((v, i) => {
      const x = x2px(i), y = y2px(v);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.lineTo(x2px(xMax), H - padB);
    ctx.lineTo(x2px(0), H - padB);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, padT, 0, H - padB);
    grad.addColorStop(0, fillTop);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fill();

    // line stroke
    ctx.beginPath();
    ctx.lineWidth = 2.2 * dpr;
    ctx.strokeStyle = lineColor;
    values.forEach((v, i) => {
      const x = x2px(i), y = y2px(v);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.restore();

    // ---- last-point dot ----
    const lx = x2px(values.length - 1);
    const ly = y2px(values[values.length - 1]);
    ctx.fillStyle = lineColor;
    ctx.beginPath();
    ctx.arc(lx, ly, 4 * dpr, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.lineWidth = 1.5 * dpr;
    ctx.stroke();

    // ---- axis titles ----
    ctx.fillStyle = "rgba(244, 199, 98, 0.95)";
    ctx.font = `700 ${11 * dpr}px Inter, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("Spin #", padL + plotW / 2, H - 8 * dpr);

    ctx.save();
    ctx.translate(16 * dpr, padT + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(Y_AXIS_TITLE[mode], 0, 0);
    ctx.restore();

  }, [history, results, mode, startingBalance]);

  return <canvas className="chart-canvas" ref={ref} />;
}

// ============================================================
// Survival curve — % of runs still solvent at each spin index
// ============================================================
export function SurvivalChart({ spins, alive }: { spins: number[]; alive: number[] }) {
  const ref = React.useRef<HTMLCanvasElement | null>(null);
  React.useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth * dpr, H = canvas.clientHeight * dpr;
    canvas.width = W; canvas.height = H;
    ctx.clearRect(0, 0, W, H);
    const padL = 56 * dpr, padR = 16 * dpr, padT = 14 * dpr, padB = 46 * dpr;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    if (!spins.length) {
      ctx.fillStyle = "rgba(139, 149, 173, 0.6)";
      ctx.font = `${13 * dpr}px Inter, sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("Run Monte Carlo to see survival curve", W / 2, H / 2);
      return;
    }
    const xMax = spins[spins.length - 1];
    const yTicks = [0, 0.25, 0.5, 0.75, 1];
    const x2px = (v: number) => padL + (v / xMax) * plotW;
    const y2px = (v: number) => padT + (1 - v) * plotH;
    // y grid + labels
    ctx.font = `${10 * dpr}px "JetBrains Mono", monospace`;
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    yTicks.forEach((t) => {
      const y = y2px(t);
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + plotW, y); ctx.stroke();
      ctx.fillStyle = "rgba(203, 213, 225, 0.8)";
      ctx.fillText(`${(t * 100).toFixed(0)}%`, padL - 6 * dpr, y);
    });
    // x ticks
    const xTicksRaw = niceTicks(0, xMax, 6);
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    xTicksRaw.forEach((t) => {
      if (t < 0 || t > xMax) return;
      const x = x2px(t);
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, padT + plotH); ctx.stroke();
      ctx.fillStyle = "rgba(203, 213, 225, 0.8)";
      ctx.fillText(formatSpin(t), x, padT + plotH + 6 * dpr);
    });
    // axis lines
    ctx.strokeStyle = "rgba(255,255,255,0.18)"; ctx.lineWidth = 1.1 * dpr;
    ctx.beginPath(); ctx.moveTo(padL, padT); ctx.lineTo(padL, padT + plotH); ctx.lineTo(padL + plotW, padT + plotH); ctx.stroke();
    // area fill
    ctx.save();
    ctx.beginPath();
    ctx.rect(padL, padT, plotW, plotH);
    ctx.clip();
    ctx.beginPath();
    spins.forEach((s, i) => {
      const x = x2px(s), y = y2px(alive[i]);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.lineTo(x2px(xMax), padT + plotH);
    ctx.lineTo(padL, padT + plotH);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, padT, 0, padT + plotH);
    grad.addColorStop(0, "rgba(74, 222, 128, 0.30)");
    grad.addColorStop(1, "rgba(74, 222, 128, 0.02)");
    ctx.fillStyle = grad; ctx.fill();
    // line
    ctx.beginPath();
    ctx.lineWidth = 2.2 * dpr;
    ctx.strokeStyle = "#4ade80";
    spins.forEach((s, i) => {
      const x = x2px(s), y = y2px(alive[i]);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.restore();
    // axis titles
    ctx.fillStyle = "rgba(244, 199, 98, 0.95)";
    ctx.font = `700 ${10 * dpr}px Inter, sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.fillText("Spin #", padL + plotW / 2, H - 8 * dpr);
    ctx.save();
    ctx.translate(14 * dpr, padT + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("% of runs still solvent", 0, 0);
    ctx.restore();
  }, [spins, alive]);
  return <canvas className="chart-canvas small" ref={ref} />;
}

// ============================================================
// Fan chart — bankroll percentile bands at each checkpoint
// ============================================================
export function FanChart({ spins, p1, p10, p25, p50, p75, p90, p99, mean, startingBalance }:
  { spins: number[]; p1: number[]; p10: number[]; p25: number[]; p50: number[]; p75: number[]; p90: number[]; p99: number[]; mean: number[]; startingBalance: number }) {
  const ref = React.useRef<HTMLCanvasElement | null>(null);
  React.useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth * dpr, H = canvas.clientHeight * dpr;
    canvas.width = W; canvas.height = H;
    ctx.clearRect(0, 0, W, H);
    const padL = 70 * dpr, padR = 24 * dpr, padT = 18 * dpr, padB = 50 * dpr;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    if (!spins.length) {
      ctx.fillStyle = "rgba(139, 149, 173, 0.6)";
      ctx.font = `${13 * dpr}px Inter, sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("Run Monte Carlo to see bankroll fan chart", W / 2, H / 2);
      return;
    }
    const xMax = spins[spins.length - 1];
    let minV = Math.min(0, ...p1, startingBalance);
    let maxV = Math.max(...p99, startingBalance);
    if (maxV - minV < 1) maxV = minV + 1;
    const yTicks = niceTicks(minV, maxV, 6);
    const yMin = yTicks[0], yMax = yTicks[yTicks.length - 1];
    const ySpan = yMax - yMin || 1;
    const x2px = (v: number) => padL + (v / xMax) * plotW;
    const y2px = (v: number) => padT + (1 - (v - yMin) / ySpan) * plotH;
    // y grid + labels
    ctx.font = `${11 * dpr}px "JetBrains Mono", monospace`;
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    yTicks.forEach((t) => {
      const y = y2px(t);
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + plotW, y); ctx.stroke();
      ctx.fillStyle = "rgba(203, 213, 225, 0.8)";
      ctx.fillText(formatTick(t, "money"), padL - 8 * dpr, y);
    });
    // x ticks
    const xTicksRaw = niceTicks(0, xMax, 6);
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    xTicksRaw.forEach((t) => {
      if (t < 0 || t > xMax) return;
      const x = x2px(t);
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, padT + plotH); ctx.stroke();
      ctx.fillStyle = "rgba(203, 213, 225, 0.8)";
      ctx.fillText(formatSpin(t), x, padT + plotH + 6 * dpr);
    });
    // axis lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.18)"; ctx.lineWidth = 1.1 * dpr;
    ctx.beginPath(); ctx.moveTo(padL, padT); ctx.lineTo(padL, padT + plotH); ctx.lineTo(padL + plotW, padT + plotH); ctx.stroke();
    // baseline (starting bankroll)
    if (startingBalance >= yMin && startingBalance <= yMax) {
      const y = y2px(startingBalance);
      ctx.strokeStyle = "rgba(244, 199, 98, 0.7)";
      ctx.setLineDash([6 * dpr, 6 * dpr]);
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + plotW, y); ctx.stroke();
      ctx.setLineDash([]);
    }
    // bands: 10-90 then 25-75 (nested)
    ctx.save();
    ctx.beginPath(); ctx.rect(padL, padT, plotW, plotH); ctx.clip();
    const drawBand = (lo: number[], hi: number[], fill: string) => {
      ctx.beginPath();
      spins.forEach((s, i) => {
        const x = x2px(s), y = y2px(hi[i]);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      for (let i = spins.length - 1; i >= 0; i--) {
        const x = x2px(spins[i]), y = y2px(lo[i]);
        ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
    };
    drawBand(p1, p99, "rgba(76, 201, 240, 0.10)"); // outermost
    drawBand(p10, p90, "rgba(76, 201, 240, 0.18)"); // outer
    drawBand(p25, p75, "rgba(76, 201, 240, 0.30)"); // inner
    // median line (solid gold)
    ctx.beginPath();
    ctx.lineWidth = 2.2 * dpr;
    ctx.strokeStyle = "#f4c762";
    spins.forEach((s, i) => {
      const x = x2px(s), y = y2px(p50[i]);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.restore();
    // axis titles
    ctx.fillStyle = "rgba(244, 199, 98, 0.95)";
    ctx.font = `700 ${11 * dpr}px Inter, sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.fillText("Spin #", padL + plotW / 2, H - 8 * dpr);
    ctx.save();
    ctx.translate(16 * dpr, padT + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("Bankroll ($) — bands: p1-p99 / p10-p90 / p25-p75 / median", 0, 0);
    ctx.restore();
    // legend
    ctx.font = `${10 * dpr}px Inter, sans-serif`;
    ctx.textAlign = "left"; ctx.textBaseline = "top";
    const lx = padL + 8 * dpr, ly = padT + 4 * dpr;
    let cx = lx;
    const swatch = (fill: string, label: string, isLine = false, dashed = false) => {
      if (isLine) {
        ctx.fillStyle = fill;
        if (dashed) {
          ctx.fillRect(cx, ly + 5 * dpr, 4 * dpr, 2 * dpr);
          ctx.fillRect(cx + 7 * dpr, ly + 5 * dpr, 4 * dpr, 2 * dpr);
        } else {
          ctx.fillRect(cx, ly + 5 * dpr, 12 * dpr, 2 * dpr);
        }
      } else {
        ctx.fillStyle = fill;
        ctx.fillRect(cx, ly + 2 * dpr, 12 * dpr, 8 * dpr);
      }
      ctx.fillStyle = "rgba(203, 213, 225, 0.85)";
      ctx.fillText(label, cx + 16 * dpr, ly);
      cx += 16 * dpr + ctx.measureText(label).width + 12 * dpr;
    };
    swatch("rgba(76, 201, 240, 0.30)", "p25-p75");
    swatch("rgba(76, 201, 240, 0.18)", "p10-p90");
    swatch("rgba(76, 201, 240, 0.10)", "p1-p99");
    swatch("#f4c762", "median", true, false);
  }, [spins, p10, p25, p50, p75, p90, startingBalance]);
  return <canvas className="chart-canvas small" ref={ref} />;
}

export function HistogramChart({ data, color = "#f4c762", xLabel = "Spins until ruin", yLabel = "# of trials" }: { data: { labels: number[]; counts: number[] }; color?: string; xLabel?: string; yLabel?: string }) {
  const ref = React.useRef<HTMLCanvasElement | null>(null);

  React.useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth * dpr;
    const H = canvas.clientHeight * dpr;
    canvas.width = W; canvas.height = H;
    ctx.clearRect(0, 0, W, H);

    const padL = 56 * dpr, padR = 16 * dpr, padT = 14 * dpr, padB = 46 * dpr;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    if (!data.counts.length || data.counts.every(c => c === 0)) {
      ctx.fillStyle = "rgba(139, 149, 173, 0.6)";
      ctx.font = `${13 * dpr}px Inter, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Run Monte Carlo to see distribution", W / 2, H / 2);
      return;
    }
    const max = Math.max(...data.counts);
    const yTicks = niceTicks(0, max, 4);
    const yMax = yTicks[yTicks.length - 1];

    // y grid + labels
    ctx.font = `${10 * dpr}px "JetBrains Mono", monospace`;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    yTicks.forEach((t) => {
      const y = padT + (1 - t / yMax) * plotH;
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(W - padR, y);
      ctx.stroke();
      ctx.fillStyle = "rgba(203, 213, 225, 0.8)";
      ctx.fillText(String(t), padL - 6 * dpr, y);
    });

    // bars
    const bw = plotW / data.counts.length;
    data.counts.forEach((c, i) => {
      const h = (c / yMax) * plotH;
      const x = padL + i * bw;
      const y = padT + plotH - h;
      ctx.fillStyle = color;
      ctx.fillRect(x + 1 * dpr, y, bw - 2 * dpr, h);
    });

    // x ticks (use bin-start labels at intervals)
    ctx.fillStyle = "rgba(203, 213, 225, 0.85)";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const xLabelCount = Math.min(data.labels.length, Math.max(2, Math.floor(plotW / (60 * dpr))));
    for (let k = 0; k < xLabelCount; k++) {
      const i = Math.round((k * (data.labels.length - 1)) / Math.max(1, xLabelCount - 1));
      const x = padL + i * bw + bw / 2;
      ctx.fillText(formatSpin(data.labels[i]), x, padT + plotH + 6 * dpr);
    }

    // axis lines
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1.1 * dpr;
    ctx.beginPath();
    ctx.moveTo(padL, padT);
    ctx.lineTo(padL, padT + plotH);
    ctx.lineTo(padL + plotW, padT + plotH);
    ctx.stroke();

    // axis titles
    ctx.fillStyle = "rgba(244, 199, 98, 0.95)";
    ctx.font = `700 ${10 * dpr}px Inter, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(xLabel, padL + plotW / 2, H - 8 * dpr);
    ctx.save();
    ctx.translate(14 * dpr, padT + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(yLabel, 0, 0);
    ctx.restore();
  }, [data, color, xLabel, yLabel]);

  return <canvas className="chart-canvas small" ref={ref} />;
}
