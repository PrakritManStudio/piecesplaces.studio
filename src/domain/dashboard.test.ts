import assert from "node:assert/strict";
import { it } from "node:test";

import { summarize } from "./dashboard";

const split = (base: number, owner: number, referral: number, shop: number, refund = 0) => ({
  baseSatang: base,
  ownerSatang: owner,
  referralSatang: referral,
  shopSatang: shop,
  refundSatang: refund,
});

it("rough profit is shop share of closed jobs minus approved expenses, split by engagement", () => {
  const result = summarize(
    [
      { engagement: "none", ownerKey: "u1", ownerName: "Aom", split: split(1_000_000, 600_000, 50_000, 350_000) },
      { engagement: "none", ownerKey: "u1", ownerName: "Aom", split: split(100_000, 0, 0, 0, 100_000) },
      { engagement: "guest_sourced", ownerKey: "g1", ownerName: "Ken", split: split(1_000_000, 700_000, 0, 300_000) },
    ],
    [
      { category: "ถุงมือ", amountSatang: 20_000 },
      { category: "ค่าน้ำไฟ/ค่าเช่า", amountSatang: 500_000 },
      { category: "ถุงมือ", amountSatang: 5_000 },
    ],
  );

  assert.equal(result.profitSatang, 125_000);
  assert.deepEqual(result.byEngagement.none, {
    jobs: 2,
    baseSatang: 1_100_000,
    ownerSatang: 600_000,
    referralSatang: 50_000,
    shopSatang: 350_000,
    refundSatang: 100_000,
  });
  assert.equal(result.byEngagement.guest_sourced.shopSatang, 300_000);
  assert.deepEqual(
    result.byOwner.map((o) => [o.name, o.jobs, o.ownerSatang]),
    [
      ["Aom", 2, 600_000],
      ["Ken", 1, 700_000],
    ],
  );
  assert.deepEqual(result.expenses.byCategory, [
    { category: "ค่าน้ำไฟ/ค่าเช่า", totalSatang: 500_000 },
    { category: "ถุงมือ", totalSatang: 25_000 },
  ]);
});
