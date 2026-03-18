"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { METHODOLOGY_SECTION_IDS } from "../../components/methodology-link";

type FaqItem = {
  id: string;
  question: React.ReactNode;
  answer: React.ReactNode;
};

const metricQuestionClass = "font-semibold text-lime";

const methodologyFaq: FaqItem[] = [
  {
    id: "engine",
    question: "What does WHY YO? compare?",
    answer: (
      <p>
        The engine compares each portfolio bucket separately. It looks at wallet idle balances, productive DeFi
        positions, and the matching YO vault for that same bucket, then computes deterministic metrics first and adds
        narrative copy later.
      </p>
    ),
  },
  {
    id: "buckets",
    question: "How do buckets work?",
    answer: (
      <p>
        Everything is split into <span className={metricQuestionClass}>USD</span>,{" "}
        <span className={metricQuestionClass}>ETH</span>, and <span className={metricQuestionClass}>BTC</span>{" "}
        buckets. Stablecoins compare only to <span className={metricQuestionClass}>yoUSD</span>, ETH-like assets only
        to <span className={metricQuestionClass}>yoETH</span>, and BTC-like assets only to{" "}
        <span className={metricQuestionClass}>yoBTC</span>. Cross-bucket comparisons are not ranked.
      </p>
    ),
  },
  {
    id: "recommendation-states-overview",
    question: "Recommendation state",
    answer: (
      <div className="space-y-3">
        <p>
          The engine first detects the primary intent, then chooses the visible recommendation state.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <span className={metricQuestionClass}>Migration</span>: a productive or mixed bucket where YO improves the
            modeled structure enough to justify a move.
          </li>
          <li>
            <span className={metricQuestionClass}>Idle opportunity</span>: an idle-heavy bucket where the main gain is
            deploying undeployed capital.
          </li>
          <li>
            <span className={metricQuestionClass}>Informational only</span>: there is visible signal, but coverage or
            confidence is not strong enough for a hard push.
          </li>
          <li>
            <span className={metricQuestionClass}>Already in YO / no incremental improvement</span>: the bucket already
            has meaningful YO exposure or the modeled move does not clear the recommendation bar.
          </li>
        </ul>
      </div>
    ),
  },
  {
    id: "ranking",
    question: "How are recommendations ranked?",
    answer: (
      <div className="space-y-3">
        <p>
          The ranker does not use one universal score anymore. It computes three intent-specific scores and then picks
          the best fit:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <span className={metricQuestionClass}>Risk improvement</span>: emphasizes weighted-risk reduction,
            high-risk reduction, savings-score improvement, diversification, simplicity, and similarity, then subtracts
            unknown-risk and small-size penalties.
          </li>
          <li>
            <span className={metricQuestionClass}>Diversification improvement</span>: emphasizes diversification gain,
            concentration problems, strategy fit, and simplification, with smaller risk terms and the same penalty
            logic.
          </li>
          <li>
            <span className={metricQuestionClass}>Idle deployment</span>: emphasizes idle share, idle USD size,
            estimated yield opportunity, vault quality, and structure improvement, then penalizes weak coverage and
            undersized buckets.
          </li>
        </ul>
      </div>
    ),
  },
  {
    id: "coverage-rules",
    question: "What happens when coverage is low?",
    answer: (
      <p>
        Coverage is a trust input, not just a display number. The trust tile colors current-bucket coverage above{" "}
        <span className={metricQuestionClass}>60%</span> green, <span className={metricQuestionClass}>30-60%</span>{" "}
        yellow, and below <span className={metricQuestionClass}>30%</span> red. Recommendation logic is stricter: when
        unknown exposure across the compared current bucket or target vault gets very high, safety claims are softened,
        and above roughly <span className={metricQuestionClass}>80%</span> unknown many cases become informational-only
        unless measured improvement is unusually strong.
      </p>
    ),
  },
  {
    id: "trust",
    question: "How does Trust index work?",
    answer: (
      <div className="space-y-3">
        <p>
          <span className={metricQuestionClass}>Trust index</span> is built from four visible trust metrics:
          coverage, vault high-risk, YO share, and overlap.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Each metric is first classified into green, yellow, orange, or red.</li>
          <li>
            Coverage uses <span className={metricQuestionClass}>{">"}60%</span> as green and{" "}
            <span className={metricQuestionClass}>{"<"}30%</span> as red.
          </li>
          <li>
            Vault high-risk uses <span className={metricQuestionClass}>20%</span>,{" "}
            <span className={metricQuestionClass}>30%</span>, and{" "}
            <span className={metricQuestionClass}>40%</span> breakpoints.
          </li>
          <li>
            YO share uses <span className={metricQuestionClass}>10%</span>,{" "}
            <span className={metricQuestionClass}>20%</span>, and{" "}
            <span className={metricQuestionClass}>30%</span> breakpoints.
          </li>
          <li>
            Overlap uses <span className={metricQuestionClass}>10%</span>,{" "}
            <span className={metricQuestionClass}>30%</span>, and{" "}
            <span className={metricQuestionClass}>50%</span> breakpoints.
          </li>
          <li>
            Final label: <span className={metricQuestionClass}>Major</span> if the average score is high and nothing is
            red, <span className={metricQuestionClass}>Minor</span> if the case is mixed but still usable, otherwise{" "}
            <span className={metricQuestionClass}>Low</span>.
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
        <span className={metricQuestionClass}>Suggested amount</span> is deterministic. The engine calculates
        idle-first, high-risk-only, combined, 25%, 50%, and full-bucket presets. The highlighted value uses the
        combined preset first, then falls back to idle-only, then high-risk-only, then 25% of the bucket. If the whole
        bucket is under <span className={metricQuestionClass}>$250</span>, it shows the full bucket; otherwise it floors
        the suggestion at <span className={metricQuestionClass}>$250</span> and caps it at bucket size.
      </p>
    ),
  },
  {
    id: "limitations",
    question: "What are the main limitations?",
    answer: (
      <p>
        Public risk coverage in DeFi is incomplete, wrappers can hide underlying exposures, and APY is only a current
        snapshot. The app therefore treats yield estimates as informational, keeps unknown-heavy cases visible, and
        reduces recommendation pressure before making strong safety claims.
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
        Bucket-level coverage tile in the overview cards. It shows what share of productive DeFi capital in the bucket
        has public risk mapping.
      </p>
    ),
  },
  {
    id: METHODOLOGY_SECTION_IDS.diversification,
    question: <span className={metricQuestionClass}>Diversification</span>,
    answer: (
      <p>
        This is the user-facing inverse of protocol concentration. Higher diversification means the productive DeFi
        bucket is spread more broadly across protocols rather than concentrated in one place.
      </p>
    ),
  },
  {
    id: METHODOLOGY_SECTION_IDS.weightedRisk,
    question: <span className={metricQuestionClass}>Weighted risk (WRS)</span>,
    answer: (
      <p>
        Average risk score of productive DeFi positions only. Idle balances are excluded so idle wallet assets cannot
        artificially make a risky DeFi bucket look safer.
      </p>
    ),
  },
  {
    id: METHODOLOGY_SECTION_IDS.highRiskExposure,
    question: <span className={metricQuestionClass}>High-risk exposure (HRE)</span>,
    answer: (
      <p>Share of productive DeFi capital sitting in positions mapped to risk score 3 or higher.</p>
    ),
  },
  {
    id: METHODOLOGY_SECTION_IDS.savingsScore,
    question: <span className={metricQuestionClass}>Savings score (SPS)</span>,
    answer: (
      <p>
        A heuristic 0-100 quality score. It combines risk, high-risk share, concentration, structural complexity,
        unknown coverage drag, and idle drag into one user-facing summary. Higher is better, but it is not a forecast.
      </p>
    ),
  },
  {
    id: METHODOLOGY_SECTION_IDS.trustIndex,
    question: <span className={metricQuestionClass}>Trust index</span>,
    answer: (
      <p>
        Compact UI summary of four trust metrics: coverage, vault high-risk, YO share, and overlap. It is not a
        separate portfolio metric; it is a presentation layer derived from those inputs and compressed into Major,
        Minor, or Low.
      </p>
    ),
  },
  {
    id: METHODOLOGY_SECTION_IDS.coverage,
    question: <span className={metricQuestionClass}>Coverage</span>,
    answer: (
      <p>
        Trust-layer label for the same underlying coverage metric. In recommendation cards it is shown as a percent and
        toned by thresholds: above 60% green, 30-60% yellow, below 30% red.
      </p>
    ),
  },
  {
    id: METHODOLOGY_SECTION_IDS.yoShare,
    question: <span className={metricQuestionClass}>YO share</span>,
    answer: (
      <p>How much of the current bucket is already allocated to the same target YO vault.</p>
    ),
  },
  {
    id: METHODOLOGY_SECTION_IDS.vaultHighRisk,
    question: <span className={metricQuestionClass}>Vault high-risk</span>,
    answer: (
      <p>Share of the target YO vault allocated to underlying positions mapped to risk score 3 or higher.</p>
    ),
  },
  {
    id: METHODOLOGY_SECTION_IDS.overlap,
    question: <span className={metricQuestionClass}>Overlap</span>,
    answer: (
      <p>
        Overlap between the user&apos;s current productive protocol mix and the target YO vault protocol mix. Lower
        overlap means YO is taking the bucket to a more different protocol set.
      </p>
    ),
  },
  {
    id: METHODOLOGY_SECTION_IDS.recommendationState,
    question: <span className={metricQuestionClass}>Recommendation state</span>,
    answer: (
      <p>
        User-facing state label in the preview flow that compresses recommendation actionability and strength into{" "}
        <span className={metricQuestionClass}>Major</span>, <span className={metricQuestionClass}>Minor</span>, or{" "}
        <span className={metricQuestionClass}>Low</span>.
      </p>
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
      if (!(element instanceof HTMLDetailsElement)) return;
      element.open = true;
      window.requestAnimationFrame(() => {
        element.scrollIntoView({ block: "start" });
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
            How WHY YO? scores your next move
          </h1>
          <p className="max-w-3xl text-lg leading-8 text-white/68">
            Higher <span className={metricQuestionClass}>Diversification</span> and{" "}
            <span className={metricQuestionClass}>Savings score</span> are better. Lower{" "}
            <span className={metricQuestionClass}>Weighted risk</span>,{" "}
            <span className={metricQuestionClass}>High-risk exposure</span>,{" "}
            <span className={metricQuestionClass}>Vault high-risk</span>,{" "}
            <span className={metricQuestionClass}>YO share</span>, and{" "}
            <span className={metricQuestionClass}>Overlap</span> are better.{" "}
            <span className={metricQuestionClass}>Risk coverage</span> should be read together with recommendation
            caution.
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
