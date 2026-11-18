// Deep-dip mean-reversion bot for btc-race-24h-20261118-1444.
//
// The dev window (2026-11-17 14:44 UTC -> 2026-11-18 14:44 UTC, 1440
// one-minute cbBTC bars) FALLS -2.80% with a 3.25% high-low range: a sharp
// opening drop (-2.6% in the first 70 bars), a slow grind back up (+2.9% over
// ~440 bars), a long range, then a final slide (-2.8% in the last ~400 bars).
// The previous race's B1 bot (dip 1.2%) LOSES -$9.98 here: it buys into the
// opening decline, gets stopped out, and buys the final slide too late.
//
// This bot only buys a REAL capitulation: a close at least 2.0% below the
// highest close of the last 120 bars, confirmed by one green bar and a close
// at least 5 bps above the 20-bar low. On the dev window that fires twice —
// both in the opening decline — and the trailing exit rides each rebound:
//
//   buy bar 71 -> sell bar 87   +$9.95
//   buy bar 119 -> sell bar 513 +$16.20
//
// Dev grade-local (exact-fill simulator, validated byte-for-byte against
// grade-local on B1: -$9.980456, 7 trades, fees $3.196627, max DD 2.48%):
// net +$26.15 (+2.61%), 2 round trips (4 orders), max drawdown 1.13%,
// fees $1.62. Plateau, not a spike: DIP 190-210 bps x ARM 120-130 bps x
// TRAIL 20-25 bps all give +$25.05 to +$26.95; the chosen point sits in the
// middle of it.
//
// Exit (whole position, on a bar's close):
//   - stop-loss: position value at most 99% of its cost (-1.0%);
//   - trailing stop: once the value reaches 101.2% of cost, sell on a 0.25%
//     pullback from the highest value since entry (rides the rebound to the
//     swing high, sells shortly after the peak rolls over);
//   - time-stop: 480 bars (8 h) held, sell whatever the price.
// After a sale, 15 bars of cooldown before the next entry.
//
// Fallback (guardrail insurance, never fires on the dev window): if no deep
// dip has traded by bar 720 (half the window), loosen the entry to a 0.8%
// dip with a scalper's exit (arm +0.6%, trail 0.3%, hold 240 bars), at most
// ONE fallback trade — so the bot still trades at least once on a live window
// with no capitulation dip, instead of finishing with zero trades. A second
// fallback trade was tested and REJECTED: on the dev window's second half it
// buys the final slide and loses -$13.23.
//
// No entries after bar 1320: a position opened in the last 120 bars has no
// time for the trailing/time-stop to work and is sold at a loss by the final
// flatten (on dev, the 1436 entry loses -$5.60). No orders on the last batch
// (bar 1440): they would be rejected after_end; the flatten sells instead.
//
// All arithmetic on the entry/exit thresholds is exact bigint math (ratios in
// basis points), so the bot is deterministic: the same bars give the same
// orders, run after run. No clock, no environment, no randomness.

import { runBars, type Bar, type BarsState, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
/** Rolling-max window for the dip, in bars. */
const WIN = 120;
/** Deep dip: close at least this far below the WIN-bar high (basis points). */
const DEEP_DIP_BPS = 200n;
/** Fallback dip: looser entry once the window is half over with no trade. */
const SHALLOW_DIP_BPS = 80n;
/** Bounce confirmation: close at least this far above the 20-bar low (bps). */
const RISE_BPS = 5n;
/** Window for the bounce-confirmation low, in bars. */
const LOW_WIN = 20;
/** Arm the trailing stop once the value is this far above cost (bps). */
const ARM_BPS = 120n;
/** Sell on this pullback from the peak value once armed (bps). */
const TRAIL_BPS = 25n;
/** Stop-loss: sell when the value is this far below cost (bps). */
const SL_BPS = 100n;
/** Time-stop: sell after this many bars held. */
const MAX_HOLD = 480;
/** Fallback exit: arm / trail / hold for the single fallback trade.
 *  Capped at ONE fallback trade: a re-arming fallback was tested and
 *  REJECTED — on the dev window's second half its second trade buys the
 *  final slide (bar 1197 -> 1431) and loses -$13.23, turning a +$2.01
 *  fallback into -$11.23. One fallback trade only. */
const FB_ARM_BPS = 60n;
const FB_TRAIL_BPS = 30n;
const FB_MAX_HOLD = 240;
/** Bars to wait after a sale before the next entry. */
const COOLDOWN = 15;
/** First decision bar (index 30, i.e. after 31 bars of history). */
const MIN_BARS = 31;
/** Bar count from which the fallback arm may fire (half the 1440-bar window). */
const FALLBACK_BAR = 720;
/** No entries after this bar count (last 120 bars: flatten would eat them). */
const LAST_ENTRY_BAR = 1321;
/** Total bars in a window (RULES.txt: 1440 one-minute bars); no orders on it. */
const TOTAL_BARS = 1440;
const MAX_SLIPPAGE_BPS = 100;

const closes: bigint[] = [];
let prevClose: bigint | null = null;
let barCount = 0;
let entryBar = -1;
let lastExitBar = -1_000_000_000;
let peak = 0n;
let armed = false;
/** Whether the open position was entered by the fallback arm. */
let isFallback = false;
/** Completed round trips by arm (the fallback fires at most once). */
let deepTrades = 0;
let fbTrades = 0;

await runBars({
  onBatch(_state: BarsState, batch) {
    const orders: (BuyInput | SellInput)[] = [];
    let bar: Bar | undefined;
    for (const b of batch.bars) {
      if (b.symbol === SYMBOL) bar = b;
    }
    if (bar === undefined) return orders;
    const c = BigInt(bar.c);
    closes.push(c);
    if (closes.length > WIN) closes.shift();
    barCount += 1;

    const held = _state.positions.get(SYMBOL);
    if (held !== undefined) {
      const value = _state.value(SYMBOL, held.qty);
      const cost = held.cost;
      const armBps = isFallback ? FB_ARM_BPS : ARM_BPS;
      const trailBps = isFallback ? FB_TRAIL_BPS : TRAIL_BPS;
      const maxHold = isFallback ? FB_MAX_HOLD : MAX_HOLD;
      if (value > peak) peak = value;
      let sell = false;
      if (value * 10_000n <= cost * (10_000n - SL_BPS)) {
        sell = true; // stop-loss: value <= 99% of cost
      } else {
        if (value * 10_000n >= cost * (10_000n + armBps)) armed = true;
        if (armed && value * 10_000n <= peak * (10_000n - trailBps)) {
          sell = true; // trailing stop: pullback from the peak value
        } else if (barCount - entryBar >= maxHold) {
          sell = true; // time-stop
        }
      }
      if (sell) {
        // No orders on the last batch: they are rejected after_end and the
        // final flatten sells the position anyway.
        if (barCount < TOTAL_BARS) {
          orders.push({ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS });
        }
        if (isFallback) fbTrades += 1;
        else deepTrades += 1;
        lastExitBar = barCount;
        entryBar = -1;
        peak = 0n;
        armed = false;
        isFallback = false;
      }
    } else if (barCount >= MIN_BARS && barCount - lastExitBar >= COOLDOWN && barCount <= LAST_ENTRY_BAR) {
      // Only enter when the cash can fund a buy the market accepts: below the
      // minimum notional the order is refused (below_min_notional) and the
      // reply is wasted. In dev the cash is ~$1,000, far above the $1 floor,
      // so this never binds there; it guards the live race after a bad loss.
      const minNotional = BigInt(_state.hello.fees.min_notional_quote_units);
      if (_state.cash < minNotional) {
        prevClose = c;
        return orders;
      }
      const useFallback = barCount >= FALLBACK_BAR && deepTrades === 0 && fbTrades === 0;
      const dipBps = useFallback ? SHALLOW_DIP_BPS : DEEP_DIP_BPS;
      let max = closes[0];
      for (const x of closes) if (x > max) max = x;
      const dipOk = (max - c) * 10_000n >= max * dipBps;
      const bounceOk = prevClose !== null && c > prevClose;
      let lo = c;
      const start = closes.length > LOW_WIN ? closes.length - LOW_WIN : 0;
      for (let k = start; k < closes.length; k++) if (closes[k] < lo) lo = closes[k];
      const riseOk = c * 10_000n >= lo * (10_000n + RISE_BPS);
      if (dipOk && bounceOk && riseOk) {
        // No orders on the last batch (see the sell branch above).
        if (barCount < TOTAL_BARS) {
          orders.push({ side: 'buy', symbol: SYMBOL, notional_quote_units: _state.cash, max_slippage_bps: MAX_SLIPPAGE_BPS });
        }
        entryBar = barCount;
        peak = 0n;
        armed = false;
        isFallback = useFallback;
      }
    }
    prevClose = c;
    return orders;
  },
});
