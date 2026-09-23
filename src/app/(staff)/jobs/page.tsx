"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";

import { TagBadge } from "@/components/job-tag-picker";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { JobStatus } from "@/generated/prisma/enums";
import { formatJobCode } from "@/lib/job-code";
import {
  ENGAGEMENT_LABELS,
  JOB_STATUS_LABELS,
  SERVICE_LABELS,
} from "@/lib/labels";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";

const selectClassName =
  "h-11 w-full min-w-0 touch-manipulation rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:h-8 md:text-sm";

const STATUSES = Object.keys(JOB_STATUS_LABELS) as JobStatus[];

function dayStart(value: string) {
  return new Date(`${value}T00:00:00`);
}

function dayEndExclusive(value: string) {
  const d = dayStart(value);
  d.setDate(d.getDate() + 1);
  return d;
}

export default function JobsPage() {
  const trpc = useTRPC();
  const me = useQuery(trpc.user.me.queryOptions());
  const users = useQuery(trpc.user.list.queryOptions());
  const guests = useQuery(trpc.guestProfile.list.queryOptions());
  const tags = useQuery(trpc.tag.list.queryOptions());

  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [status, setStatus] = useState<"" | JobStatus>("");
  const [ownerKey, setOwnerKey] = useState("");
  const [tagId, setTagId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const ownerUserId = ownerKey.startsWith("user:") ? ownerKey.slice(5) : undefined;
  const ownerGuestId = ownerKey.startsWith("guest:") ? ownerKey.slice(6) : undefined;

  const listInput = useMemo(
    () => ({
      scope: (me.data?.isAdmin ? scope : "mine") as "mine" | "all",
      status: status || undefined,
      ownerUserId,
      ownerGuestId,
      tagIds: tagId ? [tagId] : [],
      scheduledFrom: from ? dayStart(from) : undefined,
      scheduledTo: to ? dayEndExclusive(to) : undefined,
    }),
    [me.data?.isAdmin, scope, status, ownerUserId, ownerGuestId, tagId, from, to],
  );

  const jobs = useQuery(trpc.job.list.queryOptions(listInput));
  const rows = jobs.data ?? [];

  function clearFilters() {
    setStatus("");
    setOwnerKey("");
    setTagId("");
    setFrom("");
    setTo("");
  }

  const hasFilters = Boolean(status || ownerKey || tagId || from || to);

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
                  className={cn(
                    "touch-manipulation rounded-md px-3 py-2 md:py-1",
                    scope === s ? "bg-muted font-medium" : "text-muted-foreground",
                  )}
                  onClick={() => setScope(s)}
                >
                  {s === "mine" ? "ของฉัน" : "ทั้งหมด"}
                </button>
              ))}
            </div>
          ) : null}
          <Link
            href="/jobs/new"
            className={cn(buttonVariants(), "touch-manipulation h-11 px-4 md:h-8")}
          >
            สร้างงาน
          </Link>
        </div>
      </div>

      <div className="grid gap-3 rounded-lg border border-border bg-background p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">สถานะ</span>
          <select
            className={selectClassName}
            value={status}
            onChange={(e) => setStatus(e.target.value as "" | JobStatus)}
          >
            <option value="">ทั้งหมด</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {JOB_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">เจ้าของงาน</span>
          <select
            className={selectClassName}
            value={ownerKey}
            onChange={(e) => setOwnerKey(e.target.value)}
          >
            <option value="">ทั้งหมด</option>
            <optgroup label="ช่างประจำ">
              {(users.data ?? []).map((u) => (
                <option key={u.id} value={`user:${u.id}`}>
                  {u.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Guest">
              {(guests.data ?? []).map((g) => (
                <option key={g.id} value={`guest:${g.id}`}>
                  {g.name}
                </option>
              ))}
            </optgroup>
          </select>
        </label>

        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Tag</span>
          <select
            className={selectClassName}
            value={tagId}
            onChange={(e) => setTagId(e.target.value)}
          >
            <option value="">ทั้งหมด</option>
            {(tags.data ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">วันนัดตั้งแต่</span>
          <Input
            type="date"
            className="h-11 touch-manipulation text-base md:h-8 md:text-sm"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">ถึง</span>
          <Input
            type="date"
            className="h-11 touch-manipulation text-base md:h-8 md:text-sm"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>

        <div className="flex items-end">
          <button
            type="button"
            className="h-11 touch-manipulation text-sm text-muted-foreground underline-offset-2 hover:underline disabled:opacity-40 md:h-8"
            disabled={!hasFilters}
            onClick={clearFilters}
          >
            ล้างตัวกรอง
          </button>
        </div>
      </div>

      {jobs.isLoading ? <p className="text-sm text-muted-foreground">กำลังโหลด…</p> : null}
      {jobs.error ? (
        <p className="text-sm text-destructive">{jobs.error.message}</p>
      ) : null}

      {/* Mobile: card list */}
      <ul className="divide-y divide-border rounded-lg border border-border bg-background md:hidden">
        {rows.map((job) => (
          <li key={job.id}>
            <Link
              href={`/jobs/${job.id}`}
              className="block touch-manipulation space-y-1.5 px-4 py-3 active:bg-muted/50"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium">
                  <span className="mr-2 text-muted-foreground">
                    {formatJobCode(job.jobNo)}
                  </span>
                  {job.title}
                </p>
                <Badge variant="secondary" className="shrink-0">
                  {JOB_STATUS_LABELS[job.status]}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {job.ownerUser?.name ?? job.ownerGuest?.name ?? "—"} ·{" "}
                {SERVICE_LABELS[job.serviceType]}
                {job.guestEngagement !== "none"
                  ? ` · ${ENGAGEMENT_LABELS[job.guestEngagement]}`
                  : ""}
              </p>
              <p className="text-sm text-muted-foreground">
                {new Date(job.scheduledAt).toLocaleString("th-TH", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
              {job.tags.length > 0 ? (
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {job.tags.map((jt) => (
                    <TagBadge
                      key={jt.tag.id}
                      name={jt.tag.name}
                      color={jt.tag.color}
                    />
                  ))}
                </div>
              ) : null}
            </Link>
          </li>
        ))}
        {rows.length === 0 && !jobs.isLoading ? (
          <li className="px-4 py-8 text-center text-sm text-muted-foreground">
            ไม่พบงานตามเงื่อนไข
          </li>
        ) : null}
      </ul>

      {/* Desktop: table */}
      <div className="hidden overflow-x-auto rounded-lg border border-border bg-background md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>รหัส</TableHead>
              <TableHead>ชื่องาน</TableHead>
              <TableHead>เจ้าของ</TableHead>
              <TableHead>สถานะ</TableHead>
              <TableHead>วันนัด</TableHead>
              <TableHead>Tags</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((job) => (
              <TableRow key={job.id}>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  <Link href={`/jobs/${job.id}`} className="hover:underline">
                    {formatJobCode(job.jobNo)}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link href={`/jobs/${job.id}`} className="font-medium hover:underline">
                    {job.title}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {SERVICE_LABELS[job.serviceType]}
                    {job.guestEngagement !== "none"
                      ? ` · ${ENGAGEMENT_LABELS[job.guestEngagement]}`
                      : ""}
                  </p>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {job.ownerUser?.name ?? job.ownerGuest?.name ?? "—"}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{JOB_STATUS_LABELS[job.status]}</Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                  {new Date(job.scheduledAt).toLocaleString("th-TH", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {job.tags.map((jt) => (
                      <TagBadge
                        key={jt.tag.id}
                        name={jt.tag.name}
                        color={jt.tag.color}
                      />
                    ))}
                    {job.tags.length === 0 ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  ไม่พบงานตามเงื่อนไข
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
