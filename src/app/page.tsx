import { redirect } from "next/navigation";

import { requireSession } from "@/lib/session";

/** Old root demo page → staff jobs (or login). */
export default async function Home() {
  await requireSession();
  redirect("/jobs");
}
