/** Display and parse money. Domain storage is always integer satang. */

export function formatThb(satang: number) {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
  }).format(satang / 100);
}

/** Parse a THB amount string (e.g. "1500.50") into satang. Returns null if invalid. */
export function parseThbToSatang(raw: string): number | null {
  const n = Number(raw.replace(/,/g, "").trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}
