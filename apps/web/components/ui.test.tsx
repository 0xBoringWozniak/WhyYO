import React from "react";
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";

import { Card } from "./ui";

describe("ui primitives", () => {
  it("render shared card markup", () => {
    const html = renderToString(<Card>Why YO</Card>);
    expect(html).toContain("Why YO");
  });
});
