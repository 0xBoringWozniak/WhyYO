"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { METHODOLOGY_SECTION_IDS } from "../../components/methodology-link";
import { RECOMMENDATION_CONFIDENCE_CONFIG } from "../../lib/recommendation-confidence";

type FaqItem = {
  id: string;
  question: React.ReactNode;
  answer: React.ReactNode;
};

const metricQuestionClass = "font-semibold text-lime";

const methodologyFaq: FaqItem[] = [
  {
    id: "engine",
    question: "How WHY YO works?",
    answer: (
      <p>
        WHY YO reads the wallet&apos;s onchain balances and productive DeFi positions, then groups them into{" "}
        <span className={metricQuestionClass}>USD</span>, <span className={metricQuestionClass}>ETH</span>, and{" "}
        <span className={metricQuestionClass}>BTC</span> buckets. Each bucket is scored on risk, concentration, idle
        capital, and structure before being compared with the matching YO vault. A recommendation becomes stronger when
        the modeled portfolio metrics improve and the trust layer supports the move, which is summarized by{" "}
        <span className={metricQuestionClass}>Confidence</span>.
      </p>
    ),
  },
  {
    id: "buckets",
    question: "How do buckets work?",
    answer: (
      <p>
        Every position is assigned to a single bucket. Stablecoins are compared only with{" "}
        <span className={metricQuestionClass}>yoUSD</span>, ETH-like assets only with{" "}
        <span className={metricQuestionClass}>yoETH</span>, and BTC-like assets only with{" "}
        <span className={metricQuestionClass}>yoBTC</span>. This keeps recommendations comparable inside the same
        asset family instead of mixing very different risk and yield profiles across buckets.
      </p>
    ),
  },
  {
    id: "ranking",
    question: "How are recommendations ranked?",
    answer: (
      <div className="space-y-3">
        <p>The engine scores each opportunity under three possible intents and keeps the one that fits best:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <span className={metricQuestionClass}>Risk improvement</span> favors lower weighted risk, lower high-risk
            exposure, stronger savings score, cleaner structure, and fewer unknown-heavy outcomes.
          </li>
          <li>
            <span className={metricQuestionClass}>Diversification improvement</span> favors a bucket that becomes less
            concentrated across protocols and strategies without creating a clearly worse risk profile.
          </li>
          <li>
            <span className={metricQuestionClass}>Idle deployment</span> favors meaningful idle balances that can move
            into productive exposure with better yield potential and acceptable trust conditions.
          </li>
        </ul>
      </div>
    ),
  },
  {
    id: "suggested-amount-overview",
    question: "What does Suggested amount mean?",
    answer: (
      <p>
        <span className={metricQuestionClass}>Suggested amount</span> is a deterministic sizing output, not a manual
        guess. The engine evaluates several presets such as idle-first, high-risk-only, combined, 25%, 50%, and
        full-bucket, then chooses the first preset that best matches the recommendation logic. The final number is
        bounded by the real bucket size, with a minimum floor of <span className={metricQuestionClass}>$250</span>{" "}
        unless the whole bucket is smaller.
      </p>
    ),
  },
  {
    id: "limitations",
    question: "What are the main limitations?",
    answer: (
      <p>
        Public risk data in DeFi is still incomplete, wrapped assets can hide underlying exposures, and live yield is
        only a snapshot. That means some positions carry unknown risk that cannot be measured perfectly. When coverage
        is weak or the target vault looks too aggressive, the system reduces recommendation strength instead of making a
        stronger claim than the data can support.
      </p>
    ),
  },
];

const metricFaq: FaqItem[] = [
  {
    id: METHODOLOGY_SECTION_IDS.riskCoverage,
    question: <span className={metricQuestionClass}>Risk coverage</span>,
    answer: (
      <p>
        <span className={metricQuestionClass}>Risk coverage</span> shows how much of the productive DeFi capital in a
        bucket has public risk mapping. It is calculated as the covered share of productive positions, so idle balances
        do not inflate it. Higher coverage increases trust in the recommendation, while low coverage can directly push{" "}
        <span className={metricQuestionClass}>Confidence</span> down.
      </p>
    ),
  },
  {
    id: METHODOLOGY_SECTION_IDS.diversification,
    question: <span className={metricQuestionClass}>Diversification</span>,
    answer: (
      <div className="space-y-3">
        <p>
          <span className={metricQuestionClass}>Diversification</span> tells you how broadly a bucket is spread across
          protocols instead of being concentrated in one or two places. Higher diversification means the bucket depends
          less on a single protocol dominating the outcome.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            It is derived from <span className={metricQuestionClass}>protocol concentration</span>. As concentration
            falls, diversification rises.
          </li>
          <li>
            Only productive DeFi positions are used for this calculation, because idle balances do not create protocol
            diversification.
          </li>
          <li>
            It affects both recommendation ranking and <span className={metricQuestionClass}>Confidence</span> through
            the portfolio-impact side of the model.
          </li>
        </ul>
      </div>
    ),
  },
  {
    id: METHODOLOGY_SECTION_IDS.weightedRisk,
    question: <span className={metricQuestionClass}>Weighted risk (WRS)</span>,
    answer: (
      <p>
        <span className={metricQuestionClass}>Weighted risk</span> is the capital-weighted average risk score of the
        productive DeFi positions in the bucket. Larger positions influence the result more than smaller ones, and idle
        balances are excluded entirely. Lower weighted risk means the active part of the bucket is safer on average,
        which strengthens both ranking and portfolio impact.
      </p>
    ),
  },
  {
    id: METHODOLOGY_SECTION_IDS.highRiskExposure,
    question: <span className={metricQuestionClass}>High-risk exposure (HRE)</span>,
    answer: (
      <p>
        <span className={metricQuestionClass}>High-risk exposure</span> measures what share of productive DeFi capital
        sits in positions mapped to risk score <span className={metricQuestionClass}>3 or higher</span>. It is
        calculated as a percent of the productive bucket, not of the whole wallet. Lower high-risk exposure means less
        capital is concentrated in the riskiest slice of the bucket, which improves the portfolio-impact side of the
        recommendation.
      </p>
    ),
  },
  {
    id: METHODOLOGY_SECTION_IDS.savingsScore,
    question: <span className={metricQuestionClass}>Savings score (SPS)</span>,
    answer: (
      <p>
        <span className={metricQuestionClass}>Savings score</span> is a composite 0-100 quality metric for the bucket.
        It combines weighted risk, high-risk share, concentration, structural complexity, unknown-risk drag, and idle
        drag into one summary number. Higher savings score means the bucket looks cleaner and more efficient under the
        current model, and improvements here strengthen both recommendation ranking and portfolio impact.
      </p>
    ),
  },
  {
    id: METHODOLOGY_SECTION_IDS.confidence,
    question: <span className={metricQuestionClass}>Confidence</span>,
    answer: (
      <div className="space-y-3">
        <p>
          <span className={metricQuestionClass}>Confidence</span> tells you how strongly the system stands behind a
          recommendation after checking both modeled improvement and trust conditions. It is the final summary of
          whether a move looks not only better on paper, but also well-supported by the available data.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Portfolio impact is built from four deltas: Weighted risk{" "}
            <span className={metricQuestionClass}>{RECOMMENDATION_CONFIDENCE_CONFIG.portfolioWeights.weightedRisk}%</span>,
            Savings score{" "}
            <span className={metricQuestionClass}>{RECOMMENDATION_CONFIDENCE_CONFIG.portfolioWeights.savingsScore}%</span>,
            Diversification{" "}
            <span className={metricQuestionClass}>{RECOMMENDATION_CONFIDENCE_CONFIG.portfolioWeights.diversification}%</span>,
            and High-risk exposure{" "}
            <span className={metricQuestionClass}>{RECOMMENDATION_CONFIDENCE_CONFIG.portfolioWeights.highRiskExposure}%</span>.
          </li>
          <li>
            Trust is built from Coverage{" "}
            <span className={metricQuestionClass}>{RECOMMENDATION_CONFIDENCE_CONFIG.trustWeights.coverage}%</span>,
            Vault high-risk{" "}
            <span className={metricQuestionClass}>{RECOMMENDATION_CONFIDENCE_CONFIG.trustWeights.vaultHighRisk}%</span>,
            Overlap <span className={metricQuestionClass}>{RECOMMENDATION_CONFIDENCE_CONFIG.trustWeights.overlap}%</span>,
            and YO share{" "}
            <span className={metricQuestionClass}>{RECOMMENDATION_CONFIDENCE_CONFIG.trustWeights.yoShare}%</span>.
          </li>
          <li>
            Each portfolio delta is converted into a ratio score in the range{" "}
            <span className={metricQuestionClass}>[-1, 1]</span>: lower-is-better metrics use{" "}
            <span className={metricQuestionClass}>before / after - 1</span>, higher-is-better metrics use{" "}
            <span className={metricQuestionClass}>after / before - 1</span>.
          </li>
          <li>
            Hard-low rules apply before banding: Coverage{" "}
            <span className={metricQuestionClass}>{"<"}{RECOMMENDATION_CONFIDENCE_CONFIG.hardLowRules.coverageMin}%</span>,
            too many red trust metrics, or too many non-improving portfolio deltas force{" "}
            <span className={metricQuestionClass}>LOW</span>.
          </li>
          <li>
            Outside hard-low, portfolio impact is <span className={metricQuestionClass}>HIGH</span> above{" "}
            <span className={metricQuestionClass}>{RECOMMENDATION_CONFIDENCE_CONFIG.bandThresholds.impact.highMin}</span>,
            <span className={metricQuestionClass}> MEDIUM</span> above{" "}
            <span className={metricQuestionClass}>{RECOMMENDATION_CONFIDENCE_CONFIG.bandThresholds.impact.mediumMin}</span>,
            otherwise <span className={metricQuestionClass}>LOW</span>. The final label becomes{" "}
            <span className={metricQuestionClass}>HIGH</span> only when both trust and impact are strong; otherwise
            trust can cap the outcome at <span className={metricQuestionClass}>MEDIUM</span> or{" "}
            <span className={metricQuestionClass}>LOW</span>.
          </li>
        </ul>
      </div>
    ),
  },
  {
    id: METHODOLOGY_SECTION_IDS.coverage,
    question: <span className={metricQuestionClass}>Coverage</span>,
    answer: (
      <p>
        <span className={metricQuestionClass}>Coverage</span> is the trust-layer reading of the same underlying risk
        coverage. It is interpreted with thresholds: above <span className={metricQuestionClass}>60%</span> is green,{" "}
        <span className={metricQuestionClass}>30-60%</span> is yellow, and below{" "}
        <span className={metricQuestionClass}>30%</span> is red. Low coverage weakens trust in the recommendation and
        can trigger a hard-low outcome for <span className={metricQuestionClass}>Confidence</span>.
      </p>
    ),
  },
  {
    id: METHODOLOGY_SECTION_IDS.vaultHighRisk,
    question: <span className={metricQuestionClass}>Vault high-risk</span>,
    answer: (
      <p>
        <span className={metricQuestionClass}>Vault high-risk</span> measures what share of the target YO vault is
        allocated to underlying positions mapped to risk score <span className={metricQuestionClass}>3 or higher</span>.
        It describes the risk profile of the destination vault rather than the current bucket. Lower vault high-risk
        improves the trust layer and helps the system stay confident that the recommendation is not solving one problem
        by creating another.
      </p>
    ),
  },
  {
    id: METHODOLOGY_SECTION_IDS.overlap,
    question: <span className={metricQuestionClass}>Overlap</span>,
    answer: (
      <div className="space-y-3">
        <div id={METHODOLOGY_SECTION_IDS.yoShare} className="scroll-mt-6" />
        <p>
          <span className={metricQuestionClass}>Overlap</span> measures how similar the current productive protocol mix
          is to the target YO vault protocol mix. Lower overlap means the move introduces a meaningfully different
          protocol set instead of recreating what the bucket already has.
        </p>
        <p>
          <span className={metricQuestionClass}>YO share</span> measures how much of the current bucket is already
          allocated to the same target YO vault. Lower YO share makes the recommendation less redundant and supports
          trust that the move is adding something new rather than just increasing an existing YO position.
        </p>
      </div>
    ),
  },
];

function FaqToggle({ item, defaultOpen = false }: { item: FaqItem; defaultOpen?: boolean }) {
  return (
    <details
      id={item.id}
      className="group rounded-[28px] border border-white/10 bg-black/35 p-0 open:border-[#ffd84d]/35 open:bg-black/50"
      open={defaultOpen}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
        <div className="text-lg leading-7 text-white">{item.question}</div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/12 text-xl text-white/75 transition group-open:border-[#ffd84d]/35 group-open:text-[#ffd84d]">
          <span className="group-open:hidden">+</span>
          <span className="hidden group-open:inline">−</span>
        </div>
      </summary>
      <div className="border-t border-white/8 px-5 py-4 text-base leading-8 text-white/70">{item.answer}</div>
    </details>
  );
}

export default function MethodologyPage() {
  const router = useRouter();
  const [returnTo, setReturnTo] = React.useState<string | null>(null);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setReturnTo(params.get("returnTo"));
  }, []);

  React.useEffect(() => {
    const revealHashTarget = () => {
      const hash = window.location.hash.replace(/^#/, "");
      if (!hash) return;
      const element = document.getElementById(hash);
      if (!element) return;
      const detailsElement =
        element instanceof HTMLDetailsElement ? element : element.closest("details");
      if (!(detailsElement instanceof HTMLDetailsElement)) return;
      detailsElement.open = true;
      window.requestAnimationFrame(() => {
        (element instanceof HTMLDetailsElement ? element : detailsElement).scrollIntoView({ block: "start" });
      });
    };

    revealHashTarget();
    window.addEventListener("hashchange", revealHashTarget);
    return () => window.removeEventListener("hashchange", revealHashTarget);
  }, []);

  const handleBack = React.useCallback(() => {
    const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    const liveReturnTo = params?.get("returnTo") ?? returnTo;
    if (liveReturnTo) {
      router.replace(liveReturnTo);
      return;
    }
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/?resume=1");
  }, [returnTo, router]);

  return (
    <main className="mx-auto max-w-[1240px] space-y-8 px-6 py-10 lg:px-10">
      <section className="space-y-5">
        <div className="space-y-5">
          <div className="text-sm uppercase tracking-[0.24em] text-white/45">Methodology</div>
          <h1 className="max-w-4xl text-5xl font-semibold leading-tight text-white md:text-6xl">
            How your move are scored
          </h1>
          <p className="max-w-3xl text-lg leading-8 text-white/68">
            Higher <span className={metricQuestionClass}>Diversification</span> and{" "}
            <span className={metricQuestionClass}>Savings score</span> are better. Lower{" "}
            <span className={metricQuestionClass}>Weighted risk</span>,{" "}
            <span className={metricQuestionClass}>High-risk exposure</span>,{" "}
            <span className={metricQuestionClass}>Vault high-risk</span> are better.{" "}
            <span className={metricQuestionClass}>Confidence</span> shows the strength of recommendations.
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
      </section>

      <section className="space-y-4">
        <div className="text-sm uppercase tracking-[0.24em] text-white/45">Core FAQ</div>
        <div className="space-y-3">
          {methodologyFaq.map((item, index) => (
            <FaqToggle key={item.id} item={item} defaultOpen={index === 0} />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="text-sm uppercase tracking-[0.24em] text-white/45">Metrics FAQ</div>
        <div className="space-y-3">
          {metricFaq.map((item) => (
            <FaqToggle key={item.id} item={item} />
          ))}
        </div>
      </section>
    </main>
  );
}
