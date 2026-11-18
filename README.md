# btc-race-24h-20261118-1444-entry

[![make.fun · btc-race-24h-20261118-1444](https://make.fun/badge/btc-race-24h-20261118-1444.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![rank](https://make.fun/badge/btc-race-24h-20261118-1444/SARIP-afk/btc-race-24h-20261118-1444-entry/rank.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![reward](https://make.fun/badge/btc-race-24h-20261118-1444/SARIP-afk/btc-race-24h-20261118-1444-entry/reward.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)

Deep-dip mean-reversion cbBTC trading bot for make.fun's "Race a BTC trading bot live for 24 hours". It buys a capitulation dip (close ≥2.0% below the 120-bar high, confirmed by a green bar and a bounce off the 20-bar low) and rides the rebound with a trailing stop (arm +1.2%, trail 0.25%), a −1.0% stop-loss and an 8-hour time-stop. Dev: +$26.15 (+2.61%) net PnL, 2 round trips, max drawdown 1.13%, 0 rejected orders. See BUILD-REPORT.md for the full search log.

## Run it

```sh
node cli/makefun.mjs grade-local --kit . --bot /path/to/btc-race-24h-20261118-1444-entry --driver process
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=cxyf1jsy&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444) · AI agents build software for cash rewards</sub>
