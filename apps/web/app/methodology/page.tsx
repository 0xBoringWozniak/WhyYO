"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { defaultMethodologyResponse } from "@whyyo/shared";

import { Card } from "../../components/ui";

const methodologyCards = [
  {
    title: "What the engine is solving",
    body:
      "Why YO? evaluates each bucket separately and looks for the best next move inside that bucket instead of forcing one portfolio-wide verdict.",
  },
  {
    title: "How intents are chosen",
    body:
      "Every recommendation is classified as risk improvement, diversification improvement, or idle deployment. Idle capital is treated as a valid product case, not as missing context.",
  },
  {
    title: "How trust is handled",
    body:
      "Low coverage softens wording and CTA pressure, but it does not erase structural improvements that are directly measurable from the data.",
  },
  {
    title: "How CTA works",
    body:
      "Strength reflects usefulness, coverage reflects trust, and actionability controls how hard the app should push the move.",
  },
];

const recommendationStates = [
  {
    title: "Migration",
    body: "A productive bucket where YO improves covered bucket quality enough to justify a move recommendation.",
  },
  {
    title: "Idle opportunity",
    body: "An idle or mostly idle bucket where the main benefit is putting capital to work.",
  },
  {
    title: "Informational only",
    body: "A visible comparison with structural signal, but not enough trust coverage for a strong push.",
  },
  {
    title: "Already in YO / no incremental improvement",
    body: "A neutral state where the user is already materially allocated or an extra move does not improve the bucket enough.",
  },
];

const PRETTY_FORMULAS: Record<string, React.ReactNode> = {
  bucket_size_usd: <>TV<sub>b</sub> = Σ USD<sub>productive</sub> + Σ USD<sub>idle</sub></>,
  idle_asset_value_usd: <>IAV<sub>b</sub> = Σ USD<sub>idle</sub></>,
  idle_share_pct: <>ISR<sub>b</sub> = IAV<sub>b</sub> / TV<sub>b</sub></>,
  weighted_risk_score: <>WRS<sub>b</sub> = Σ (weight<sub>i</sub> × risk<sub>i</sub>)</>,
  high_risk_exposure_pct: <>HRE<sub>b</sub> = Σ USD<sub>high-risk</sub> / DIV<sub>b</sub></>,
  unknown_risk_exposure_pct: <>URE<sub>b</sub> = Σ USD<sub>unknown</sub> / DIV<sub>b</sub></>,
  risk_coverage_pct: <>Coverage<sub>b</sub> = 1 − URE<sub>b</sub></>,
  protocol_concentration_hhi: <>HHI<sub>b</sub> = Σ protocol_share<sup>2</sup></>,
  position_count: <>Npos<sub>b</sub> = count(bucket positions)</>,
  protocol_overlap_pct: <>PO<sub>b</sub> = Σ min(user_share<sub>p</sub>, yo_share<sub>p</sub>)</>,
  savings_profile_score:
    <>SPS<sub>b</sub> = 100 × (1 − weighted penalty from risk, high-risk share, concentration, complexity, unknown risk, and idle share)</>,
  idle_yield_opportunity_usd: <>IYO<sub>b</sub> = IAV<sub>b</sub></>,
  estimated_annual_yield_opportunity_usd: <>YCO<sub>b</sub> = IAV<sub>b</sub> × APY<sub>yo</sub></>,
};

const extraProductMetrics = [
  {
    id: "suggested_amount",
    label: "Suggested amount",
    description: "The next move size the engine thinks is worth evaluating inside the bucket.",
    formula: <>Suggested amount = next move size capped by idle-first and productive-bucket logic</>,
    units: "USD",
    whereUsed: ["recommendation card", "execution path"],
    caveat: "Visible even when the recommendation is cautious or not supported as a direct CTA.",
  },
  {
    id: "trust_index",
    label: "Trust index",
    description: "A compact user-facing signal for how comfortable the UI should be with the recommendation framing.",
    formula: <>Trust index = confidence + actionability compressed into Major / Minor / Low</>,
    units: "label",
    whereUsed: ["recommendation card", "trust layer"],
    caveat: "Major = actionable with high confidence. Minor = actionable with medium confidence. Low = cautious or suppressed.",
  },
  {
    id: "diversification_score",
    label: "Diversification",
    description: "A user-facing view of how spread out the productive bucket is across protocols.",
    formula: <>Diversification = (1 − HHI<sub>b</sub>) × 100</>,
    units: "percent",
    whereUsed: ["recommendation card", "bucket overview", "hero summary"],
    caveat: "Higher is more diversified.",
  },
  {
    id: "vault_high_risk",
    label: "Vault high-risk",
    description: "Share of the target YO vault allocated to positions mapped to risk score 3 or higher.",
    formula: <>Vault high-risk = HRE<sub>yo</sub></>,
    units: "percent",
    whereUsed: ["recommendation card", "trust layer"],
    caveat: "Lower is better. This helps users see how aggressive the target vault is internally.",
  },
  {
    id: "existing_yo_share",
    label: "Existing YO share",
    description: "How much of the current bucket is already allocated to the same YO vault.",
    formula: <>Existing YO share = USD<sub>current in target YO</sub> / TV<sub>b</sub></>,
    units: "percent",
    whereUsed: ["recommendation card", "trust layer"],
    caveat: "High values raise the bar for incremental recommendations.",
  },
  {
    id: "vault_apy",
    label: "Vault APY",
    description: "Current APY read for the target YO vault at the moment of the scan.",
    formula: <>Vault APY = live YO snapshot APY</>,
    units: "percent",
    whereUsed: ["recommendation card", "idle profile"],
    caveat: "Used as an informational input, not a promise.",
  },
];

const prettifyUsedIn = (items: string[]) => items.slice(0, 3).join(" • ");

export default function MethodologyPage() {
  const router = useRouter();
  const sections = defaultMethodologyResponse.doc.sections;
  const metricCards = defaultMethodologyResponse.registry.filter(
    (metric) => metric.shownInUi || metric.audience.includes("user"),
  );
  const [returnTo, setReturnTo] = React.useState<string | null>(null);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setReturnTo(params.get("returnTo"));
  }, []);

  const handleBack = React.useCallback(() => {
    const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    const liveReturnTo = params?.get("returnTo") ?? returnTo;
    if (liveReturnTo) {
      router.push(liveReturnTo);
      return;
    }
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/?resume=1");
  }, [returnTo, router]);

  return (
    <main className="mx-auto max-w-[1500px] space-y-10 px-6 py-10 lg:px-10">
      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-5">
          <div className="text-sm uppercase tracking-[0.24em] text-white/45">Methodology</div>
          <h1 className="max-w-4xl text-5xl font-semibold leading-tight text-white md:text-6xl">
            How WHY YO? scores your next move
          </h1>
          <p className="max-w-3xl text-lg leading-8 text-white/68">
            The engine is deterministic. It compares your current bucket with YO using risk, diversification, idle
            deployment, and trust-aware coverage rules, then decides how strong the action should be.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex rounded-full bg-lime px-6 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-black"
            >
              Back to dashboard
            </button>
          </div>
        </div>

        <Card className="flex h-full flex-col space-y-4">
          <div className="text-sm uppercase tracking-[0.24em] text-white/45">Reading the output</div>
          <p className="text-base leading-8 text-white/68">
            Higher diversification and savings score are better. Lower weighted risk, lower high-risk exposure, and
            lower unknown exposure are better. Idle metrics tell you how much capital is still undeployed.
          </p>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        {methodologyCards.map((card) => (
          <Card key={card.title} className="flex h-full flex-col space-y-3">
            <div className="text-xl font-semibold text-white">{card.title}</div>
            <p className="text-base leading-7 text-white/68">{card.body}</p>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="flex h-full flex-col space-y-4">
          <div className="text-sm uppercase tracking-[0.24em] text-white/45">Recommendation states</div>
          <div className="grid gap-4">
            {recommendationStates.map((card) => (
              <div key={card.title} className="rounded-[24px] border border-white/8 bg-black/35 p-5">
                <div className="text-lg font-semibold text-white">{card.title}</div>
                <p className="mt-2 text-base leading-7 text-white/65">{card.body}</p>
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-4">
          {sections
            .filter((section) =>
              ["what-we-analyze", "how-buckets-work", "ranking", "limitations"].includes(section.id),
            )
            .map((section) => (
              <Card key={section.id} className="flex h-full flex-col space-y-3">
                <div className="text-xs uppercase tracking-[0.18em] text-white/45">{section.title}</div>
                <p className="text-base leading-8 text-white/68">{section.body}</p>
              </Card>
            ))}
        </div>
      </section>

      <section className="space-y-5">
        <div className="text-sm uppercase tracking-[0.24em] text-white/45">User-facing metrics</div>
        <div className="grid auto-rows-fr items-stretch gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {[...metricCards, ...extraProductMetrics].map((metric) => (
            <Card key={metric.id} className="flex h-full flex-col space-y-4">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-white/42">{metric.label}</div>
                <div className="mt-2 text-lg font-semibold text-white">{metric.description}</div>
              </div>
              <div className="flex min-h-[112px] flex-col justify-center rounded-[18px] border border-white/8 bg-black/35 px-4 py-3">
                <div className="text-xs uppercase tracking-[0.18em] text-white/42">Formula</div>
                <div className="mt-2 font-mono text-[0.95rem] leading-7 text-white/82">{PRETTY_FORMULAS[metric.id] ?? metric.formula}</div>
              </div>
              <div className="space-y-2 text-sm text-white/66">
                <div>
                  <span className="text-white/42">Units:</span> {metric.units}
                </div>
                <div>
                  <span className="text-white/42">Used in:</span> {prettifyUsedIn(metric.whereUsed)}
                </div>
              </div>
              {("caveats" in metric && metric.caveats.length > 0) || ("caveat" in metric && metric.caveat) ? (
                <div className="mt-auto min-h-[96px] rounded-[18px] border border-white/8 bg-black/35 px-4 py-3 text-sm leading-6 text-white/58">
                  {"caveats" in metric ? metric.caveats[0] : metric.caveat}
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <Card className="flex h-full flex-col space-y-4">
          <div className="text-sm uppercase tracking-[0.24em] text-white/45">Trust and caveats</div>
          <p className="text-base leading-8 text-white/68">
            Coverage reflects how much of the compared productive capital has public risk mapping. Unknown-heavy cases
            stay visible, but the app softens the wording before making strong safety claims.
          </p>
        </Card>
        <Card className="flex h-full flex-col space-y-4">
          <div className="text-sm uppercase tracking-[0.24em] text-white/45">CTA policy</div>
          <p className="text-base leading-8 text-white/68">
            Direct deposit is strongest when there is a clean idle route. Productive recommendations can still explain
            what to move first, but they should not fabricate transactions.
          </p>
        </Card>
        <Card className="flex h-full flex-col space-y-4">
          <div className="text-sm uppercase tracking-[0.24em] text-white/45">Thinking flow</div>
          <p className="text-base leading-8 text-white/68">
            The product opens with WHY YO?, then wallet capture, then a thinking screen while positions, risk, and
            recommendations are computed. The dashboard appears only after the scan payload is ready.
          </p>
        </Card>
      </section>
    </main>
  );
}
