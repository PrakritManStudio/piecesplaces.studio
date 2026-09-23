"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { PAYMENT_KINDS } from "@/domain/split";
import { formatThb, parseThbToSatang } from "@/lib/money";
import { useTRPC } from "@/trpc/client";

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const trpc = useTRPC();
  const qc = useQueryClient();
  const job = useQuery(trpc.job.byId.queryOptions({ id }));
  const me = useQuery(trpc.user.me.queryOptions());
  const [msg, setMsg] = useState<string | null>(null);

  const invalidate = async () => {
    await qc.invalidateQueries(trpc.job.byId.queryFilter({ id }));
    await qc.invalidateQueries(trpc.job.list.queryFilter());
  };

  const addPayment = useMutation(
    trpc.payment.create.mutationOptions({
      onSuccess: invalidate,
      onError: (e) => setMsg(e.message),
    }),
  );
  const requestClose = useMutation(
    trpc.job.requestClose.mutationOptions({
      onSuccess: invalidate,
      onError: (e) => setMsg(e.message),
    }),
  );

  if (job.isLoading) return <p className="text-sm text-muted-foreground">กำลังโหลด…</p>;
  if (job.error || !job.data) {
    return <p className="text-sm text-destructive">{job.error?.message ?? "ไม่พบงาน"}</p>;
  }

  const j = job.data;
  const kinds = PAYMENT_KINDS[j.guestEngagement];
  const approvedInbound = j.payments.filter(
    (p) => p.status === "approved" && (p.kind === "inbound_shop" || p.kind === "inbound_held_by_guest"),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/jobs" className="text-sm text-muted-foreground hover:underline">
            ← งาน
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{j.title}</h1>
          <p className="text-sm text-muted-foreground">
            {j.ownerUser?.name ?? j.ownerGuest?.name} · {j.status} · {j.serviceType}
            {j.guestEngagement !== "none" ? ` · ${j.guestEngagement}` : ""}
          </p>
          <p className="text-sm text-muted-foreground">
            Artist {j.artistPct}% / Referral {j.referralPct}% / Shop{" "}
            {100 - j.artistPct - j.referralPct}%
          </p>
        </div>
      </div>

      {msg ? <p className="text-sm text-destructive">{msg}</p> : null}

      <section className="space-y-3 rounded-lg border border-border bg-background p-4">
        <h2 className="font-medium">รายการเงิน</h2>
        <ul className="divide-y divide-border text-sm">
          {j.payments.map((p) => (
            <li key={p.id} className="flex flex-wrap justify-between gap-2 py-2">
              <span>
                {p.kind} · {formatThb(p.amountSatang)}
                {p.note ? ` — ${p.note}` : ""}
              </span>
              <span className="text-muted-foreground">{p.status}</span>
            </li>
          ))}
          {j.payments.length === 0 ? (
            <li className="py-2 text-muted-foreground">ยังไม่มีรายการ</li>
          ) : null}
        </ul>

        {j.canEdit && j.status !== "closed" ? (
          <PaymentForm
            kinds={[...kinds]}
            pending={addPayment.isPending}
            onSubmit={(kind, thb, note) => {
              setMsg(null);
              const amountSatang = parseThbToSatang(thb);
              if (amountSatang == null) {
                setMsg("จำนวนเงินไม่ถูกต้อง");
                return;
              }
              addPayment.mutate({ jobId: id, kind, amountSatang, note: note || null });
            }}
          />
        ) : null}

        {j.status === "closed" && j.settlement.length > 0 ? (
          <div className="space-y-2 border-t border-border pt-3">
            <h3 className="text-sm font-medium">Settlement วันจบงาน</h3>
            <ul className="text-sm text-muted-foreground">
              {j.settlement.map((s) => (
                <li key={s.kind}>
                  {s.kind}: ต้อง {formatThb(s.dueSatang)} · อนุมัติแล้ว{" "}
                  {formatThb(s.approvedSatang)} · รอ {formatThb(s.pendingSatang)}
                </li>
              ))}
            </ul>
            {j.canEdit || me.data?.isAdmin ? (
              <PaymentForm
                kinds={j.settlement.map((s) => s.kind)}
                pending={addPayment.isPending}
                onSubmit={(kind, thb, note) => {
                  setMsg(null);
                  const amountSatang = parseThbToSatang(thb);
                  if (amountSatang == null) {
                    setMsg("จำนวนเงินไม่ถูกต้อง");
                    return;
                  }
                  addPayment.mutate({ jobId: id, kind, amountSatang, note: note || null });
                }}
              />
            ) : null}
          </div>
        ) : null}
      </section>

      {j.canEdit && j.status === "open" ? (
        <section className="space-y-3 rounded-lg border border-border bg-background p-4">
          <h2 className="font-medium">ปิดงาน</h2>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={requestClose.isPending}
              onClick={() => {
                setMsg(null);
                requestClose.mutate({ jobId: id, outcome: "completed" });
              }}
            >
              จบปกติ
            </Button>
          </div>
          {approvedInbound.length === 1 ? (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                disabled={requestClose.isPending}
                onClick={() =>
                  requestClose.mutate({
                    jobId: id,
                    outcome: "forfeit_deposit",
                    depositPaymentId: approvedInbound[0].id,
                  })
                }
              >
                ริบมัดจำ {formatThb(approvedInbound[0].amountSatang)}
              </Button>
              <Button
                variant="outline"
                disabled={requestClose.isPending}
                onClick={() =>
                  requestClose.mutate({
                    jobId: id,
                    outcome: "refund_deposit",
                    depositPaymentId: approvedInbound[0].id,
                  })
                }
              >
                คืนมัดจำเต็ม
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              ริบ/คืนมัดจำได้เมื่อมีรายการรับเงินที่อนุมัติแล้วเพียงรายการเดียว
            </p>
          )}
        </section>
      ) : null}

      {j.closes.length > 0 ? (
        <section className="space-y-2 rounded-lg border border-border bg-background p-4 text-sm">
          <h2 className="font-medium">ประวัติปิดงาน</h2>
          {j.closes.map((c) => (
            <div key={c.id} className="flex justify-between gap-2">
              <span>
                {c.outcome} · {c.status}
                {c.baseSatang != null ? ` · base ${formatThb(c.baseSatang)}` : ""}
              </span>
              <span className="text-muted-foreground">{c.requestedBy.name}</span>
            </div>
          ))}
        </section>
      ) : null}

      {j.entitlements.length > 0 ? (
        <section className="space-y-2 rounded-lg border border-border bg-background p-4 text-sm">
          <h2 className="font-medium">Entitlements</h2>
          {j.entitlements.map((e) => (
            <div key={e.id} className="flex justify-between gap-2">
              <span>
                {e.user.name} · {e.role} · {formatThb(e.amountSatang)}
              </span>
              <span className="text-muted-foreground">
                {e.payoutBatch ? `${e.payoutBatch.kind}/${e.payoutBatch.status}` : "ค้างจ่าย"}
              </span>
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}

function PaymentForm(props: {
  kinds: string[];
  pending: boolean;
  onSubmit: (kind: "inbound_shop" | "inbound_held_by_guest" | "shop_cut_from_guest" | "payout_to_guest" | "refund_to_customer", thb: string, note: string) => void;
}) {
  const [kind, setKind] = useState(props.kinds[0] ?? "inbound_shop");
  const [thb, setThb] = useState("");
  const [note, setNote] = useState("");

  return (
    <form
      className="flex flex-wrap items-end gap-2 border-t border-border pt-3"
      onSubmit={(e) => {
        e.preventDefault();
        props.onSubmit(kind as Parameters<typeof props.onSubmit>[0], thb, note);
        setThb("");
        setNote("");
      }}
    >
      <label className="text-sm">
        <span className="text-muted-foreground">ชนิด</span>
        <select
          className="mt-1 block rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          {props.kinds.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <span className="text-muted-foreground">บาท</span>
        <input
          className="mt-1 block w-28 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          required
          inputMode="decimal"
          value={thb}
          onChange={(e) => setThb(e.target.value)}
        />
      </label>
      <label className="min-w-[8rem] flex-1 text-sm">
        <span className="text-muted-foreground">โน้ต</span>
        <input
          className="mt-1 block w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      <Button type="submit" size="sm" disabled={props.pending}>
        เพิ่ม
      </Button>
    </form>
  );
}
