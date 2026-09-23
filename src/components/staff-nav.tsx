"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const links = [
  { href: "/jobs", label: "งาน" },
  { href: "/approvals", label: "อนุมัติ", admin: true },
  { href: "/payouts", label: "จ่ายช่าง", admin: true },
  { href: "/expenses", label: "ค่าใช้จ่าย" },
  { href: "/dashboard", label: "Dashboard", admin: true },
] as const;

export function StaffNav(props: {
  user: { name: string; email: string; isAdmin: boolean };
}) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3">
        <Link href="/jobs" className="text-sm font-semibold tracking-tight">
          Pieces Places
        </Link>
        <nav className="flex flex-1 flex-wrap gap-1">
          {links
            .filter((l) => !("admin" in l && l.admin) || props.user.isAdmin)
            .map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
                  pathname.startsWith(l.href) && "bg-muted text-foreground",
                )}
              >
                {l.label}
              </Link>
            ))}
        </nav>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="hidden sm:inline">{props.user.name}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await authClient.signOut();
              router.push("/login");
              router.refresh();
            }}
          >
            ออกจากระบบ
          </Button>
        </div>
      </div>
    </header>
  );
}
