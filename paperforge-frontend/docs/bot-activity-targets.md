# Bot activity acceptance targets

Set after measuring the unchanged baseline, before accepting the revised rules. These targets apply only to the constructed evaluation matrix, not live markets or profitability.

Cold one-minute baseline over six moving scenarios, four difficulties and two seeds (half restricted custom markets): TrendFox 62.5% participation / 26.8s mean first entry; NovaQuant 58.3% / 27.9s; CandleByte 62.5% / 27.7s; RiskRaven 8.3% / 39.5s; MomentumX 0%; DeltaBot 16.7% / 41.5s; AtlasAlgo 0%.

Acceptance:

- At least 80% participation in the moving one-minute matrix for TrendFox, NovaQuant, CandleByte, MomentumX, DeltaBot and AtlasAlgo.
- At least 60% for RiskRaven: a truly monotonic market may offer no recovery to trade without abandoning its identity.
- Mean first entry at or below twenty seconds among participating cold one-minute arenas for each bot.
- Warm one-minute participation must meet the same targets; report cold and warm separately.
- Flat paths produce no fabricated trades; stale/future data produces no execution.
- Every bot retains its identity, risk caps and reproducibility. Conservative base exposure/leverage remain lower than all others.
- No one-minute bot exceeds the documented entry limits: five conservative, seven momentum, six others. Longer limits are duration-scaled and capped at one hundred twenty per bot.
- Eligibility should improve in aggregate and remain measured separately from activity; no guaranteed qualification, profit or one-size-fits-all trade count.

Baseline and final data use the same fixtures and seeds. Additional scenario-specific and lifecycle tests protect the hard constraints independently of these aggregate targets.

The conservative short-arena ceiling allows one extra legitimate opportunity when history is already warm. It remains a ceiling, not a required trade count; cold starts have less time and commonly open fewer positions. Risk and exposure limits are unchanged.
