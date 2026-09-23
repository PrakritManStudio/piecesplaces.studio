/** Asia/Bangkok payout cycle: 1st and 16th. Entitlements are labeled by cycleDate. */

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const CYCLE_DATE = /^(\d{4})-(\d{2})-(01|16)$/;

function bangkokYmd(d = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { y: get("year"), m: get("month"), d: get("day") };
}

function formatYmd(y: number, monthIndex: number, d: number) {
  return `${y}-${String(monthIndex + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Entitlements created before 00:00 Bangkok on the cycle date belong to that cycle. */
export function cycleCutoff(cycleDate: string): Date | null {
  const match = CYCLE_DATE.exec(cycleDate);
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  if (m < 1 || m > 12) return null;
  return new Date(Date.UTC(y, m - 1, d) - BANGKOK_OFFSET_MS);
}

/** Upcoming (or today) cycle day as YYYY-MM-DD in Bangkok. */
export function upcomingCycleDate(now: Date = new Date()): string {
  const local = new Date(now.getTime() + BANGKOK_OFFSET_MS);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  const d = local.getUTCDate();
  if (d === 1 || d === 16) return formatYmd(y, m, d);
  if (d < 16) return formatYmd(y, m, 16);
  return m === 11 ? formatYmd(y + 1, 0, 1) : formatYmd(y, m + 1, 1);
}

/** Noon UTC on that Bangkok calendar day — stable storage for cycleDate. */
export function cycleDateAt(y: number, m: number, day: 1 | 16) {
  return new Date(Date.UTC(y, m - 1, day, 5, 0, 0)); // 12:00 Bangkok = 05:00 UTC
}

export function currentCycleDate(at = new Date()) {
  const [y, m, d] = upcomingCycleDate(at).split("-").map(Number);
  return cycleDateAt(y, m, d as 1 | 16);
}

export function formatCycleLabel(cycleDate: Date) {
  const { y, m, d } = bangkokYmd(cycleDate);
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
