# Synthetic bot eligibility results

Constructed-scenario measurements, not predictions of live-market success. Each cell shows eligible arenas out of eighteen and the rounded percentage. Six paths (trend, range, breakout, reversal, volatility expansion and flat) are each evaluated with three seeds. Flat arenas intentionally remain ineligible.

Allocation: $1,000. Eligibility: $500 cumulative margin and at least one opened trade, using the unchanged competition rule.

## 1-minute arenas, pre-arena history available

| Bot | Easy | Medium | Hard | Expert |
| --- | --- | --- | --- | --- |
| TrendFox | 15/18 (83%) | 15/18 (83%) | 15/18 (83%) | 15/18 (83%) |
| NovaQuant | 15/18 (83%) | 15/18 (83%) | 15/18 (83%) | 15/18 (83%) |
| CandleByte | 14/18 (78%) | 13/18 (72%) | 13/18 (72%) | 15/18 (83%) |
| RiskRaven | 4/18 (22%) | 9/18 (50%) | 7/18 (39%) | 4/18 (22%) |
| MomentumX | 6/18 (33%) | 12/18 (67%) | 12/18 (67%) | 12/18 (67%) |
| DeltaBot | 4/18 (22%) | 9/18 (50%) | 9/18 (50%) | 6/18 (33%) |
| AtlasAlgo | 8/18 (44%) | 12/18 (67%) | 12/18 (67%) | 14/18 (78%) |

## 1-minute arenas, cold start without history

| Bot | Easy | Medium | Hard | Expert |
| --- | --- | --- | --- | --- |
| TrendFox | 11/18 (61%) | 12/18 (67%) | 12/18 (67%) | 12/18 (67%) |
| NovaQuant | 12/18 (67%) | 14/18 (78%) | 15/18 (83%) | 15/18 (83%) |
| CandleByte | 12/18 (67%) | 11/18 (61%) | 11/18 (61%) | 15/18 (83%) |
| RiskRaven | 0/18 (0%) | 3/18 (17%) | 3/18 (17%) | 3/18 (17%) |
| MomentumX | 0/18 (0%) | 1/18 (6%) | 1/18 (6%) | 1/18 (6%) |
| DeltaBot | 1/18 (6%) | 7/18 (39%) | 7/18 (39%) | 11/18 (61%) |
| AtlasAlgo | 9/18 (50%) | 9/18 (50%) | 9/18 (50%) | 14/18 (78%) |

## 10-minute arenas, pre-arena history available

| Bot | Easy | Medium | Hard | Expert |
| --- | --- | --- | --- | --- |
| TrendFox | 15/18 (83%) | 15/18 (83%) | 15/18 (83%) | 15/18 (83%) |
| NovaQuant | 15/18 (83%) | 15/18 (83%) | 15/18 (83%) | 15/18 (83%) |
| CandleByte | 15/18 (83%) | 15/18 (83%) | 15/18 (83%) | 15/18 (83%) |
| RiskRaven | 12/18 (67%) | 12/18 (67%) | 12/18 (67%) | 12/18 (67%) |
| MomentumX | 9/18 (50%) | 12/18 (67%) | 12/18 (67%) | 12/18 (67%) |
| DeltaBot | 15/18 (83%) | 15/18 (83%) | 15/18 (83%) | 15/18 (83%) |
| AtlasAlgo | 12/18 (67%) | 15/18 (83%) | 15/18 (83%) | 15/18 (83%) |

## Interpretation

- Warmup materially affects one-minute arenas. Mean reversion needs historical variation and a recovering deviation; conservative entries need stronger agreement. Cold starts leave less time for cumulative participation.
- Selective bots are never forced into unrelated trades. Mean-reversion misses occur when the reference mean slopes too strongly, the recovery does not cover fees, or too few valid entries remain before the deadline.
- Difficulty changes decision opportunities and exit timing. A faster cadence can catch a different trade, so eligibility need not rise monotonically with difficulty.
- Ten-minute arenas offer more opportunity, but fees, losses and missing signals still constrain participation.
- The deliberately moving toy paths do not establish predictive skill, live profitability, or a target production qualification rate.

Per-arena margin, fees, trade counts and last-decision reasons are in [bot-evaluation.json](bot-evaluation.json). Regenerate both reports with `npm run evaluate:bots -- --write`.
