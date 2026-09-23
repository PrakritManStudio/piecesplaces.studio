import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatJobCode, nextJobNo } from "./job-code";

describe("formatJobCode", () => {
  it("pads to three digits", () => {
    assert.equal(formatJobCode(1), "pp001");
    assert.equal(formatJobCode(12), "pp012");
    assert.equal(formatJobCode(999), "pp999");
  });

  it("grows past three digits", () => {
    assert.equal(formatJobCode(1000), "pp1000");
  });
});

describe("nextJobNo", () => {
  it("starts at 1", () => {
    assert.equal(nextJobNo(null), 1);
    assert.equal(nextJobNo(undefined), 1);
  });

  it("increments", () => {
    assert.equal(nextJobNo(1), 2);
    assert.equal(nextJobNo(999), 1000);
  });
});
