import type {
  CloseOutcome,
  EntitlementRole,
  GuestEngagement,
  PaymentKind,
} from "../generated/prisma/enums";

export type Rates = { artistPct: number; referralPct: number };

export type Split = {
  baseSatang: number;
  ownerSatang: number;
  referralSatang: number;
  shopSatang: number;
  refundSatang: number;
};

export type CloseInput =
  | { outcome: "completed"; approvedInboundSatang: readonly number[] }
  | { outcome: "forfeit_deposit"; depositSatang: number }
  | { outcome: "refund_deposit"; depositSatang: number };

export type EntitlementDraft = {
  role: EntitlementRole;
  to: "owner" | "referral";
  amountSatang: number;
};

export type Movement = { kind: PaymentKind; amountSatang: number };

export type CloseSettlement = {
  split: Split;
  entitlements: EntitlementDraft[];
  movements: Movement[];
};

const FORFEIT_OWNER_PCT = 50;

export const PAYMENT_KINDS: Record<GuestEngagement, readonly PaymentKind[]> = {
  none: ["inbound_shop", "refund_to_customer"],
  guest_sourced: ["inbound_held_by_guest", "shop_cut_from_guest"],
  shop_overflow: ["inbound_shop", "payout_to_guest", "refund_to_customer"],
};

export const INBOUND_KINDS: PaymentKind[] = ["inbound_shop", "inbound_held_by_guest"];

export function isInbound(kind: PaymentKind) {
  return INBOUND_KINDS.includes(kind);
}

export function shopPct(rates: Rates) {
  return 100 - rates.artistPct - rates.referralPct;
}

export function ratesError(
  engagement: GuestEngagement,
  rates: Rates,
  hasReferralUser: boolean,
): string | null {
  const { artistPct, referralPct } = rates;
  if (![artistPct, referralPct].every(Number.isInteger)) {
    return "อัตราต้องเป็นจำนวนเต็ม";
  }
  if (artistPct < 0 || referralPct < 0 || shopPct(rates) < 0) {
    return "อัตรารวมต้องอยู่ระหว่าง 0–100";
  }
  if (engagement !== "none" && (referralPct > 0 || hasReferralUser)) {
    return "งาน Guest ไม่มี Referral";
  }
  if (hasReferralUser !== referralPct > 0) {
    return "ต้องมีทั้งผู้แนะนำและ Referral % หรือไม่มีทั้งคู่";
  }
  return null;
}

function pctOf(baseSatang: number, pct: number) {
  return Math.floor((baseSatang * pct) / 100);
}

export function computeSplit(rates: Rates, close: CloseInput): Split {
  switch (close.outcome) {
    case "completed": {
      const base = close.approvedInboundSatang.reduce((a, b) => a + b, 0);
      const owner = pctOf(base, rates.artistPct);
      const referral = pctOf(base, rates.referralPct);
      return {
        baseSatang: base,
        ownerSatang: owner,
        referralSatang: referral,
        shopSatang: base - owner - referral,
        refundSatang: 0,
      };
    }
    case "forfeit_deposit": {
      const owner = pctOf(close.depositSatang, FORFEIT_OWNER_PCT);
      return {
        baseSatang: close.depositSatang,
        ownerSatang: owner,
        referralSatang: 0,
        shopSatang: close.depositSatang - owner,
        refundSatang: 0,
      };
    }
    case "refund_deposit":
      return {
        baseSatang: close.depositSatang,
        ownerSatang: 0,
        referralSatang: 0,
        shopSatang: 0,
        refundSatang: close.depositSatang,
      };
  }
}

const STAFF_ROLES: Record<CloseOutcome, EntitlementRole | null> = {
  completed: "artist",
  forfeit_deposit: "forfeit_share",
  refund_deposit: null,
};

function staffEntitlements(outcome: CloseOutcome, split: Split) {
  const ownerRole = STAFF_ROLES[outcome];
  const drafts: EntitlementDraft[] = [];
  if (ownerRole) {
    drafts.push({ role: ownerRole, to: "owner", amountSatang: split.ownerSatang });
  }
  drafts.push({ role: "referral", to: "referral", amountSatang: split.referralSatang });
  return drafts.filter((d) => d.amountSatang > 0);
}

// Money that physically changes hands on the close day, recorded as payment entries.
const MOVEMENTS: Record<
  GuestEngagement,
  Record<CloseOutcome, (split: Split) => Movement[]>
> = {
  none: {
    completed: () => [],
    forfeit_deposit: () => [],
    refund_deposit: (s) => [{ kind: "refund_to_customer", amountSatang: s.refundSatang }],
  },
  guest_sourced: {
    completed: (s) => [{ kind: "shop_cut_from_guest", amountSatang: s.shopSatang }],
    forfeit_deposit: (s) => [{ kind: "shop_cut_from_guest", amountSatang: s.shopSatang }],
    refund_deposit: () => [],
  },
  shop_overflow: {
    completed: (s) => [{ kind: "payout_to_guest", amountSatang: s.ownerSatang }],
    forfeit_deposit: (s) => [{ kind: "payout_to_guest", amountSatang: s.ownerSatang }],
    refund_deposit: (s) => [{ kind: "refund_to_customer", amountSatang: s.refundSatang }],
  },
};

export function closeMovements(
  engagement: GuestEngagement,
  outcome: CloseOutcome,
  split: Split,
): Movement[] {
  return MOVEMENTS[engagement][outcome](split).filter((m) => m.amountSatang > 0);
}

export function settleClose(
  engagement: GuestEngagement,
  rates: Rates,
  close: CloseInput,
): CloseSettlement {
  const split = computeSplit(rates, close);
  return {
    split,
    entitlements: engagement === "none" ? staffEntitlements(close.outcome, split) : [],
    movements: closeMovements(engagement, close.outcome, split),
  };
}

type ApprovedInbound = { id: string; amountSatang: number };

export function toCloseInput(
  outcome: CloseOutcome,
  approvedInbound: ApprovedInbound[],
  depositPaymentId: string | null,
): CloseInput | { error: string } {
  if (outcome === "completed") {
    if (depositPaymentId) return { error: "งานจบปกติไม่ต้องเลือกมัดจำ" };
    return {
      outcome,
      approvedInboundSatang: approvedInbound.map((p) => p.amountSatang),
    };
  }
  const deposit = approvedInbound.find((p) => p.id === depositPaymentId);
  if (!deposit) {
    return { error: "ต้องเลือกรายการรับเงินที่อนุมัติแล้วเป็นมัดจำ" };
  }
  if (approvedInbound.length > 1) {
    return { error: "ริบ/คืนมัดจำได้เมื่อมีรายการรับเงินที่อนุมัติแค่มัดจำเท่านั้น" };
  }
  return { outcome, depositSatang: deposit.amountSatang };
}
