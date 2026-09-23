import type {
  CloseOutcome,
  GuestEngagement,
  JobStatus,
  PaymentKind,
  PayoutBatchKind,
  PayoutBatchStatus,
  ReviewStatus,
  ServiceType,
} from "@/generated/prisma/enums";

export const SERVICE_LABELS: Record<ServiceType, string> = {
  tattoo: "สัก",
  nail: "ทำเล็บ",
  lash: "ต่อขนตา",
  class: "คลาส",
  other: "อื่นๆ",
};

export const ENGAGEMENT_LABELS: Record<GuestEngagement, string> = {
  none: "ช่างประจำ",
  guest_sourced: "Guest A — หาลูกค้าเอง",
  shop_overflow: "Guest B — ร้านส่งงาน",
};

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  open: "เปิด",
  awaiting_close_approval: "รออนุมัติปิดงาน",
  closed: "ปิดแล้ว",
};

export const PAYMENT_KIND_LABELS: Record<PaymentKind, string> = {
  inbound_shop: "เงินเข้าหน้าร้าน",
  inbound_held_by_guest: "เงินที่ Guest ถือไว้",
  shop_cut_from_guest: "ส่วนร้านจาก Guest",
  payout_to_guest: "จ่ายให้ Guest",
  refund_to_customer: "คืนเงินลูกค้า",
};

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  pending: "รออนุมัติ",
  approved: "อนุมัติแล้ว",
  rejected: "ปฏิเสธ",
};

export const CLOSE_OUTCOME_LABELS: Record<CloseOutcome, string> = {
  completed: "ทำงานครบ",
  forfeit_deposit: "ยึดมัดจำ",
  refund_deposit: "คืนมัดจำ",
};

export const PAYOUT_KIND_LABELS: Record<PayoutBatchKind, string> = {
  cycle: "รอบจ่าย",
  advance: "เบิกล่วงหน้า",
};

export const PAYOUT_STATUS_LABELS: Record<PayoutBatchStatus, string> = {
  pending: "รอจ่าย",
  paid: "จ่ายแล้ว",
  cancelled: "ยกเลิก",
};

export function labelOf<T extends string>(
  map: Record<T, string>,
  value: T,
): string {
  return map[value] ?? value;
}
