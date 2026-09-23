import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { cycleCutoff, upcomingCycleDate } from "./cycle";

describe("cycleCutoff", () => {
  it("is midnight Bangkok time on the 1st and 16th", () => {
    assert.equal(cycleCutoff("2026-10-01")?.toISOString(), "2026-09-30T17:00:00.000Z");
    assert.equal(cycleCutoff("2026-10-16")?.toISOString(), "2026-10-15T17:00:00.000Z");
  });

  it("rejects dates that are not a cycle day", () => {
    assert.equal(cycleCutoff("2026-10-15"), null);
    assert.equal(cycleCutoff("2026-13-01"), null);
    assert.equal(cycleCutoff("16/10/2026"), null);
  });
});

describe("upcomingCycleDate", () => {
  it("uses the Bangkok calendar day, not UTC", () => {
    assert.equal(upcomingCycleDate(new Date("2026-09-16T20:00:00Z")), "2026-10-01");
    assert.equal(upcomingCycleDate(new Date("2026-09-15T18:00:00Z")), "2026-09-16");
  });

  it("picks today on a cycle day and rolls into the next month and year", () => {
    assert.equal(upcomingCycleDate(new Date("2026-09-01T03:00:00Z")), "2026-09-01");
    assert.equal(upcomingCycleDate(new Date("2026-09-23T03:00:00Z")), "2026-10-01");
    assert.equal(upcomingCycleDate(new Date("2026-12-20T03:00:00Z")), "2027-01-01");
  });
});
