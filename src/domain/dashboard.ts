import type { GuestEngagement } from "../generated/prisma/enums";
import type { Split } from "./split";

export type ClosedJobRow = {
  engagement: GuestEngagement;
  ownerKey: string;
  ownerName: string;
  split: Split;
};

export type ExpenseRow = { category: string; amountSatang: number };

export type Totals = Split & { jobs: number };

const zero = (): Totals => ({
  jobs: 0,
  baseSatang: 0,
  ownerSatang: 0,
  referralSatang: 0,
  shopSatang: 0,
  refundSatang: 0,
});

function add(t: Totals, s: Split) {
  t.jobs += 1;
  t.baseSatang += s.baseSatang;
  t.ownerSatang += s.ownerSatang;
  t.referralSatang += s.referralSatang;
  t.shopSatang += s.shopSatang;
  t.refundSatang += s.refundSatang;
}

export function summarize(closes: ClosedJobRow[], expenses: ExpenseRow[]) {
  const totals = zero();
  const byEngagement: Record<GuestEngagement, Totals> = {
    none: zero(),
    guest_sourced: zero(),
    shop_overflow: zero(),
  };
  const byOwner = new Map<string, Totals & { name: string; engagement: GuestEngagement }>();

  for (const c of closes) {
    add(totals, c.split);
    add(byEngagement[c.engagement], c.split);
    const key = `${c.engagement}:${c.ownerKey}`;
    const owner = byOwner.get(key) ?? { ...zero(), name: c.ownerName, engagement: c.engagement };
    add(owner, c.split);
    byOwner.set(key, owner);
  }

  const byCategory = new Map<string, number>();
  for (const e of expenses) {
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amountSatang);
  }
  const expenseSatang = expenses.reduce((a, e) => a + e.amountSatang, 0);

  return {
    totals,
    byEngagement,
    byOwner: [...byOwner.values()].sort((a, b) => b.baseSatang - a.baseSatang),
    expenses: {
      totalSatang: expenseSatang,
      byCategory: [...byCategory]
        .map(([category, totalSatang]) => ({ category, totalSatang }))
        .sort((a, b) => b.totalSatang - a.totalSatang),
    },
    profitSatang: totals.shopSatang - expenseSatang,
  };
}
