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
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";

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
  const visible = links.filter((l) => !("admin" in l && l.admin) || props.user.isAdmin);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <SidebarTrigger className="md:hidden" />
          <Link href="/jobs" className="truncate text-sm font-semibold tracking-tight">
            Pieces Places
          </Link>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>เมนู</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visible.map((l) => {
                const Icon = l.icon;
                const active =
                  l.href === "/jobs"
                    ? pathname === "/jobs" || pathname.startsWith("/jobs/")
                    : pathname === l.href || pathname.startsWith(`${l.href}/`);
                return (
                  <SidebarMenuItem key={l.href}>
                    <SidebarMenuButton isActive={active} render={<Link href={l.href} />}>
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
      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="truncate px-2 py-1 text-xs text-muted-foreground">
              {props.user.name}
            </div>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="ออกจากระบบ"
              onClick={async () => {
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
