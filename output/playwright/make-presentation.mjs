import playwright from "./node_modules/playwright/index.js";
import fs from "node:fs/promises";
import path from "node:path";

const { chromium } = playwright;
const outDir = path.resolve("output/playwright");
const webmPath = path.join(outDir, "roulette-presentation.webm");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  recordVideo: {
    dir: outDir,
    size: { width: 1440, height: 900 },
  },
});

const page = await context.newPage();

// Recording seed: keeps the default Martingale path deterministic so the
// raw bankroll graph reaches zero during the staged walkthrough.
await page.addInitScript(() => {
  Math.random = () => 98 / 2 ** 31;
});

await page.goto("https://roulette-reality-check.vercel.app", { waitUntil: "networkidle" });
await page.addStyleTag({
  content: `
    html { scroll-behavior: smooth; }
    #demo-caption {
      position: fixed;
      left: 50%;
      transform: translateX(-50%);
      z-index: 999999;
      max-width: min(980px, calc(100vw - 48px));
      padding: 14px 18px;
      border: 1px solid rgba(255, 204, 89, 0.45);
      border-radius: 12px;
      background: rgba(7, 10, 18, 0.88);
      color: #fff4cf;
      box-shadow: 0 18px 45px rgba(0, 0, 0, 0.45);
      font: 800 21px/1.25 system-ui, -apple-system, Segoe UI, sans-serif;
      text-align: center;
      opacity: 0;
      transition: opacity 260ms ease, transform 260ms ease;
      pointer-events: none;
    }
    #demo-caption.bottom {
      bottom: 22px;
    }
    #demo-caption.top {
      top: 22px;
    }
    #demo-caption.visible {
      opacity: 1;
      transform: translateX(-50%) translateY(-4px);
    }
    #demo-caption.top.visible {
      transform: translateX(-50%) translateY(4px);
    }
  `,
});

await page.evaluate(() => {
  const el = document.createElement("div");
  el.id = "demo-caption";
  document.body.appendChild(el);
});

async function caption(text, ms = 1600) {
  await page.evaluate((value) => {
    const el = document.getElementById("demo-caption");
    el.textContent = value.text;
    el.classList.toggle("top", value.placement === "top");
    el.classList.toggle("bottom", value.placement !== "top");
    el.classList.add("visible");
  }, typeof text === "string" ? { text, placement: "bottom" } : text);
  await sleep(ms);
}

async function hideCaption(ms = 350) {
  await page.evaluate(() => document.getElementById("demo-caption")?.classList.remove("visible"));
  await sleep(ms);
}

async function smoothScrollToText(text, settle = 900, block = "center") {
  await page.getByText(text, { exact: true }).first().evaluate((el, scrollBlock) => {
    el.scrollIntoView({ behavior: "smooth", block: scrollBlock, inline: "nearest" });
  }, block);
  await sleep(settle);
}

async function smoothScrollToLocator(locator, settle = 900, block = "center") {
  await locator.evaluate((el, scrollBlock) => {
    el.scrollIntoView({ behavior: "smooth", block: scrollBlock, inline: "nearest" });
  }, block);
  await sleep(settle);
}

async function hoverClick(locator, wait = 800) {
  await locator.scrollIntoViewIfNeeded();
  await locator.hover();
  await sleep(220);
  await locator.click();
  await sleep(wait);
}

async function waitForBankrollZero(timeout = 12000) {
  await page.waitForFunction(
    () => document.body.innerText.includes("Busted at spin"),
    null,
    { timeout },
  );
}

// Open on the default strategy controls first, without changing them.
await caption("The walkthrough begins with the default strategy: Martingale on red, using the starting bankroll and table limit already shown.", 2100);
await smoothScrollToText("How Martingale works", 1100, "center");
await caption("Martingale doubles after losses and resets after a win, which makes short recoveries feel deceptively reliable.", 2300);
await hideCaption();

// Move back up to the spin engine and start the default run.
await caption("The spin engine connects every pocket result to the active stake, latest outcome, and live bankroll.", 1700);
await smoothScrollToText("Spin engine", 800, "start");
await hoverClick(page.getByRole("button", { name: /^Run$/ }), 1500);
await caption("During the run, wins, losses, and stake increases are visible as part of the same session.", 1500);
await hideCaption();

// Move downward to the raw bankroll chart and let it fall to zero.
await caption("Raw bankroll mode shows actual dollars after every spin, with no smoothing or transformed scale.", 1300);
await smoothScrollToLocator(page.locator(".chart-canvas").first(), 900, "center");
await hoverClick(page.getByRole("button", { name: "Raw $" }), 250);
await caption("The line can climb for a while, but the growing stake size makes the downside arrive all at once.", 2300);
await waitForBankrollZero();
await caption("At ruin, the graph lands at zero: the progression reshaped variance, not expected value.", 2500);
await hideCaption();

// Continue downward and run the multi-session simulator.
await smoothScrollToText("Monte Carlo - multi-run analysis", 1000);
await caption({
  text: "Monte Carlo analysis repeats the same setup across many independent sessions, turning one example into statistics.",
  placement: "top",
}, 2300);
await page.getByRole("spinbutton", { name: /Runs/ }).fill("800");
await page.getByRole("spinbutton", { name: /Spins \/ run/ }).fill("3000");
await caption({
  text: "This run uses 800 sessions, each up to 3,000 spins, with the same bankroll, table limit, and strategy.",
  placement: "top",
}, 2000);
await hoverClick(page.getByRole("button", { name: /Run analysis/ }), 400);
await page.getByRole("button", { name: /Run analysis/ }).waitFor({ state: "visible" });
await page.waitForFunction(() => !document.body.innerText.includes("Running..."), null, { timeout: 60000 });
await sleep(900);

// Briefly show the simulator outputs after the calculation.
await caption({
  text: "The summary reports ruin probability, final bankroll distribution, profitable runs, and realized edge.",
  placement: "top",
}, 2300);
await hoverClick(page.getByRole("button", { name: "Survival curve" }), 1000);
await caption({
  text: "The survival curve shows how many sessions remain solvent as spins accumulate.",
  placement: "top",
}, 1900);
await hoverClick(page.getByRole("button", { name: "Final bankroll" }), 1000);
await caption({
  text: "Final bankroll shows where all repeated sessions ended, including both rare wins and busts.",
  placement: "top",
}, 1900);
await hoverClick(page.getByRole("button", { name: "Bankroll fan" }), 1200);
await caption({
  text: "The bankroll fan shows the range of possible paths, from lucky runs to the bad tail.",
  placement: "top",
}, 2000);
await hideCaption();

await caption({
  text: "Roulette strategies change the shape of variance. The zero pockets keep the math.",
  placement: "top",
}, 2300);
await hideCaption(700);

const video = page.video();
await page.close();

if (video) {
  await fs.rm(webmPath, { force: true });
  await video.saveAs(webmPath);
}

await context.close();
await browser.close();
