# BUILD-REPORT — btc-race-24h-20261118-1444

**Bounty:** "Race a BTC trading bot live for 24 hours" (bars-replay/v1 race, $250, top 10 paid $60–$15)
**Entry repo:** `~/workspace/makefun/btc-race-24h-20261118-1444-entry/` — bot `main.ts` (Node 22, `vendor/makefun-bars.ts` byte-identical copy of the kit SDK)
**Built:** 2026-11-18 ~23:05–23:50 WIB. **Deadline entri: 19 Nov 03:44 WIB. Race live: 19 Nov 03:59 WIB – 20 Nov 03:59 WIB.**

## Dev score (grade-local, --driver process, verified 2026-11-18 ~23:50 WIB)

| Metric | Value |
|---|---|
| Net PnL | **+$26.149890** |
| Return | **+2.614989%** |
| Max drawdown | 1.13% |
| Sharpe | 0.0386 |
| Trades | 4 orders = **2 round trips, win rate 100%** |
| Fees | $1.618747 |
| Rejected orders | 0 |
| Exposure | 28.5% of the window |
| result_sha256 | `13f121572c11bbb30c23ec82a3f51d91cc919424725255c5d1a251bee808f341` |
| action_log_sha256 | `c6d178bee6d2889cb959b081f2b59fb46fdc75de186092677be1abc697605241` |
| Dev gate (`dev_profitable`, net PnL > $0) | **PASS** |
| Constraints | trades_ok, symbols_ok, drawdown_ok — all true |
| Determinism (L1) | reproduced byte for byte (two runs, identical action logs) |
| Mismatch | only "server harness v26.13.1 vs local v24.22.1" (Node version note, not a failure) |

Trade log (dev):
| # | Buy | Sell | Net |
|---|---|---|---|
| 1 | bar 71 @ ~$63,400 | bar 87 @ ~$64,100 | +$9.95 |
| 2 | bar 119 @ ~$63,700 | bar 513 @ ~$64,900 | +$16.20 |

## Strategy

Deep-dip mean reversion, one position at a time, long only, 100% of cash per trade.

- **Entry** (on a bar's close, filled at the next open): close ≥ **2.0% below the highest close of the last 120 bars** AND close **above the previous close** (one green bar after the dip) AND close **≥5 bps above the lowest close of the last 20 bars** (bounce confirmed). No RSI gate.
- **Exit** (whole position, on a bar's close):
  - **Stop-loss:** value ≤ 99% of cost (−1.0%).
  - **Trailing stop:** once value ≥ 101.2% of cost, sell on a 0.25% pullback from the highest value since entry.
  - **Time-stop:** 480 bars (8 h) held → sell.
- **Cooldown:** 15 bars after a sale before the next entry.
- **Fallback arm** (guardrail insurance, never fires on dev): if no deep dip has traded by bar 720 (half the window), loosen the entry to a 0.8% dip with a scalper's exit (arm +0.6%, trail 0.3%, hold 240 bars), at most ONE fallback trade — so the bot still trades at least once on a live window with no capitulation dip. A second fallback trade was tested and REJECTED (buys the final slide, −$13.23).
- **No entries after bar 1320:** a position opened in the last 120 bars has no time for the exit rules to work and is sold at a loss by the final flatten (on dev, the 1436 entry loses −$5.60). No orders on the last batch (bar 1440): rejected after_end; the flatten sells instead.
- All thresholds are exact bigint ratios (basis points) — deterministic, no clock, no randomness.

## Why this shape (search log)

The dev window FALLS −2.80% (range 3.25%): sharp opening drop, slow grind back up, long range, final slide. The previous race's B1 bot (dip 1.2%) LOSES −$9.98 here — verified by grade-local AND by the exact-fill simulator (byte-identical: −$9.980456, 7 trades, fees $3.196627, max DD 2.48%). Plain EMA-cross trend bots lose −$12 to −$22 on this window (grid: 6 fast × 6 slow × 3 holds). The money is in the two capitulation dips of the opening decline.

| Search step | Best dev |
|---|---|
| B1 default (dip 1.2%, arm 0.6%, trail 0.3%, hold 240) | −$9.98 |
| B1 grid: DIP 40–250 × HOLD 120–1440 × SL 50–150 | +$14.14 (DIP 200, H 360+) |
| Refine ARM 100–300 × TRAIL 10–40 × HOLD 360–1440 | **+$26.15** (DIP 200, ARM 120, TRAIL 25, H 480) |
| Two-mode deep 200 + shallow 80–120 (always on) | +$16.94 — shallow arm adds the bad 1436 trade (−$5.60) |
| Fallback (shallow 80, only after bar 720 if zero deep trades, max 1) | +$26.15 (unchanged on dev — never fires); fallback-only scenario +$2.01 |
| Re-arming fallback (unlimited shallow trades) | −$11.23 fallback-only — REJECTED, capped at 1 |

**Plateau, not a spike:** DIP 190–210 bps × ARM 120–130 bps × TRAIL 20–25 bps all give +$25.05 to +$26.95; the chosen point (DIP 200, ARM 120, TRAIL 25) sits in the middle. ARM 110 is the cliff edge (+$16.58 — arms too early, sells at bar 417 before the peak).

## Honest assessment (vs the board)

- **Dev +$26.15 clears the task's submit bar (+$11.77) by 2.2×** and the dev gate with margin; deterministic, compliant, 0 rejected.
- **BUT the board has moved since the task was written:** rank 1 is now **+$92.30** ("Two-Mode Tranche Racer — DP schedule + Dip-Buyer", 350 trades) and ranks 1–10 are all **+$86–92 DP-fitted schedules** (a precomputed optimal trade table derived from the published dev window, plus a dip-buyer fallback). Ranks 11–16 are +$58–67 (DP + dip mixes). The honest dip-buyer tier starts at rank 17 (+$40.50, 6 trades); this bot's +$26.15 would sit around rank ~26–30.
- **Dev rank does not decide prizes** — only the unseen 24 h live window does. A DP-schedule bot's live behaviour is its hardcoded dev bar indices, which mean nothing on unseen data; its live PnL is essentially luck. This bot is a genuine strategy (2-for-2 winning dip trades on dev, plateau parameters), so its live prospects rest on the live window offering at least one ≥2% capitulation dip (the fallback guarantees ≥1 trade even if it doesn't).
- **Verdict: LAYAK SUBMIT per the task's stated bar (≥ +$11.77).** It is NOT top-1 class in dev (+$92.30 is a DP-fitted artifact, not a beatable strategy bar), so a top-10 live finish is a maybe, not an expectation. Do not present it to syarif as a likely winner.

## Files

- `main.ts` — the bot (Node 22, pure SDK, no dependencies).
- `vendor/makefun-bars.ts` — byte-identical copy of `kit/sdk/makefun-bars.ts`.
- `LICENSE` — MIT.
- This file.
