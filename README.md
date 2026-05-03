# Roulette Reality Check

> A browser-based roulette lab for stress-testing betting systems, bankroll risk, and the house edge.

**Live demo:** [roulette-reality-check.vercel.app](https://roulette-reality-check.vercel.app)

![Built with React](https://img.shields.io/badge/React-18-61dafb?logo=react)
![Vite](https://img.shields.io/badge/Vite-5-646cff?logo=vite)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript)
![Deployed on Vercel](https://img.shields.io/badge/Vercel-deployed-black?logo=vercel)

<p align="center">
  <img
    src="output/playwright/roulette-presentation-small.gif"
    alt="Roulette Reality Check showing Martingale strategy, bankroll evolution, and Monte Carlo analysis"
    width="760"
  />
</p>

Roulette Reality Check lets you pick a European or American wheel, choose a classic betting progression, set bankroll and table constraints, then watch the system play out with live charts and Monte Carlo analysis.

The point is not to find a magic progression. It is to make the tradeoff visible: strategies can reshape variance, streaks, and ruin timing, but they do not remove the negative expected return.

## Highlights

- **European and American wheels:** single-zero and double-zero layouts with the correct pocket counts, wheel renders, and house edges.
- **Classic progressions:** Flat, Martingale, Reverse Martingale, D'Alembert, Fibonacci, Oscar's Grind, Labouchere, and a manual table layout.
- **Live spin engine:** animated wheel, last outcomes, run/pause controls, speed presets, quick-run batches, and automatic stop-on-bust behavior.
- **Bankroll evolution:** raw dollars, profit, percent return, drawdown, and stake-size chart modes.
- **Monte Carlo simulator:** repeated sessions reveal ruin probability, survival curves, final bankroll distribution, and percentile fan charts.
- **Casino-style manual mode:** place chips on numbers, zeros, columns, dozens, red/black, odd/even, and high/low bets.

## What It Shows

The app is built around a simple idea: one lucky or unlucky run can be persuasive, so the simulator shows both the dramatic single-session story and the larger distribution.

Start with a strategy, press Run, and watch the bankroll graph update spin by spin. Then run hundreds or thousands of independent sessions with the same setup to see how often the bankroll survives, where sessions end, and how realized edge converges toward the wheel's math.

## Wheel Modes

- **European single-zero:** 37 pockets, house edge `1 / 37 ~= 2.70%`
- **American double-zero:** 38 pockets, house edge `2 / 38 ~= 5.26%`
- The wheel toggle updates the render, pocket count, edge math, table layout, and straight-bet choices.
- Internally, `00` is represented as pocket `37` and displayed as `00`.

## Betting Systems

Eight progressions are available, each with in-app explanation text:

- **Flat:** same stake every spin.
- **Martingale:** double after losses, reset after a win, capped by bankroll and table maximum.
- **Reverse Martingale (Paroli):** double after wins, reset after a loss.
- **D'Alembert:** add one unit after a loss, subtract one unit after a win.
- **Fibonacci:** climb the Fibonacci sequence after losses and step back after wins.
- **Oscar's Grind:** target one unit of profit per series with controlled stake increases.
- **Labouchere:** cancellation sequence with bounded line length.
- **Manual layout:** place chips on the felt and let the selected progression scale the whole layout.

## Analysis Views

### Bankroll Chart

The main chart can show raw bankroll, profit/loss, percent return, drawdown from peak, or stake size. Summary metrics update live with ending bankroll, ROI, max drawdown, lowest/peak balance, hit rate, average stake, longest streaks, standard deviation, and ruin spin.

### Monte Carlo

Monte Carlo mode runs many independent sessions with the same settings and reports:

- Ruin probability
- Average and median spins to ruin
- Profitable-run percentage
- Average and median final bankroll
- Best and worst final bankroll
- Average dollars per played spin
- Realized edge as total profit divided by total staked
- Survival curve, final-bankroll histogram, and bankroll fan chart

## Architecture

```text
src/
|-- engine.ts        Pure simulation engine: PRNG, wheel modes,
|                    bet evaluation, progressions, Monte Carlo.
|-- Wheel.tsx        SVG European/American wheel and ball orbit.
|-- CasinoTable.tsx  Manual-mode casino felt with 0/00 support.
|-- Chart.tsx        Canvas-based charts with axes and ticks.
|-- App.tsx          Layout, controls, state management.
|-- main.tsx         React entry point.
`-- styles.css       Styling, no UI framework dependency.
```

- **PRNG:** deterministic Mulberry32-style generator
- **Probabilities:** exact uniform pocket sampling for the selected wheel size
- **Payouts:** standard net payouts (`1:1`, `2:1`, `35:1`)
- **Runtime:** static frontend only, no backend required

## Local Development

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # outputs to dist/
npm run preview  # serve the production build locally
```

## Deployment

Deployed automatically to Vercel on push. To deploy manually:

```bash
npm run build
vercel deploy -y
```

## The Math

Every standard roulette bet carries the wheel's house edge. The expected player return per unit staked is the negative value of the zero pockets divided by total pockets:

```text
European: E[player] = -1 / 37 ~= -2.70%
American: E[player] = -2 / 38 ~= -5.26%
```

For example, a `$10` European even-money bet has expected value `-$10 / 37 ~= -$0.27`. A `$10` American even-money bet has expected value `-$20 / 38 ~= -$0.53`.

Progressions can change variance, bet sizing, streak behavior, and ruin timing. They do not change the expected return per dollar wagered.

## License

MIT
