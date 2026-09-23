"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { CLOSE_OUTCOME_LABELS, PAYMENT_KIND_LABELS } from "@/lib/labels";
import { formatThb } from "@/lib/money";
import { useTRPC } from "@/trpc/client";

export default function ApprovalsPage() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const me = useQuery(trpc.user.me.queryOptions());
  const closes = useQuery({
    ...trpc.job.pendingCloses.queryOptions(),
    enabled: me.data?.isAdmin === true,
  });
  const payments = useQuery({
    ...trpc.payment.pending.queryOptions(),
    enabled: me.data?.isAdmin === true,
  });
  const expenses = useQuery({
    ...trpc.expense.pending.queryOptions(),
    enabled: me.data?.isAdmin === true,
  });
  const [rejectReason, setRejectReason] = useState("");
  const [rejectTarget, setRejectTarget] = useState<{ kind: "payment" | "expense" | "close"; id: string } | null>(
    null,
  );

  const invalidate = async () => {
    await Promise.all([
      qc.invalidateQueries(trpc.job.pendingCloses.queryFilter()),
      qc.invalidateQueries(trpc.payment.pending.queryFilter()),
      qc.invalidateQueries(trpc.expense.pending.queryFilter()),
      qc.invalidateQueries(trpc.job.list.queryFilter()),
    ]);
  };

  const approveClose = useMutation(
    trpc.job.approveClose.mutationOptions({ onSuccess: invalidate }),
  );
  const rejectClose = useMutation(
    trpc.job.rejectClose.mutationOptions({ onSuccess: invalidate }),
  );
  const approvePayment = useMutation(
    trpc.payment.approve.mutationOptions({ onSuccess: invalidate }),
  );
  const rejectPayment = useMutation(
    trpc.payment.reject.mutationOptions({ onSuccess: invalidate }),
  );
  const approveExpense = useMutation(
    trpc.expense.approve.mutationOptions({ onSuccess: invalidate }),
  );
  const rejectExpense = useMutation(
    trpc.expense.reject.mutationOptions({ onSuccess: invalidate }),
  );

  if (me.isLoading) return <p className="text-sm text-muted-foreground">กำลังโหลด…</p>;
  if (!me.data?.isAdmin) {
    return <p className="text-sm text-muted-foreground">เฉพาะ admin</p>;
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">อนุมัติ</h1>

      <section className="space-y-3">
        <h2 className="font-medium">ปิดงาน ({closes.data?.length ?? 0})</h2>
        <ul className="divide-y divide-border rounded-lg border border-border bg-background text-sm">
          {(closes.data ?? []).map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div>
                <Link href={`/jobs/${c.job.id}`} className="font-medium hover:underline">
                  {c.job.title}
                </Link>
                <p className="text-muted-foreground">
                  {CLOSE_OUTCOME_LABELS[c.outcome]} · ขอโดย {c.requestedBy.name}
                  {c.depositPayment
                    ? ` · มัดจำ ${formatThb(c.depositPayment.amountSatang)}`
                    : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={approveClose.isPending}
                  onClick={() => approveClose.mutate({ closeId: c.id })}
                >
                  อนุมัติ
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setRejectTarget({ kind: "close", id: c.id })}
                >
                  ปฏิเสธ
                </Button>
              </div>
            </li>
          ))}
          {closes.data?.length === 0 ? (
            <li className="px-4 py-6 text-center text-muted-foreground">ไม่มีคิว</li>
          ) : null}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">รายการเงิน ({payments.data?.length ?? 0})</h2>
        <ul className="divide-y divide-border rounded-lg border border-border bg-background text-sm">
          {(payments.data ?? []).map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div>
                <Link href={`/jobs/${p.job.id}`} className="font-medium hover:underline">
                  {p.job.title}
                </Link>
                <p className="text-muted-foreground">
                  {PAYMENT_KIND_LABELS[p.kind]} · {formatThb(p.amountSatang)} · {p.createdBy.name}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => approvePayment.mutate({ id: p.id })}>
                  อนุมัติ
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setRejectTarget({ kind: "payment", id: p.id })}
                >
                  ปฏิเสธ
                </Button>
              </div>
            </li>
          ))}
          {payments.data?.length === 0 ? (
            <li className="px-4 py-6 text-center text-muted-foreground">ไม่มีคิว</li>
          ) : null}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">ค่าใช้จ่าย ({expenses.data?.length ?? 0})</h2>
        <ul className="divide-y divide-border rounded-lg border border-border bg-background text-sm">
          {(expenses.data ?? []).map((e) => (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div>
                <p className="font-medium">{e.category.name}</p>
                <p className="text-muted-foreground">
                  {formatThb(e.amountSatang)} · {e.createdBy.name}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => approveExpense.mutate({ id: e.id })}>
                  อนุมัติ
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setRejectTarget({ kind: "expense", id: e.id })}
                >
                  ปฏิเสธ
                </Button>
              </div>
            </li>
          ))}
          {expenses.data?.length === 0 ? (
            <li className="px-4 py-6 text-center text-muted-foreground">ไม่มีคิว</li>
          ) : null}
        </ul>
      </section>

      {rejectTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            className="w-full max-w-sm space-y-3 rounded-lg border border-border bg-background p-4"
            onSubmit={(ev) => {
              ev.preventDefault();
              if (!rejectReason.trim()) return;
              const reason = rejectReason.trim();
              if (rejectTarget.kind === "close") {
                rejectClose.mutate({ closeId: rejectTarget.id, reason });
              } else if (rejectTarget.kind === "payment") {
                rejectPayment.mutate({ id: rejectTarget.id, reason });
              } else {
                rejectExpense.mutate({ id: rejectTarget.id, reason });
              }
              setRejectTarget(null);
              setRejectReason("");
            }}
          >
            <p className="font-medium">เหตุผลที่ปฏิเสธ</p>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              rows={3}
              required
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setRejectTarget(null)}>
                ยกเลิก
              </Button>
              <Button type="submit" variant="destructive">
                ยืนยันปฏิเสธ
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
