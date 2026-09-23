import { z } from "zod";

export const id = z.string().min(1);
export const satang = z.number().int().positive();
export const pct = z.number().int().min(0).max(100);
export const reason = z.string().trim().min(1, "ต้องระบุเหตุผล");
export const optionalText = z
  .string()
  .trim()
  .transform((s) => s || null)
  .nullish();
export const evidenceUrl = z.string().trim().min(1).nullish();
