import { redirect } from "next/navigation";

import { STAFF_HOME } from "@/lib/staff-paths";
import { requireSession } from "@/lib/session";

/** `/staff` → jobs when signed in (layout under `(app)` also gates). */
export default async function StaffIndex() {
  await requireSession();
  redirect(STAFF_HOME);
}
