"use client";

import {
  BriefcaseIcon,
  CheckCircleIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  ReceiptIcon,
  SettingsIcon,
  WalletIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const links = [
  { href: "/jobs", label: "งาน", icon: BriefcaseIcon },
  { href: "/approvals", label: "อนุมัติ", icon: CheckCircleIcon, admin: true },
  { href: "/payouts", label: "จ่ายช่าง", icon: WalletIcon, admin: true },
  { href: "/expenses", label: "ค่าใช้จ่าย", icon: ReceiptIcon },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboardIcon, admin: true },
  { href: "/settings", label: "ตั้งค่า", icon: SettingsIcon, admin: true },
] as const;

export function StaffSidebar(props: {
  user: { name: string; email: string; isAdmin: boolean };
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { setOpenMobile, isMobile } = useSidebar();
  const visible = links.filter((l) => !("admin" in l && l.admin) || props.user.isAdmin);

  useEffect(() => {
    setOpenMobile(false);
  }, [pathname, setOpenMobile]);

  function closeMobile() {
    if (isMobile) setOpenMobile(false);
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <Link
          href="/jobs"
          onClick={closeMobile}
          className="flex h-12 items-center gap-2 px-3 text-base font-semibold tracking-tight group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 md:h-10 md:px-2 md:text-sm"
        >
          <span className="truncate group-data-[collapsible=icon]:hidden">Pieces Places</span>
          <span className="hidden size-8 items-center justify-center rounded-md bg-sidebar-accent text-xs font-bold group-data-[collapsible=icon]:flex">
            PP
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>เมนู</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {visible.map((l) => {
                const Icon = l.icon;
                const active =
                  l.href === "/jobs"
                    ? pathname === "/jobs" || pathname.startsWith("/jobs/")
                    : pathname === l.href || pathname.startsWith(`${l.href}/`);
                return (
                  <SidebarMenuItem key={l.href}>
                    <SidebarMenuButton
                      isActive={active}
                      size="lg"
                      className={cn("h-11 md:h-8", active && "bg-sidebar-accent font-medium")}
                      render={<Link href={l.href} onClick={closeMobile} />}
                    >
                      <Icon />
                      <span>{l.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border gap-2">
        <div className="truncate px-3 py-1 text-sm text-muted-foreground md:px-2 md:text-xs">
          {props.user.name}
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="h-11 md:h-8"
              onClick={async () => {
                closeMobile();
                await authClient.signOut();
                router.push("/login");
                router.refresh();
              }}
            >
              <LogOutIcon />
              <span>ออกจากระบบ</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
