# Roulette Reality Check

> A European single-zero roulette simulator that stress-tests classic betting systems and makes the 2.70% house edge undeniably visible.

**Live demo:** [roulette-reality-check.vercel.app](https://roulette-reality-check.vercel.app)

![Built with React](https://img.shields.io/badge/React-18-61dafb?logo=react)
![Vite](https://img.shields.io/badge/Vite-5-646cff?logo=vite)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript)
![Deployed on Vercel](https://img.shields.io/badge/Vercel-deployed-black?logo=vercel)

---

## What it does

Pick a betting strategy, set a bankroll, hit Run. The simulator plays a real European roulette wheel against your chosen system - with exact payouts, configurable table maximums, and bankroll constraints - then shows the bankroll evolution, executive summary, and a Monte Carlo distribution of outcomes across thousands of independent sessions.

There is no winning strategy. The simulator's job is to make that fact obvious in numbers and pictures.

## Features

### Betting systems
Eight classic progressions, each with its own explanation in-app:

- **Flat** (control) - same stake every spin
- **Martingale** - double on losses
- **Reverse Martingale (Paroli)** - double on wins
- **D'Alembert** - +1 unit on loss, −1 on win
- **Fibonacci** - climb the Fibonacci ladder on losses
- **Oscar's Grind** - target +1 unit per series
- **Labouchère** - cancellation system with running sequence
- **Manual (casino-style table)** - drop chips on a real felt layout

### Bet targets
All standard European bets - red, black, odd, even, 1-18, 19-36, dozens, columns, straight numbers - with payouts, coverage percentages, and explanations.

### Casino-style manual mode
Click any number 0-36 or any outside bet to drop a chip. Real chip denominations ($5 / $10 / $25 / $100 / $500 / $1K) with color coding. The chip layout repeats each spin until you clear it.

### Wheel
- Authentic 37-pocket European wheel order
- SVG render with red/black/green pockets, gold rim, hub with spokes
- Independent ball orbit layer that idles and counter-spins on run
- Speed control: 1× / 2× / 4× / 8× / 20× / 50× / 100×
- Quick-run buttons: +10 / +100 / +1000 / +5000 spins instantly

### Charts
- **Bankroll evolution** with five view modes: raw $, profit, % of start, drawdown from peak, stake size
- Proper axes with tick labels (`$1.5k`, `$1.2M`, `+25%`), axis titles, baseline marker, last-point indicator
- **Monte Carlo histogram** of spins-until-ruin

### Executive summary
Twelve metrics computed in real time: ending bankroll, profit, ROI, max drawdown, lowest/peak balance, hit rate, average per spin, average stake, total staked, longest win/loss streaks, standard deviation per spin, ruin spin number.

### Monte Carlo analysis
Runs N independent simulations × M spins each in batches with progress bar. Reports:
- Ruin probability
- Average and median spins to ruin
- Profitable-run percentage
- Average and median final bankroll
- Best and worst case
- Expected edge per spin (always trending toward −2.70%)

### Help everywhere
Yellow `!` markers next to every option open hover-tooltips explaining what it does and when it matters.

## Architecture

```
src/
├── engine.ts        Pure simulation engine - PRNG, bet evaluation,
│                    every progression, Monte Carlo runner.
│                    Zero React dependencies.
├── Wheel.tsx        SVG European wheel + independent ball orbit.
├── CasinoTable.tsx  Manual-mode casino felt with chip placement.
├── Chart.tsx        Canvas-based charts with proper axes & ticks.
├── App.tsx          Layout, controls, state management.
├── main.tsx         Entry point.
└── styles.css       All styling, no UI framework dependency.
```

- **PRNG:** Mulberry32, seeded per session
- **All probabilities exact** (no approximations, no biased shortcuts)
- **No backend:** single static bundle, runs entirely in the browser
- **Bundle:** ~186 KB JS / 17 KB CSS, gzipped to ~60 KB / 4 KB

## Local development

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
vercel --prod
```

## The math

European roulette has a single zero. There are 37 pockets, and on every standard bet the house's expected return is:

```
E[house] = (1/37) × stake = stake × 2.70%
```

equivalently, the player's expected return is `−2.70%` of every unit staked, on every spin. No sequence of bets, no progression, and no money-management scheme changes this. Doubling-up systems trade many tiny wins for rare catastrophic losses; gentle systems trade fast ruin for slow erosion. The math is invariant.

This simulator exists to make that invariance visible.

## License

MIT
