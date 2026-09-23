export function formatJobCode(jobNo: number): string {
  if (!Number.isInteger(jobNo) || jobNo < 1) {
    throw new Error(`Invalid jobNo: ${jobNo}`);
  }
  return `pp${String(jobNo).padStart(3, "0")}`;
}

export function nextJobNo(maxJobNo: number | null | undefined): number {
  return (maxJobNo ?? 0) + 1;
}
