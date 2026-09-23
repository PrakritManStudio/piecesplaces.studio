"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";

import { JobEditor, toDatetimeLocalValue } from "@/components/job-editor";
import { useTRPC } from "@/trpc/client";

export default function EditJobPage() {
  const { id } = useParams<{ id: string }>();
  const trpc = useTRPC();
  const job = useQuery(trpc.job.byId.queryOptions({ id }));
  const me = useQuery(trpc.user.me.queryOptions());

  if (job.isLoading || me.isLoading) {
    return <p className="text-sm text-muted-foreground">กำลังโหลด…</p>;
  }
  if (job.error || !job.data) {
    return (
      <p className="text-sm text-destructive">{job.error?.message ?? "ไม่พบงาน"}</p>
    );
  }

  const j = job.data;
  if (!j.canEdit) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">ไม่มีสิทธิ์แก้ไขงานนี้</p>
        <Link href={`/jobs/${id}`} className="text-sm underline">
          กลับหน้ารายละเอียด
        </Link>
      </div>
    );
  }

  if (j.status !== "open" && !me.data?.isAdmin) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          งานที่ส่งปิดหรือปิดแล้ว แก้ได้เฉพาะ admin
        </p>
        <Link href={`/jobs/${id}`} className="text-sm underline">
          กลับหน้ารายละเอียด
        </Link>
      </div>
    );
  }

  return (
    <JobEditor
      key={j.id}
      mode="edit"
      jobId={j.id}
      lockMoneyFields={j.status !== "open"}
      collaboratorIds={j.collaborators.map((c) => c.user.id)}
      initialValues={{
        engagement: j.guestEngagement,
        templateId: j.splitTemplate?.id ?? "",
        title: j.title,
        scheduledAt: toDatetimeLocalValue(j.scheduledAt),
        ownerUserId: j.ownerUser?.id ?? "",
        ownerGuestId: j.ownerGuest?.id ?? "",
        referralUserId: j.referralUser?.id ?? "",
        artistPct: j.artistPct,
        referralPct: j.referralPct,
        customerName: j.customerName ?? "",
        styleNote: j.styleNote ?? "",
        serviceType: j.serviceType,
        tagIds: j.tags.map((jt) => jt.tag.id),
      }}
    />
  );
}
