import { describe, expect, it } from "vitest";

import { matchCanonicalProtocol } from "./matching";

describe("protocol matching", () => {
  it("uses alias hits before heuristic matching", () => {
    const result = matchCanonicalProtocol({
      originalProtocolName: "Aave V3",
      chain: "eth",
      symbol: "USDC",
      parentSymbol: "USD",
      catalog: [
        {
          canonicalProtocolId: "aave",
          canonicalName: "Aave",
          aliases: ["aave", "aave v3"],
          defaultStrategyType: "lending",
        },
      ],
    });

    expect(result.canonicalProtocolId).toBe("aave");
    expect(result.matchingConfidence).toBe(0.9);
    expect(result.bucket).toBe("USD");
  });

  it("falls back to a deterministic family key when no alias matches", () => {
    const result = matchCanonicalProtocol({
      originalProtocolId: "base_yoxyz",
      originalProtocolName: "YO",
      chain: "base",
      symbol: "yoUSD",
      parentSymbol: "yoUSD",
      catalog: [],
    });

    expect(result.canonicalProtocolId).toBe("yo");
    expect(result.bucket).toBe("USD");
  });
});
