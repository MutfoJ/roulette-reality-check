# Roulette Reality Check

> A European/American roulette simulator that stress-tests classic betting systems and makes the house edge visible.

**Live demo:** [roulette-reality-check.vercel.app](https://roulette-reality-check.vercel.app)

![Built with React](https://img.shields.io/badge/React-18-61dafb?logo=react)
![Vite](https://img.shields.io/badge/Vite-5-646cff?logo=vite)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript)
![Deployed on Vercel](https://img.shields.io/badge/Vercel-deployed-black?logo=vercel)

---

## What it does

Pick European single-zero or American double-zero roulette, choose a betting strategy, set a bankroll, and hit Run. The simulator plays the selected wheel against your chosen system with exact standard payouts, configurable table maximums, bankroll constraints, bankroll charts, summary metrics, and Monte Carlo outcome distributions.

There is no winning progression. The simulator's job is to make that fact obvious in numbers and pictures.

## Features

### Wheel modes

- **European single-zero:** 37 pockets, house edge `1/37 ~= 2.70%`
- **American double-zero:** 38 pockets, house edge `2/38 ~= 5.26%`
- Top-of-app toggle switches the wheel, pocket count, edge math, wheel render, table layout, and straight-bet choices.
- Internally, `00` is represented as pocket `37` and displayed as `00`.

### Betting systems

Eight classic progressions, each with its own explanation in-app:

- **Flat** (control): same stake every spin
- **Martingale:** double on losses, capped by table max/bankroll
- **Reverse Martingale (Paroli):** double on wins
- **D'Alembert:** +1 unit on loss, -1 unit on win
- **Fibonacci:** climb the Fibonacci ladder on losses, capped at the configured sequence limit
- **Oscar's Grind:** target +1 unit per series with corrected next-win cap
- **Labouchere:** cancellation system with a bounded running sequence
- **Manual (casino-style table):** drop chips on a felt layout that repeats each spin

### Bet targets

Standard roulette bets are supported: red, black, odd, even, 1-18, 19-36, dozens, columns, and straight pockets. Coverage is computed from the selected wheel size, so the same bet has worse odds on American double-zero roulette.

### Casino-style manual mode

Click any number, `0`, `00` in American mode, or any outside bet to drop a chip. Chip denominations are `$5 / $10 / $25 / $100 / $500 / $1K`. The expected loss display uses the actual total manual stake, not the base stake control.

### Wheel and charts

- Authentic European and American wheel orders
- SVG wheel render with red/black/green pockets and `00` support
- Speed control: `1x / 2x / 4x / 8x / 20x / 50x / 100x`
- Quick-run buttons: `+10 / +100 / +1000 / +5000`
- Bankroll chart modes: raw dollars, profit, percent return, drawdown, and stake size
- Monte Carlo histogram of spins until ruin

### Executive summary

Metrics update in real time: ending bankroll, profit/loss, ROI, max drawdown, lowest/peak balance, hit rate, average per spin, average stake, total staked, longest win/loss streaks, standard deviation per spin, and ruin spin number.

### Monte Carlo analysis

Runs N independent simulations x M spins each and reports:

- Ruin probability
- Average and median spins to ruin
- Profitable-run percentage
- Average and median final bankroll
- Best and worst final bankroll
- Average dollars per played spin
- Realized edge as total profit divided by total staked, which should converge toward `-2.70%` on European or `-5.26%` on American roulette

### Help everywhere

Yellow `!` markers next to options open hover-tooltips explaining what each setting does and when it matters.

## Architecture

```text
src/
├── engine.ts        Pure simulation engine: PRNG, wheel modes,
│                    bet evaluation, progressions, Monte Carlo.
├── Wheel.tsx        SVG European/American wheel + ball orbit.
├── CasinoTable.tsx  Manual-mode casino felt with 0/00 support.
├── Chart.tsx        Canvas-based charts with axes and ticks.
├── App.tsx          Layout, controls, state management.
├── main.tsx         Entry point.
└── styles.css       Styling, no UI framework dependency.
```

- **PRNG:** Mulberry32-style deterministic generator
- **Probabilities:** exact uniform pocket sampling for the selected wheel size
- **Payouts:** standard net payouts (`1:1`, `2:1`, `35:1`)
- **No backend:** single static bundle, runs entirely in the browser

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
vercel deploy -y
```

## The math

On every standard roulette bet, the expected player return per unit staked is the negative value of the zero pockets divided by total pockets:

```text
European: E[player] = -1 / 37  ~= -2.70%
American: E[player] = -2 / 38  ~= -5.26%
```

For example, a `$10` European even-money bet has expected value `-$10 / 37 ~= -$0.27`. A `$10` American even-money bet has expected value `-$20 / 38 ~= -$0.53`.

Progressions can change variance, bet sizing, ruin timing, and the shape of winning/losing sessions. They do not change the expected return per dollar wagered.

## License

MIT
