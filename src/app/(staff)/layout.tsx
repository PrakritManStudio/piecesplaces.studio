import { StaffNav } from "@/components/staff-nav";
import { isAdminRole, requireSession } from "@/lib/session";

export default async function StaffLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await requireSession();
  const isAdmin = isAdminRole(session.user.role);

  return (
    <div className="flex min-h-full flex-col bg-zinc-50 text-foreground">
      <StaffNav
        user={{
          name: session.user.name,
          email: session.user.email,
          isAdmin,
        }}
      />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
