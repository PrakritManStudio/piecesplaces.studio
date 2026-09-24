import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { STAFF_HOME, STAFF_LOGIN } from "@/lib/staff-paths";

export async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect(STAFF_LOGIN);
  return session;
}

export function isAdminRole(role: string | null | undefined) {
  return role?.split(",").includes("admin") ?? false;
}

export async function requireAdmin() {
  const session = await requireSession();
  if (!isAdminRole(session.user.role)) redirect(STAFF_HOME);
  return session;
}
