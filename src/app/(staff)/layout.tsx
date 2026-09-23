import { StaffSidebar } from "@/components/staff-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { isAdminRole, requireSession } from "@/lib/session";

export default async function StaffLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await requireSession();
  const isAdmin = isAdminRole(session.user.role);

  return (
    <TooltipProvider>
      <SidebarProvider>
        <StaffSidebar
          user={{
            name: session.user.name,
            email: session.user.email,
            isAdmin,
          }}
        />
        <SidebarInset className="bg-zinc-50">
          <header className="flex h-12 items-center gap-2 border-b border-border px-4 md:hidden">
            <SidebarTrigger />
            <span className="text-sm font-semibold">Pieces Places</span>
          </header>
          <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
