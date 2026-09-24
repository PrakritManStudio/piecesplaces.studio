"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { formatThb } from "@/lib/money";
import { useTRPC } from "@/trpc/client";

function monthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export default function DashboardPage() {
  const trpc = useTRPC();
  const me = useQuery(trpc.user.me.queryOptions());
  const defaults = useMemo(() => monthRange(), []);
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);

  const summary = useQuery({
    ...trpc.dashboard.summary.queryOptions({
      from: new Date(from),
      to: new Date(to),
    }),
    enabled: me.data?.isAdmin === true && from.length > 0 && to.length > 0,
  });

  if (me.isLoading) return <p className="text-sm text-muted-foreground">กำลังโหลด…</p>;
  if (!me.data?.isAdmin) {
    return <p className="text-sm text-muted-foreground">เฉพาะ admin</p>;
  }

  const s = summary.data;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>

      <div className="flex flex-wrap items-end gap-3 text-sm">
        <label>
          <span className="text-muted-foreground">จาก</span>
          <input
            className="mt-1 block rounded-md border border-input bg-background px-2 py-1.5"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          <span className="text-muted-foreground">ถึง (ไม่รวม)</span>
          <input
            className="mt-1 block rounded-md border border-input bg-background px-2 py-1.5"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
      </div>

      {summary.isLoading ? <p className="text-sm text-muted-foreground">กำลังโหลด…</p> : null}
      {summary.error ? (
        <p className="text-sm text-destructive">{summary.error.message}</p>
      ) : null}

      {s ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card title="งานปิด (อนุมัติปิดแล้ว)" value={String(s.totals.jobs)} />
          <Card title="ฐานรวม" value={formatThb(s.totals.baseSatang)} />
          <Card title="ส่วนร้าน (shop)" value={formatThb(s.totals.shopSatang)} />
          <Card title="ค่าใช้จ่ายอนุมัติ" value={formatThb(s.expenses.totalSatang)} />
          <Card title="กำไรหยาบ (shop − expense)" value={formatThb(s.profitSatang)} />
          <Card title="จ่ายช่างแล้ว (paid batch)" value={formatThb(s.payoutsPaidSatang)} />
        </div>
      ) : null}

      {s ? (
        <section className="space-y-2 rounded-lg border border-border bg-background p-4 text-sm">
          <h2 className="font-medium">ตาม engagement</h2>
          <ul className="space-y-1 text-muted-foreground">
            {(
              [
                ["none", "ช่างประจำ"],
                ["guest_sourced", "Guest A"],
                ["shop_overflow", "Guest B"],
              ] as const
            ).map(([key, label]) => (
              <li key={key} className="flex justify-between gap-2">
                <span>
                  {label} · {s.byEngagement[key].jobs} งาน
                </span>
                <span>{formatThb(s.byEngagement[key].shopSatang)} shop</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {s && s.byOwner.length > 0 ? (
        <section className="space-y-2 rounded-lg border border-border bg-background p-4 text-sm">
          <h2 className="font-medium">ตามผู้ให้บริการ (top base)</h2>
          <ul className="divide-y divide-border">
            {s.byOwner.slice(0, 15).map((o) => (
              <li key={`${o.engagement}:${o.name}`} className="flex justify-between py-2">
                <span>
                  {o.name} · {o.engagement}
                </span>
                <span>{formatThb(o.baseSatang)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Card(props: { title: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <p className="text-sm text-muted-foreground">{props.title}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight">{props.value}</p>
    </div>
  );
}
