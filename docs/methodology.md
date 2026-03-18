# Methodology

## What we analyze

Why YO? analyzes wallet balances, productive DeFi positions, YO vault allocations, and public risk mappings. The deterministic engine computes all scores first. Narrative explanation is layered on top later.

## How buckets work

We compare only inside three buckets:

- USD bucket -> yoUSD
- ETH bucket -> yoETH
- BTC bucket -> yoBTC

We do not compare ETH savings to yoUSD or BTC savings to yoETH.

## Risk scores

- A = 1
- B = 2
- C = 3
- D = 4
- Unknown = 3.5

Unknown is a conservative middle-high penalty. It is not safe, and it is not automatically the worst case.

## Core formulas

`TV_b = Σ usd_i + Σ usd_k`

`DIV_b = Σ usd_i`

`IAV_b = Σ usd_k`

`ISR_b = IAV_b / TV_b`

`WRS_b = Σ w_i * r_i`

`HRE_b = Σ_{r_i >= 3} usd_i / DIV_b`

`URE_b = Σ_{risk missing} usd_i / DIV_b`

`Coverage_b = 1 - URE_b`

`HHI_b = Σ_p u_p^2`

`SPS_b = 100 * (1 - Penalty_b)`

`Penalty_b = a*norm(WRS_b) + b*HRE_b + c*norm(HHI_b) + d*norm(Complexity_b) + e*URE_b + f*ISR_b`

## Idle assets

Idle stablecoins, idle ETH, and idle BTC are handled separately from protocol-risk metrics. They power:

- idle capital available
- idle share
- yield opportunity estimates
- suggested amount presets
- ranker boost for unproductive capital

## Ranker

`Score_b = 0.30*RRI + 0.22*HRR + 0.14*SSI + 0.08*CI + 0.08*SG + 0.05*SIM + 0.13*IOG - 0.18*UP - 0.08*SizePenalty`

The final score is clamped to `[0,1]`.

## Unknown-risk policy

- above 40% unknown: no strong recommendation
- above 60% unknown: informational only

The UI should explicitly say when public risk coverage is incomplete.

## Visualizations

- before vs after bars
- coverage bar
- position simplification visual
- optional composition comparison
- idle vs invested split

## Caveats

- Public risk coverage in DeFi is incomplete.
- Some YO underlying allocations can remain unknown.
- Savings score is heuristic.
- Yield opportunity estimates are informational only.
