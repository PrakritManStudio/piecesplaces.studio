"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { JobTagPicker, TagBadge } from "@/components/job-tag-picker";
import { Button, buttonVariants } from "@/components/ui/button";
import { PAYMENT_KINDS } from "@/domain/split";
import type { PaymentKind } from "@/generated/prisma/enums";
import { formatJobCode } from "@/lib/job-code";
import {
  CLOSE_OUTCOME_LABELS,
  ENGAGEMENT_LABELS,
  JOB_STATUS_LABELS,
  PAYMENT_KIND_LABELS,
  PAYOUT_KIND_LABELS,
  PAYOUT_STATUS_LABELS,
  REVIEW_STATUS_LABELS,
  SERVICE_LABELS,
} from "@/lib/labels";
import { formatThb, parseThbToSatang, satangToThbInput } from "@/lib/money";
import { staffPath } from "@/lib/staff-paths";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";

function todayDateInput() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function toDateInput(date: Date | string) {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const trpc = useTRPC();
  const qc = useQueryClient();
  const job = useQuery(trpc.job.byId.queryOptions({ id }));
  const me = useQuery(trpc.user.me.queryOptions());
  const tags = useQuery(trpc.tag.list.queryOptions());
  const [msg, setMsg] = useState<string | null>(null);
  const [tagDraft, setTagDraft] = useState<string[] | null>(null);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);

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
  const updatePayment = useMutation(
    trpc.payment.update.mutationOptions({
      onSuccess: async () => {
        setEditingPaymentId(null);
        await invalidate();
      },
      onError: (e) => setMsg(e.message),
    }),
  );
  const deletePayment = useMutation(
    trpc.payment.delete.mutationOptions({
      onSuccess: async () => {
        setEditingPaymentId(null);
        await invalidate();
      },
      onError: (e) => setMsg(e.message),
    }),
  );
  const requestClose = useMutation(
    trpc.job.requestClose.mutationOptions({
      onSuccess: invalidate,
      onError: (e) => setMsg(e.message),
    }),
  );
  const setTags = useMutation(
    trpc.job.setTags.mutationOptions({
      onSuccess: async () => {
        setTagDraft(null);
        await invalidate();
      },
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
    (p) =>
      p.status === "approved" &&
      (p.kind === "inbound_shop" || p.kind === "inbound_held_by_guest"),
  );

  function submitPayment(kind: PaymentKind, thb: string, note: string, receivedAt: Date) {
    setMsg(null);
    const amountSatang = parseThbToSatang(thb);
    if (amountSatang == null) {
      setMsg("จำนวนเงินไม่ถูกต้อง");
      return;
    }
    addPayment.mutate({
      jobId: id,
      kind,
      amountSatang,
      note: note || null,
      receivedAt,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={staffPath.jobs} className="text-sm text-muted-foreground hover:underline">
            ← งาน
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            <span className="mr-2 text-muted-foreground">{formatJobCode(j.jobNo)}</span>
            {j.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            {j.ownerUser?.name ?? j.ownerGuest?.name} · {JOB_STATUS_LABELS[j.status]} ·{" "}
            {SERVICE_LABELS[j.serviceType]}
            {j.guestEngagement !== "none"
              ? ` · ${ENGAGEMENT_LABELS[j.guestEngagement]}`
              : ""}
          </p>
          <p className="text-sm text-muted-foreground">
            Artist {j.artistPct}% / Referral {j.referralPct}% / Shop{" "}
            {100 - j.artistPct - j.referralPct}%
          </p>
          {j.tags.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {j.tags.map((jt) => (
                <TagBadge key={jt.tag.id} name={jt.tag.name} color={jt.tag.color} />
              ))}
            </div>
          ) : null}
        </div>
        {j.canEdit ? (
          <Link
            href={staffPath.jobEdit(id)}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            แก้ไขงาน
          </Link>
        ) : null}
      </div>

      {msg ? <p className="text-sm text-destructive">{msg}</p> : null}

      {j.canEdit ? (
        <section className="space-y-3 rounded-lg border border-border bg-background p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-medium">Tags</h2>
            {tagDraft ? (
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setTagDraft(null)}
                >
                  ยกเลิก
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={setTags.isPending}
                  onClick={() => {
                    setMsg(null);
                    setTags.mutate({ jobId: id, tagIds: tagDraft });
                  }}
                >
                  บันทึก tags
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setTagDraft(j.tags.map((jt) => jt.tag.id))}
              >
                แก้ไข tags
              </Button>
            )}
          </div>
          {tagDraft ? (
            <JobTagPicker
              options={tags.data ?? []}
              value={tagDraft}
              onChange={setTagDraft}
            />
          ) : j.tags.length === 0 ? (
            <p className="text-sm text-muted-foreground">ยังไม่ได้ติด tag</p>
          ) : (
            <div className="flex flex-wrap gap-1">
              {j.tags.map((jt) => (
                <TagBadge key={jt.tag.id} name={jt.tag.name} color={jt.tag.color} />
              ))}
            </div>
          )}
        </section>
      ) : null}

      <section className="space-y-3 rounded-lg border border-border bg-background p-4">
        <h2 className="font-medium">รายการเงิน</h2>
        <ul className="divide-y divide-border text-sm">
          {j.payments.map((p) => (
            <li key={p.id} className="space-y-2 py-2">
              {editingPaymentId === p.id ? (
                <PaymentEditForm
                  kinds={[...kinds]}
                  initial={{
                    kind: p.kind,
                    thb: satangToThbInput(p.amountSatang),
                    note: p.note ?? "",
                    receivedAt: toDateInput(p.receivedAt),
                  }}
                  pending={updatePayment.isPending || deletePayment.isPending}
                  onCancel={() => setEditingPaymentId(null)}
                  onSave={(kind, thb, note, receivedAt) => {
                    setMsg(null);
                    const amountSatang = parseThbToSatang(thb);
                    if (amountSatang == null) {
                      setMsg("จำนวนเงินไม่ถูกต้อง");
                      return;
                    }
                    updatePayment.mutate({
                      id: p.id,
                      kind,
                      amountSatang,
                      note: note || null,
                      receivedAt,
                    });
                  }}
                  onDelete={() => {
                    setMsg(null);
                    if (window.confirm("ลบรายการเงินนี้?")) {
                      deletePayment.mutate({ id: p.id });
                    }
                  }}
                />
              ) : (
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <span>
                    {PAYMENT_KIND_LABELS[p.kind]} · {formatThb(p.amountSatang)}
                    {p.note ? ` - ${p.note}` : ""}
                    <span className="mt-0.5 block text-muted-foreground">
                      {new Date(p.receivedAt).toLocaleString("th-TH")}
                    </span>
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">
                      {REVIEW_STATUS_LABELS[p.status]}
                    </span>
                    {j.canEdit && p.status === "pending" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setMsg(null);
                          setEditingPaymentId(p.id);
                        }}
                      >
                        แก้ไข
                      </Button>
                    ) : null}
                  </div>
                </div>
              )}
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
            onSubmit={submitPayment}
          />
        ) : null}

        {j.status === "closed" && j.settlement.length > 0 ? (
          <div className="space-y-2 border-t border-border pt-3">
            <h3 className="text-sm font-medium">Settlement วันจบงาน</h3>
            <ul className="text-sm text-muted-foreground">
              {j.settlement.map((s) => (
                <li key={s.kind}>
                  {PAYMENT_KIND_LABELS[s.kind]}: ต้อง {formatThb(s.dueSatang)} · อนุมัติแล้ว{" "}
                  {formatThb(s.approvedSatang)} · รอ {formatThb(s.pendingSatang)}
                </li>
              ))}
            </ul>
            {j.canEdit || me.data?.isAdmin ? (
              <PaymentForm
                kinds={j.settlement.map((s) => s.kind)}
                pending={addPayment.isPending}
                onSubmit={submitPayment}
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
                {CLOSE_OUTCOME_LABELS[c.outcome]} · {REVIEW_STATUS_LABELS[c.status]}
                {c.baseSatang != null ? ` · base ${formatThb(c.baseSatang)}` : ""}
              </span>
              <span className="text-muted-foreground">{c.requestedBy.name}</span>
            </div>
          ))}
        </section>
      ) : null}

      {j.entitlements.length > 0 ? (
        <section className="space-y-2 rounded-lg border border-border bg-background p-4 text-sm">
          <h2 className="font-medium">สิทธิรับเงิน</h2>
          {j.entitlements.map((e) => (
            <div key={e.id} className="flex justify-between gap-2">
              <span>
                {e.user.name} · {e.role} · {formatThb(e.amountSatang)}
              </span>
              <span className="text-muted-foreground">
                {e.payoutBatch
                  ? `${PAYOUT_KIND_LABELS[e.payoutBatch.kind]}/${PAYOUT_STATUS_LABELS[e.payoutBatch.status]}`
                  : "ค้างจ่าย"}
              </span>
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}

function PaymentForm(props: {
  kinds: PaymentKind[];
  pending: boolean;
  onSubmit: (kind: PaymentKind, thb: string, note: string, receivedAt: Date) => void;
}) {
  const [kind, setKind] = useState<PaymentKind>(props.kinds[0] ?? "inbound_shop");
  const [thb, setThb] = useState("");
  const [note, setNote] = useState("");
  const [receivedAt, setReceivedAt] = useState(todayDateInput);

  return (
    <form
      className="flex flex-wrap items-end gap-2 border-t border-border pt-3"
      onSubmit={(e) => {
        e.preventDefault();
        props.onSubmit(kind, thb, note, new Date(receivedAt));
        setThb("");
        setNote("");
        setReceivedAt(todayDateInput());
      }}
    >
      <label className="text-sm">
        <span className="text-muted-foreground">ชนิด</span>
        <select
          className="mt-1 block rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          value={kind}
          onChange={(e) => setKind(e.target.value as PaymentKind)}
        >
          {props.kinds.map((k) => (
            <option key={k} value={k}>
              {PAYMENT_KIND_LABELS[k]}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <span className="text-muted-foreground">วันที่รับเงิน</span>
        <input
          className="mt-1 block rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          type="date"
          required
          value={receivedAt}
          onChange={(e) => setReceivedAt(e.target.value)}
        />
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

function PaymentEditForm(props: {
  kinds: PaymentKind[];
  initial: { kind: PaymentKind; thb: string; note: string; receivedAt: string };
  pending: boolean;
  onSave: (kind: PaymentKind, thb: string, note: string, receivedAt: Date) => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const [kind, setKind] = useState<PaymentKind>(props.initial.kind);
  const [thb, setThb] = useState(props.initial.thb);
  const [note, setNote] = useState(props.initial.note);
  const [receivedAt, setReceivedAt] = useState(props.initial.receivedAt);
  const kindOptions = props.kinds.includes(props.initial.kind)
    ? props.kinds
    : [props.initial.kind, ...props.kinds];

  return (
    <form
      className="space-y-2 rounded-md border border-border bg-muted/30 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        props.onSave(kind, thb, note, new Date(receivedAt));
      }}
    >
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">
          <span className="text-muted-foreground">ชนิด</span>
          <select
            className="mt-1 block rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            value={kind}
            onChange={(e) => setKind(e.target.value as PaymentKind)}
          >
            {kindOptions.map((k) => (
              <option key={k} value={k}>
                {PAYMENT_KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="text-muted-foreground">วันที่รับเงิน</span>
          <input
            className="mt-1 block rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            type="date"
            required
            value={receivedAt}
            onChange={(e) => setReceivedAt(e.target.value)}
          />
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
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={props.pending}>
          บันทึก
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={props.pending}
          onClick={props.onCancel}
        >
          ยกเลิก
        </Button>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={props.pending}
          onClick={props.onDelete}
        >
          ลบ
        </Button>
      </div>
    </form>
  );
}
