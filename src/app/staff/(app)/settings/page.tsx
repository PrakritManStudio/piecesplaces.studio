"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { SplitTemplateManager } from "@/components/split-template-manager";
import { TagManager } from "@/components/tag-manager";
import type { GuestEngagement, ServiceType } from "@/generated/prisma/enums";
import { ENGAGEMENT_LABELS, SERVICE_LABELS } from "@/lib/labels";
import { useTRPC } from "@/trpc/client";

const ENGAGEMENTS: GuestEngagement[] = ["none", "guest_sourced", "shop_overflow"];
const SERVICE_TYPES = Object.keys(SERVICE_LABELS) as ServiceType[];

export default function SettingsPage() {
  const trpc = useTRPC();
  const me = useQuery(trpc.user.me.queryOptions());
  const [engagement, setEngagement] = useState<GuestEngagement>("none");
  const [selectedId, setSelectedId] = useState("");

  if (me.isLoading) return <p className="text-sm text-muted-foreground">กำลังโหลด…</p>;
  if (!me.data?.isAdmin) {
    return <p className="text-sm text-muted-foreground">เฉพาะ admin</p>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">ตั้งค่า</h1>
        <p className="text-sm text-muted-foreground">
          จัดการประเภทงาน หมวดแบ่ง % และ tags ที่ใช้กับงาน
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="font-medium">ประเภทงาน</h2>
        <ul className="divide-y divide-border rounded-lg border border-border bg-background text-sm">
          {SERVICE_TYPES.map((key) => (
            <li key={key} className="flex justify-between gap-2 px-4 py-2">
              <span>{SERVICE_LABELS[key]}</span>
              <span className="text-muted-foreground">{key}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          ประเภทงานเป็นค่าคงที่ในระบบ เปลี่ยนชื่อแสดงผลได้จากโค้ด labels
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">Tags</h2>
        <TagManager />
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">หมวด (template)</h2>
        <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-background p-0.5 text-sm">
          {ENGAGEMENTS.map((e) => (
            <button
              key={e}
              type="button"
              className={`rounded-md px-3 py-1.5 ${
                engagement === e ? "bg-muted font-medium" : "text-muted-foreground"
              }`}
              onClick={() => {
                setEngagement(e);
                setSelectedId("");
              }}
            >
              {ENGAGEMENT_LABELS[e]}
            </button>
          ))}
        </div>
        <SplitTemplateManager
          engagement={engagement}
          selectedId={selectedId}
          editable
          onSelect={(template) => setSelectedId(template?.id ?? "")}
        />
      </section>
    </div>
  );
}
