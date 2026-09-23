"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { formatThb, parseThbToSatang } from "@/lib/money";
import { useTRPC } from "@/trpc/client";

export default function ExpensesPage() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const categories = useQuery(trpc.expense.categories.queryOptions());
  const list = useQuery(trpc.expense.list.queryOptions());
  const [categoryId, setCategoryId] = useState("");
  const [spentAt, setSpentAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [thb, setThb] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const create = useMutation(
    trpc.expense.create.mutationOptions({
      onSuccess: async () => {
        await qc.invalidateQueries(trpc.expense.list.queryFilter());
        setThb("");
        setNote("");
      },
      onError: (e) => setError(e.message),
    }),
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">ค่าใช้จ่าย</h1>

      <form
        className="max-w-lg space-y-3 rounded-lg border border-border bg-background p-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          const amountSatang = parseThbToSatang(thb);
          if (!categoryId) {
            setError("เลือกหมวด");
            return;
          }
          if (amountSatang == null) {
            setError("จำนวนเงินไม่ถูกต้อง");
            return;
          }
          create.mutate({
            categoryId,
            amountSatang,
            spentAt: new Date(spentAt),
            note: note || null,
          });
        }}
      >
        <h2 className="font-medium">บันทึกรายการ</h2>
        <label className="block space-y-1 text-sm">
          <span className="text-muted-foreground">หมวด</span>
          <select
            className={inputClass}
            required
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">— เลือก —</option>
            {(categories.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-muted-foreground">วันที่</span>
          <input
            className={inputClass}
            type="date"
            required
            value={spentAt}
            onChange={(e) => setSpentAt(e.target.value)}
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-muted-foreground">จำนวน (บาท)</span>
          <input
            className={inputClass}
            required
            inputMode="decimal"
            value={thb}
            onChange={(e) => setThb(e.target.value)}
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-muted-foreground">โน้ต</span>
          <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" disabled={create.isPending}>
          ส่งรออนุมัติ
        </Button>
      </form>

      <section className="space-y-2">
        <h2 className="font-medium">รายการ</h2>
        <ul className="divide-y divide-border rounded-lg border border-border bg-background text-sm">
          {(list.data ?? []).map((e) => (
            <li key={e.id} className="flex flex-wrap justify-between gap-2 px-4 py-3">
              <div>
                <p className="font-medium">{e.category.name}</p>
                <p className="text-muted-foreground">
                  {new Date(e.spentAt).toLocaleDateString("th-TH")} · {e.createdBy.name}
                  {e.note ? ` · ${e.note}` : ""}
                </p>
              </div>
              <div className="text-right">
                <p>{formatThb(e.amountSatang)}</p>
                <p className="text-muted-foreground">{e.status}</p>
              </div>
            </li>
          ))}
          {list.data?.length === 0 ? (
            <li className="px-4 py-8 text-center text-muted-foreground">ยังไม่มีรายการ</li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
