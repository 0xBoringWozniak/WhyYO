# Why YO

## WHY YO?

**WHY YO?** is a portfolio intelligence layer for DeFi users.
It shows, in simple numbers, how moving capital into **YO** can improve portfolio quality.

Users already hold positions across many chains and protocols.
But most of them still cannot answer simple questions:

- Is my portfolio too risky?
- Am I too concentrated?
- Do I really get better quality if I move funds into YO?

This product gives a clear answer with math, not guesswork.

---

## 1. Vision

DeFi users hold positions across many protocols and chains, but they do not have a clear way to judge risk, diversification, and overall portfolio quality.

Because of that, new allocations are often fragmented, hard to compare, and driven by intuition instead of evidence.

Our vision is simple:
make DeFi allocation decisions as clear as portfolio decisions in mature finance.

---

## 2. Problem

YO is a strong savings product, but users still ask:
**"Why should I move money into YO?"**

The problem is not only access.
The problem is proof.

Users need to see, in a measurable way, how YO can improve their portfolio:

- lower weighted risk
- reduce high-risk exposure
- improve diversification
- simplify fragmented positions
- activate idle capital

Without this, YO is just another vault option.
With this, YO becomes an upgrade users can understand.

---

## 3. Solution & Features

First,  **WHY YO?** scans a wallet, groups positions into simple asset buckets, and compares the current portfolio with YO vaults.

It explains the value of YO through clear before/after metrics.

### Core product features

- **Cross-protocol portfolio scan**  
  Reads wallet balances and DeFi positions across chains.

- **Bucket-based comparison**  
  Compares only similar assets: `USD -> yoUSD`, `ETH -> yoETH`, `BTC -> yoBTC`.

- **Before / after portfolio simulation**  
  Models what changes if part of a bucket moves into YO.

- **Risk and diversification scoring**  
  Measures weighted risk, high-risk share, protocol concentration, and portfolio quality.

- **Actionable recommendation engine**  
  Shows when YO is a strong fit, a weak fit, or only an informational option.

- **Direct deposit handoff**  
  Users can move from insight to YO deposit in one flow.

---

## 4. Methodology

We keep the methodology simple and deterministic.
First we calculate metrics.
Then we explain the result.

### Main rules

- We compare inside asset buckets only.
- We use public risk mappings for DeFi positions.
- Unknown risk is treated conservatively.
- We do not promise returns or safety.

### Key metrics

- **Weighted Risk Score**
  `WRS_b = Σ w_i * r_i`

- **High-Risk Exposure**
  `HRE_b = Σ(r_i >= 3) usd_i / DIV_b`

- **Risk Coverage**
  `Coverage_b = 1 - URE_b`

- **Protocol Concentration**
  `HHI_b = Σ u_p^2`

- **Savings Profile Score**
  `SPS_b = 100 * (1 - Penalty_b)`

### Impact / Trust framework

We rank YO by expected portfolio improvement, not by marketing priority.

We use two simple lenses:

- **Impact** = how much YO improves the portfolio
- **Trust** = how reliable the data is

The rule is simple:
**only 🟢 High Impact + 🟢 High Trust gives a 🟢 High recommendation.**

| Impact | Trust | Final output |
| --- | --- | --- |
| 🟢 High | 🟢 High | 🟢 **High recommendation** |
| 🟢 High | 🔴 Low | 🟡 Medium or cautious recommendation |
| 🔴 Low | 🟢 High | 🟡 Medium or weak recommendation |
| 🔴 Low | 🔴 Low | 🔴 Low or informational only |

In the product:

- **Impact** drives the improvement score
- **Trust** drives confidence and caveats
- **Final output** becomes the recommendation strength and CTA

Trust mainly depends on:

- risk coverage
- protocol matching quality
- strength of the measured signal

---

## 5. YO SDK

The YO SDK is how we turn analysis into action.

We use it to:

- fetch YO vault data in the app
- prepare allowance and approval flows
- execute deposits into YO
- keep the deposit handoff native inside the product

This gives us a clean bridge between **portfolio intelligence** and **capital execution**.
The user does not only learn why YO is useful.
The user can act on it immediately.

---

## 6. Tech Stack

<p>
  <img src="https://cdn.simpleicons.org/nextdotjs/000000" alt="Next.js" height="28" />
  <img src="https://cdn.simpleicons.org/react/61DAFB" alt="React" height="28" />
  <img src="https://cdn.simpleicons.org/typescript/3178C6" alt="TypeScript" height="28" />
  <img src="https://cdn.simpleicons.org/fastify/000000" alt="Fastify" height="28" />
  <img src="https://cdn.simpleicons.org/postgresql/4169E1" alt="PostgreSQL" height="28" />
  <img src="https://cdn.simpleicons.org/redis/DC382D" alt="Redis" height="28" />
  <img src="https://cdn.simpleicons.org/docker/2496ED" alt="Docker" height="28" />
</p>

- **Frontend:** Next.js, React, TypeScript
- **Backend:** Fastify, Node.js
- **Data layer:** PostgreSQL, Redis
- **Infra:** Docker

---

## 7. Future Improvements

- **Full migration UX**  
  Move users from fragmented protocol positions into YO in one guided flow.

- **ML recommendation layer**  
  Add U2I RecSys logic, where users are wallets and items are DeFi protocols and tokens.

- **YO + Exponent**  
  Build a broader allocation layer that can route users across YO and Exponent products.

- **WHY YO? as the ultimate DeFi portfolio layer**  
  Turn Why YO into the main intelligence layer for DeFi: analyze, explain, recommend, migrate, and deploy in one place.
