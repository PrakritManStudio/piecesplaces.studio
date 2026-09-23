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
      <SidebarProvider className="min-h-svh">
        <StaffSidebar
          user={{
            name: session.user.name,
            email: session.user.email,
            isAdmin,
          }}
        />
        <SidebarInset className="min-w-0 bg-zinc-50">
          <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-3 pt-[env(safe-area-inset-top)] backdrop-blur supports-backdrop-filter:bg-background/80 md:hidden">
            <SidebarTrigger className="size-10 shrink-0" />
            <span className="truncate text-base font-semibold">Pieces Places</span>
          </header>
          <main className="mx-auto w-full max-w-5xl flex-1 px-3 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-4 md:py-6">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
