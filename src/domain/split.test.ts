import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PAYMENT_KINDS, ratesError, settleClose, toCloseInput } from "./split";

const staff = { artistPct: 60, referralPct: 0 };
const staffWithReferral = { artistPct: 60, referralPct: 5 };
const guestA = { artistPct: 70, referralPct: 0 };
const guestB = { artistPct: 50, referralPct: 0 };

describe("settleClose, staff jobs", () => {
  it("completed multiplies % over the sum of approved inbound payments", () => {
    assert.deepEqual(
      settleClose("none", staff, {
        outcome: "completed",
        approvedInboundSatang: [200_000, 300_000],
      }),
      {
        split: {
          baseSatang: 500_000,
          ownerSatang: 300_000,
          referralSatang: 0,
          shopSatang: 200_000,
          refundSatang: 0,
        },
        entitlements: [{ role: "artist", to: "owner", amountSatang: 300_000 }],
        movements: [],
      },
    );
  });

  it("completed with referral pays artist and referral, shop keeps the rest", () => {
    assert.deepEqual(
      settleClose("none", staffWithReferral, {
        outcome: "completed",
        approvedInboundSatang: [1_000_000],
      }),
      {
        split: {
          baseSatang: 1_000_000,
          ownerSatang: 600_000,
          referralSatang: 50_000,
          shopSatang: 350_000,
          refundSatang: 0,
        },
        entitlements: [
          { role: "artist", to: "owner", amountSatang: 600_000 },
          { role: "referral", to: "referral", amountSatang: 50_000 },
        ],
        movements: [],
      },
    );
  });

  it("rounds shares down to the satang and gives the remainder to the shop", () => {
    const { split } = settleClose("none", staffWithReferral, {
      outcome: "completed",
      approvedInboundSatang: [333],
    });
    assert.deepEqual(split, {
      baseSatang: 333,
      ownerSatang: 199,
      referralSatang: 16,
      shopSatang: 118,
      refundSatang: 0,
    });
  });

  it("forfeit is 50/50 owner/shop and pays no referral even when the job has one", () => {
    assert.deepEqual(
      settleClose("none", staffWithReferral, {
        outcome: "forfeit_deposit",
        depositSatang: 100_001,
      }),
      {
        split: {
          baseSatang: 100_001,
          ownerSatang: 50_000,
          referralSatang: 0,
          shopSatang: 50_001,
          refundSatang: 0,
        },
        entitlements: [{ role: "forfeit_share", to: "owner", amountSatang: 50_000 }],
        movements: [],
      },
    );
  });

  it("full refund gives the owner nothing and the shop refunds the customer", () => {
    assert.deepEqual(
      settleClose("none", staffWithReferral, {
        outcome: "refund_deposit",
        depositSatang: 150_000,
      }),
      {
        split: {
          baseSatang: 150_000,
          ownerSatang: 0,
          referralSatang: 0,
          shopSatang: 0,
          refundSatang: 150_000,
        },
        entitlements: [],
        movements: [{ kind: "refund_to_customer", amountSatang: 150_000 }],
      },
    );
  });
});

describe("settleClose, Guest A (guest_sourced)", () => {
  it("completed is 70/30 with no payout-queue entitlement; guest pays the shop cut", () => {
    assert.deepEqual(
      settleClose("guest_sourced", guestA, {
        outcome: "completed",
        approvedInboundSatang: [1_000_000],
      }),
      {
        split: {
          baseSatang: 1_000_000,
          ownerSatang: 700_000,
          referralSatang: 0,
          shopSatang: 300_000,
          refundSatang: 0,
        },
        entitlements: [],
        movements: [{ kind: "shop_cut_from_guest", amountSatang: 300_000 }],
      },
    );
  });

  it("forfeit: guest pays 50% of the deposit to the shop the same day", () => {
    assert.deepEqual(
      settleClose("guest_sourced", guestA, {
        outcome: "forfeit_deposit",
        depositSatang: 200_000,
      }).movements,
      [{ kind: "shop_cut_from_guest", amountSatang: 100_000 }],
    );
  });

  it("refund: guest refunds the customer personally, nothing moves through the shop", () => {
    assert.deepEqual(
      settleClose("guest_sourced", guestA, {
        outcome: "refund_deposit",
        depositSatang: 200_000,
      }),
      {
        split: {
          baseSatang: 200_000,
          ownerSatang: 0,
          referralSatang: 0,
          shopSatang: 0,
          refundSatang: 200_000,
        },
        entitlements: [],
        movements: [],
      },
    );
  });
});

describe("settleClose, Guest B (shop_overflow)", () => {
  it("completed is 50/50 and the shop pays the guest owner the same day", () => {
    assert.deepEqual(
      settleClose("shop_overflow", guestB, {
        outcome: "completed",
        approvedInboundSatang: [400_000, 200_000],
      }),
      {
        split: {
          baseSatang: 600_000,
          ownerSatang: 300_000,
          referralSatang: 0,
          shopSatang: 300_000,
          refundSatang: 0,
        },
        entitlements: [],
        movements: [{ kind: "payout_to_guest", amountSatang: 300_000 }],
      },
    );
  });

  it("forfeit: shop keeps 50% and pays the guest 50% the same day", () => {
    assert.deepEqual(
      settleClose("shop_overflow", guestB, {
        outcome: "forfeit_deposit",
        depositSatang: 300_000,
      }).movements,
      [{ kind: "payout_to_guest", amountSatang: 150_000 }],
    );
  });

  it("refund: the shop refunds the customer", () => {
    assert.deepEqual(
      settleClose("shop_overflow", guestB, {
        outcome: "refund_deposit",
        depositSatang: 300_000,
      }).movements,
      [{ kind: "refund_to_customer", amountSatang: 300_000 }],
    );
  });
});

describe("PAYMENT_KINDS", () => {
  it("allows every same-day movement a close can demand for that engagement", () => {
    const engagements = ["none", "guest_sourced", "shop_overflow"] as const;
    const outcomes = [
      { outcome: "completed", approvedInboundSatang: [100_000] },
      { outcome: "forfeit_deposit", depositSatang: 100_000 },
      { outcome: "refund_deposit", depositSatang: 100_000 },
    ] as const;
    const missing = engagements.flatMap((engagement) =>
      outcomes.flatMap((close) =>
        settleClose(engagement, guestB, close)
          .movements.filter((m) => !PAYMENT_KINDS[engagement].includes(m.kind))
          .map((m) => `${engagement}/${close.outcome}/${m.kind}`),
      ),
    );
    assert.deepEqual(missing, []);
  });
});

describe("ratesError", () => {
  it("rejects referral on Guest jobs and accepts it on staff jobs", () => {
    assert.equal(
      ratesError("shop_overflow", { artistPct: 50, referralPct: 5 }, true),
      "งาน Guest ไม่มี Referral",
    );
    assert.equal(ratesError("none", staffWithReferral, true), null);
  });

  it("requires a referral user exactly when referral % is set", () => {
    assert.equal(
      ratesError("none", staffWithReferral, false),
      "ต้องมีทั้งผู้แนะนำและ Referral % หรือไม่มีทั้งคู่",
    );
    assert.equal(
      ratesError("none", staff, true),
      "ต้องมีทั้งผู้แนะนำและ Referral % หรือไม่มีทั้งคู่",
    );
  });

  it("rejects rates over 100%", () => {
    assert.equal(
      ratesError("none", { artistPct: 90, referralPct: 20 }, true),
      "อัตรารวมต้องอยู่ระหว่าง 0–100",
    );
  });
});

describe("toCloseInput", () => {
  const deposit = { id: "p1", amountSatang: 100_000 };

  it("uses the selected deposit for forfeit and refund", () => {
    assert.deepEqual(toCloseInput("forfeit_deposit", [deposit], "p1"), {
      outcome: "forfeit_deposit",
      depositSatang: 100_000,
    });
  });

  it("rejects forfeit without an approved deposit selection", () => {
    assert.deepEqual(toCloseInput("refund_deposit", [deposit], "missing"), {
      error: "ต้องเลือกรายการรับเงินที่อนุมัติแล้วเป็นมัดจำ",
    });
  });

  it("rejects forfeit when other approved inbound payments exist", () => {
    assert.deepEqual(
      toCloseInput("forfeit_deposit", [deposit, { id: "p2", amountSatang: 5 }], "p1"),
      { error: "ริบ/คืนมัดจำได้เมื่อมีรายการรับเงินที่อนุมัติแค่มัดจำเท่านั้น" },
    );
  });

  it("completed sums every approved inbound payment", () => {
    assert.deepEqual(
      toCloseInput("completed", [deposit, { id: "p2", amountSatang: 5 }], null),
      { outcome: "completed", approvedInboundSatang: [100_000, 5] },
    );
  });
});
