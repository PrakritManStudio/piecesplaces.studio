"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { formatJobCode } from "@/lib/job-code";
import {
  ENGAGEMENT_LABELS,
  JOB_STATUS_LABELS,
  SERVICE_LABELS,
} from "@/lib/labels";
import { useTRPC } from "@/trpc/client";

export default function JobsPage() {
  const trpc = useTRPC();
  const me = useQuery(trpc.user.me.queryOptions());
  const [scope, setScope] = useState<"mine" | "all">("mine");

  const jobs = useQuery(
    trpc.job.list.queryOptions({
      scope: me.data?.isAdmin ? scope : "mine",
    }),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">งาน</h1>
        <div className="flex gap-2">
          {me.data?.isAdmin ? (
            <div className="flex rounded-lg border border-border bg-background p-0.5 text-sm">
              {(["mine", "all"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`rounded-md px-3 py-1 ${scope === s ? "bg-muted font-medium" : "text-muted-foreground"}`}
                  onClick={() => setScope(s)}
                >
                  {s === "mine" ? "ของฉัน" : "ทั้งหมด"}
                </button>
              ))}
            </div>
          ) : null}
          <Button render={<Link href="/jobs/new" />}>สร้างงาน</Button>
        </div>
      </div>

      {jobs.isLoading ? <p className="text-sm text-muted-foreground">กำลังโหลด…</p> : null}
      {jobs.error ? (
        <p className="text-sm text-destructive">{jobs.error.message}</p>
      ) : null}

      <ul className="divide-y divide-border rounded-lg border border-border bg-background">
        {(jobs.data ?? []).map((job) => (
          <li key={job.id}>
            <Link
              href={`/jobs/${job.id}`}
              className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 hover:bg-muted/50"
            >
              <div>
                <p className="font-medium">
                  <span className="mr-2 text-muted-foreground">{formatJobCode(job.jobNo)}</span>
                  {job.title}
                </p>
                <p className="text-sm text-muted-foreground">
                  {job.ownerUser?.name ?? job.ownerGuest?.name ?? "—"} ·{" "}
                  {SERVICE_LABELS[job.serviceType]}
                  {job.guestEngagement !== "none"
                    ? ` · ${ENGAGEMENT_LABELS[job.guestEngagement]}`
                    : ""}
                </p>
              </div>
              <div className="text-right text-sm">
                <p>{JOB_STATUS_LABELS[job.status]}</p>
                <p className="text-muted-foreground">
                  {new Date(job.scheduledAt).toLocaleString("th-TH")}
                </p>
              </div>
            </Link>
          </li>
        ))}
        {jobs.data?.length === 0 ? (
          <li className="px-4 py-8 text-center text-sm text-muted-foreground">ยังไม่มีงาน</li>
        ) : null}
      </ul>
    </div>
  );
}
