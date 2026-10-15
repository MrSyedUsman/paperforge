# Competition bot activity verification

Constructed synthetic scenarios; these are activity and accounting checks, not live-market performance or profit predictions. The archived baseline is commit a4bca70. Each run uses the same 224 arenas (1,568 bot results), four difficulties, seven price paths, two seeds, cold/warm starts and one-, ten- and thirty-minute durations. Half use custom allowed markets.

First-entry averages include participating bots only. Margin means cumulative margin committed, not leveraged notional. Fees include opening and closing fees; all positions settle at expiry. Peak exposure is notional. Eligibility remains at least one opened trade and 50% cumulative margin.

## Cold one-minute moving markets

Values show before -> after; monetary values are simulated USD.

| Bot | Participation % | First entry seconds | Opened / closed | Cumulative margin | Eligible % | Fees | Peak notional |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TrendFox | 62.5 -> 100 | 26.8 -> 8.7 | 1.58/1.58 -> 4.5/4.5 | 268.58 -> 604.82 | 29.2 -> 91.7 | 1.22 -> 2.23 | 882.6 -> 1058.47 |
| NovaQuant | 58.3 -> 100 | 27.9 -> 8.3 | 2.33/2.33 -> 6.71/6.71 | 271.96 -> 639.27 | 29.2 -> 95.8 | 1.48 -> 2.96 | 751.88 -> 1350.47 |
| CandleByte | 62.5 -> 100 | 27.7 -> 8.2 | 1.69/1.69 -> 4.75/4.75 | 300.24 -> 695.7 | 31.3 -> 100 | 1.36 -> 2.6 | 971.01 -> 1216.69 |
| RiskRaven | 8.3 -> 66.7 | 39.5 -> 13.7 | 0.15/0.15 -> 2.79/2.79 | 24.99 -> 325.19 | 0 -> 54.2 | 0.06 -> 0.63 | 64.15 -> 338.57 |
| MomentumX | 0 -> 100 | none -> 8.2 | 0/0 -> 4/4 | 0 -> 498.3 | 0 -> 91.7 | 0 -> 0.48 | 0 -> 127.5 |
| DeltaBot | 16.7 -> 100 | 41.5 -> 8.3 | 0.17/0.17 -> 5.46/5.46 | 36 -> 579.56 | 0 -> 87.5 | 0.16 -> 2 | 162 -> 794.93 |
| AtlasAlgo | 0 -> 100 | none -> 12.8 | 0/0 -> 5.17/5.17 | 0 -> 523.47 | 0 -> 77.1 | 0 -> 1.22 | 0 -> 532.44 |

Entry quality counts are averages per arena. Hold counts are scheduler observations, not distinct missed trades.

| Bot | Preferred | Developing | Exploratory | Most common holds after |
| --- | --- | --- | --- | --- |
| TrendFox | 1.06 | 3.31 | 0.13 | Exposure, balance or position capacity prevents another entry: 149; Sampled-price history is warming up: 108; Too little time remains for a meaningful entry: 54 |
| NovaQuant | 0.96 | 5.58 | 0.17 | Arena activity limit reached; managing existing exposure: 299; Sampled-price history is warming up: 168; Exposure, balance or position capacity prevents another entry: 109 |
| CandleByte | 1 | 3.71 | 0.04 | Exposure, balance or position capacity prevents another entry: 330; Sampled-price history is warming up: 144; Too little time remains for a meaningful entry: 66 |
| RiskRaven | 0 | 2.52 | 0.27 | Waiting for an observed recovery toward a recent mean: 587; Exposure, balance or position capacity prevents another entry: 238; Sampled-price history is warming up: 192 |
| MomentumX | 0 | 3.92 | 0.08 | Exposure, balance or position capacity prevents another entry: 186; Sampled-price history is warming up: 96; Too little time remains for a meaningful entry: 48 |
| DeltaBot | 0.1 | 5.23 | 0.13 | Exposure, balance or position capacity prevents another entry: 213; Arena activity limit reached; managing existing exposure: 170; Sampled-price history is warming up: 144 |
| AtlasAlgo | 0 | 2.38 | 2.79 | Waiting for measured price variation with direction: 159; Sampled-price history is warming up: 144; Arena activity limit reached; managing existing exposure: 132 |

## Warm one-minute moving markets

Values show before -> after; monetary values are simulated USD.

| Bot | Participation % | First entry seconds | Opened / closed | Cumulative margin | Eligible % | Fees | Peak notional |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TrendFox | 66.7 -> 100 | 11.8 -> 1.2 | 2.42/2.42 -> 4.67/4.67 | 344.66 -> 583.03 | 31.3 -> 95.8 | 1.57 -> 2.27 | 855.78 -> 1059.19 |
| NovaQuant | 62.5 -> 100 | 12.3 -> 1.3 | 3.31/3.31 -> 6.88/6.88 | 375.02 -> 670.45 | 29.2 -> 97.9 | 2.03 -> 3.19 | 915.26 -> 1433.33 |
| CandleByte | 62.5 -> 100 | 20.9 -> 1.1 | 1.88/1.88 -> 5.48/5.48 | 315.95 -> 720.37 | 31.3 -> 100 | 1.44 -> 2.72 | 916.54 -> 1079.47 |
| RiskRaven | 33.3 -> 66.7 | 4 -> 1.1 | 0.79/0.79 -> 3.42/3.42 | 91.73 -> 342.82 | 2.1 -> 43.8 | 0.23 -> 0.71 | 172.15 -> 313.85 |
| MomentumX | 6.3 -> 100 | 0 -> 1.3 | 0.06/0.06 -> 4.73/4.73 | 7 -> 527.62 | 0 -> 81.3 | 0.01 -> 0.51 | 9.33 -> 129.48 |
| DeltaBot | 31.3 -> 100 | 21.7 -> 0.3 | 0.4/0.4 -> 5.75/5.75 | 68.01 -> 594.45 | 0 -> 97.9 | 0.31 -> 2.07 | 257.23 -> 771.51 |
| AtlasAlgo | 16.7 -> 100 | 0 -> 6 | 0.29/0.29 -> 5.46/5.46 | 29.16 -> 528.61 | 0 -> 87.5 | 0.08 -> 1.29 | 83.32 -> 515.79 |

Entry quality counts are averages per arena. Hold counts are scheduler observations, not distinct missed trades.

| Bot | Preferred | Developing | Exploratory | Most common holds after |
| --- | --- | --- | --- | --- |
| TrendFox | 1.85 | 2.77 | 0.04 | Exposure, balance or position capacity prevents another entry: 215; Too little time remains for a meaningful entry: 43; No developing specialty setup or changed re-entry evidence is available: 28 |
| NovaQuant | 1.77 | 5.08 | 0.02 | Arena activity limit reached; managing existing exposure: 454; Exposure, balance or position capacity prevents another entry: 90; No developing specialty setup or changed re-entry evidence is available: 47 |
| CandleByte | 1.35 | 4.13 | 0 | Exposure, balance or position capacity prevents another entry: 391; Arena activity limit reached; managing existing exposure: 81; Entry cooldown after the previous exit: 68 |
| RiskRaven | 0.54 | 2.88 | 0 | Waiting for an observed recovery toward a recent mean: 574; Exposure, balance or position capacity prevents another entry: 309; Arena activity limit reached; managing existing exposure: 135 |
| MomentumX | 0.06 | 4.5 | 0.17 | Exposure, balance or position capacity prevents another entry: 192; Arena activity limit reached; managing existing exposure: 35; No developing specialty setup or changed re-entry evidence is available: 33 |
| DeltaBot | 0.25 | 5.44 | 0.06 | Exposure, balance or position capacity prevents another entry: 260; Arena activity limit reached; managing existing exposure: 254; No developing specialty setup or changed re-entry evidence is available: 14 |
| AtlasAlgo | 0.33 | 3 | 2.13 | Waiting for measured price variation with direction: 267; Arena activity limit reached; managing existing exposure: 173; Exposure, balance or position capacity prevents another entry: 102 |

## Longer moving markets

Values show before -> after; monetary values are simulated USD.

| Bot | Participation % | First entry seconds | Opened / closed | Cumulative margin | Eligible % | Fees | Peak notional |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TrendFox | 83.3 -> 100 | 41.1 -> 16.6 | 21.01/21.01 -> 24.92/24.92 | 2417.47 -> 2769.91 | 83.3 -> 100 | 10.92 -> 11.88 | 876.8 -> 998.58 |
| NovaQuant | 58.3 -> 100 | 115.8 -> 12.4 | 14.35/14.35 -> 59.35/59.35 | 1528.71 -> 5575.8 | 51 -> 100 | 8.23 -> 26.17 | 626.87 -> 1292.05 |
| CandleByte | 50 -> 100 | 71 -> 13.5 | 10.71/10.71 -> 27.25/27.25 | 1449.39 -> 3275.75 | 49 -> 100 | 6.57 -> 12.42 | 594.85 -> 965.63 |
| RiskRaven | 16.7 -> 66.7 | 45.3 -> 15 | 1.61/1.61 -> 23.75/23.75 | 158.15 -> 2029.63 | 16.7 -> 66.7 | 0.4 -> 4.29 | 83.32 -> 253.69 |
| MomentumX | 2.1 -> 100 | 0 -> 13.3 | 0.02/0.02 -> 18.38/18.38 | 1.67 -> 1317.13 | 0 -> 100 | 0 -> 1.21 | 1.67 -> 98.86 |
| DeltaBot | 50 -> 100 | 80 -> 9.6 | 8.36/8.36 -> 29.8/29.8 | 987.43 -> 3033.3 | 49 -> 100 | 4.47 -> 11.04 | 528.94 -> 833.88 |
| AtlasAlgo | 20.8 -> 100 | 68 -> 34.1 | 2.49/2.49 -> 27.88/27.88 | 244.6 -> 2220.43 | 11.5 -> 100 | 0.73 -> 5.75 | 82.2 -> 365.32 |

Entry quality counts are averages per arena. Hold counts are scheduler observations, not distinct missed trades.

| Bot | Preferred | Developing | Exploratory | Most common holds after |
| --- | --- | --- | --- | --- |
| TrendFox | 19.08 | 5.74 | 0.09 | Exposure, balance or position capacity prevents another entry: 5400; Entry cooldown after the previous exit: 1463; No developing specialty setup or changed re-entry evidence is available: 846 |
| NovaQuant | 11.46 | 47.9 | 0 | Entry cooldown after the previous exit: 4903; No developing specialty setup or changed re-entry evidence is available: 1034; Exposure, balance or position capacity prevents another entry: 498 |
| CandleByte | 6.6 | 20.57 | 0.07 | Exposure, balance or position capacity prevents another entry: 5613; Entry cooldown after the previous exit: 2434; No developing specialty setup or changed re-entry evidence is available: 1502 |
| RiskRaven | 1.09 | 22.63 | 0.03 | Waiting for an observed recovery toward a recent mean: 8609; Exposure, balance or position capacity prevents another entry: 6277; Entry cooldown after the previous exit: 3107 |
| MomentumX | 0.02 | 18.27 | 0.08 | Exposure, balance or position capacity prevents another entry: 6089; Entry cooldown after the previous exit: 1811; No developing specialty setup or changed re-entry evidence is available: 1023 |
| DeltaBot | 3.76 | 26.02 | 0.02 | Exposure, balance or position capacity prevents another entry: 5916; Entry cooldown after the previous exit: 2701; No developing specialty setup or changed re-entry evidence is available: 397 |
| AtlasAlgo | 2.15 | 17.79 | 7.94 | Waiting for measured price variation with direction: 6025; Entry cooldown after the previous exit: 3124; Exposure, balance or position capacity prevents another entry: 299 |

## Acceptance and limitations

All moving-market participation targets passed: at least 80% for six bots and 60% for recovery-focused RiskRaven, for both cold and warm one-minute runs. Participating cold-start bots average at most 20 seconds to first entry. Flat paths produce no entries or fees. One-minute entry caps are five for MomentumX, seven for NovaQuant and six for the others.

RiskRaven can remain inactive without a recovery signal; eligibility is not guaranteed. Developing and exploratory entries reduce margin and leverage. More participation can increase fees and losses. Warm starts use previously observed data; cold starts require actual samples. These fixtures do not cover every live feed or market regime.

Reproduce the current run with `node --experimental-strip-types scripts/evaluate-bot-activity.mjs --label=after --write`, then `node scripts/report-bot-activity.mjs`. The before JSON is an archived baseline, not produced by the updated engine.

## Application verification

- Frontend lint, TypeScript checks, all 76 tests and production build passed.
- Backend lint and production build passed; all 236 tests passed. Backend lint retains six existing test-file warnings.
- Cross-application evidence checks passed for 24 Debrief snapshots and 20 Radar snapshots, covering all seven bots, all difficulties, financial reconciliation and recognized decision metadata.
- Browser verification uses intercepted synthetic market data, not a live exchange. It exercises the actual one-minute timer, manual orders, reload, mobile bot details, settlement, normal-wallet separation and absence of AI requests or console errors.
- Authentication, login, backend bootstrap, credentials, deployment and AI generation settings were not changed.
