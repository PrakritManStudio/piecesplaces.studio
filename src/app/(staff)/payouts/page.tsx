"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { PAYOUT_KIND_LABELS, PAYOUT_STATUS_LABELS } from "@/lib/labels";
import { formatThb } from "@/lib/money";
import { useTRPC } from "@/trpc/client";

export default function PayoutsPage() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const me = useQuery(trpc.user.me.queryOptions());
  const upcoming = useQuery(trpc.payout.upcomingCycleDate.queryOptions());
  const [cycleDate, setCycleDate] = useState("");
  const effectiveCycle = cycleDate || upcoming.data || "";

  const eligible = useQuery({
    ...trpc.payout.eligible.queryOptions({ cycleDate: effectiveCycle }),
    enabled: me.data?.isAdmin === true && effectiveCycle.length > 0,
  });
  const batches = useQuery({
    ...trpc.payout.list.queryOptions({ status: "pending" }),
    enabled: me.data?.isAdmin === true,
  });
  const mine = useQuery({
    ...trpc.payout.mine.queryOptions(),
    enabled: !!me.data,
  });

  const invalidate = async () => {
    await Promise.all([
      qc.invalidateQueries(trpc.payout.eligible.queryFilter()),
      qc.invalidateQueries(trpc.payout.list.queryFilter()),
      qc.invalidateQueries(trpc.payout.mine.queryFilter()),
    ]);
  };

  const createCycle = useMutation(
    trpc.payout.createCycleBatches.mutationOptions({ onSuccess: invalidate }),
  );
  const markPaid = useMutation(trpc.payout.markPaid.mutationOptions({ onSuccess: invalidate }));
  const cancel = useMutation(trpc.payout.cancel.mutationOptions({ onSuccess: invalidate }));
  const advance = useMutation(
    trpc.payout.requestAdvance.mutationOptions({ onSuccess: invalidate }),
  );

  const [payBatchId, setPayBatchId] = useState<string | null>(null);
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);
  const [evidenceUrl, setEvidenceUrl] = useState("");

  if (me.isLoading) return <p className="text-sm text-muted-foreground">กำลังโหลด…</p>;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">จ่ายช่าง</h1>

      {!me.data?.isAdmin ? (
        <StaffPayoutMine
          upcoming={upcoming.data}
          entitlements={(mine.data?.entitlements ?? []).filter((e) => !e.payoutBatch)}
          selectedJobs={selectedJobs}
          onToggle={(jobId) =>
            setSelectedJobs((prev) =>
              prev.includes(jobId) ? prev.filter((id) => id !== jobId) : [...prev, jobId],
            )
          }
          onAdvance={() => advance.mutate({ jobIds: selectedJobs })}
          advancePending={advance.isPending}
        />
      ) : (
        <>
          <section className="space-y-3 rounded-lg border border-border bg-background p-4">
            <h2 className="font-medium">รอบ 1 / 16</h2>
            <div className="flex flex-wrap items-end gap-2 text-sm">
              <label>
                <span className="text-muted-foreground">วันรอบจ่าย</span>
                <input
                  className="mt-1 block rounded-md border border-input bg-background px-2 py-1.5"
                  placeholder={upcoming.data ?? "YYYY-MM-DD"}
                  value={cycleDate}
                  onChange={(e) => setCycleDate(e.target.value)}
                />
              </label>
              <Button
                disabled={!effectiveCycle || createCycle.isPending}
                onClick={() => createCycle.mutate({ cycleDate: effectiveCycle })}
              >
                สร้าง batch รอบ {effectiveCycle}
              </Button>
            </div>
            <ul className="divide-y divide-border text-sm">
              {(eligible.data ?? []).map((row) => (
                <li key={row.userId} className="flex justify-between py-2">
                  <span>
                    {row.name} · {row.count} รายการ
                  </span>
                  <span className="font-medium">{formatThb(row.totalSatang)}</span>
                </li>
              ))}
              {eligible.data?.length === 0 ? (
                <li className="py-2 text-muted-foreground">ไม่มียอด eligible ก่อน cutoff</li>
              ) : null}
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-medium">Batch รอจ่าย ({batches.data?.length ?? 0})</h2>
            <ul className="divide-y divide-border rounded-lg border border-border bg-background text-sm">
              {(batches.data ?? []).map((b) => (
                <li key={b.id} className="space-y-2 px-4 py-3">
                  <div className="flex flex-wrap justify-between gap-2">
                    <span>
                      {b.user.name} · {PAYOUT_KIND_LABELS[b.kind]} · {formatThb(b.totalSatang)}
                    </span>
                    <span className="text-muted-foreground">{PAYOUT_STATUS_LABELS[b.status]}</span>
                  </div>
                  <ul className="text-muted-foreground">
                    {b.entitlements.map((e) => (
                      <li key={e.id}>
                        {e.job.title} · {formatThb(e.amountSatang)}
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => setPayBatchId(b.id)}>
                      บันทึกจ่ายแล้ว
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const reason = window.prompt("เหตุผลยกเลิก");
                        if (reason?.trim()) cancel.mutate({ id: b.id, reason: reason.trim() });
                      }}
                    >
                      ยกเลิก
                    </Button>
                  </div>
                </li>
              ))}
              {batches.data?.length === 0 ? (
                <li className="px-4 py-6 text-center text-muted-foreground">ไม่มี batch รอจ่าย</li>
              ) : null}
            </ul>
          </section>
        </>
      )}

      {payBatchId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            className="w-full max-w-sm space-y-3 rounded-lg border border-border bg-background p-4"
            onSubmit={(ev) => {
              ev.preventDefault();
              markPaid.mutate({ id: payBatchId, evidenceUrl: evidenceUrl.trim() });
              setPayBatchId(null);
              setEvidenceUrl("");
            }}
          >
            <p className="font-medium">หลักฐานโอน (URL)</p>
            <input
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              required
              value={evidenceUrl}
              onChange={(e) => setEvidenceUrl(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setPayBatchId(null)}>
                ยกเลิก
              </Button>
              <Button type="submit">ยืนยันจ่าย</Button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function StaffPayoutMine(props: {
  upcoming?: string;
  entitlements: {
    id: string;
    jobId: string;
    role: string;
    amountSatang: number;
    job: { title: string };
  }[];
  selectedJobs: string[];
  onToggle: (jobId: string) => void;
  onAdvance: () => void;
  advancePending: boolean;
}) {
  const byJob = Map.groupBy(props.entitlements, (e) => e.jobId);
  return (
    <section className="space-y-3 rounded-lg border border-border bg-background p-4 text-sm">
      <h2 className="font-medium">ยอดของฉัน</h2>
      <p className="text-muted-foreground">รอบถัดไป (Bangkok): {props.upcoming ?? "—"}</p>
      <ul className="divide-y divide-border">
        {[...byJob.entries()].map(([jobId, rows]) => {
          const total = rows.reduce((a, r) => a + r.amountSatang, 0);
          return (
            <li key={jobId} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={props.selectedJobs.includes(jobId)}
                  onChange={() => props.onToggle(jobId)}
                />
                <span>
                  {rows[0].job.title} · {rows.map((r) => r.role).join(", ")}
                </span>
              </label>
              <span>{formatThb(total)}</span>
            </li>
          );
        })}
      </ul>
      {props.entitlements.length === 0 ? (
        <p className="text-muted-foreground">ไม่มียอดค้างในระบบ</p>
      ) : (
        <Button
          size="sm"
          disabled={props.selectedJobs.length === 0 || props.advancePending}
          onClick={props.onAdvance}
        >
          ขอเบิกล่วงหน้า ({props.selectedJobs.length} งาน)
        </Button>
      )}
    </section>
  );
}
