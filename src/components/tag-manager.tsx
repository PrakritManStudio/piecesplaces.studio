"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PencilIcon, PlusIcon, TrashIcon } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useTRPC } from "@/trpc/client";

const COLOR_PRESETS = [
  "#64748b",
  "#0f766e",
  "#1d4ed8",
  "#7c3aed",
  "#be123c",
  "#c2410c",
  "#a16207",
] as const;

type TagRow = {
  id: string;
  name: string;
  color: string | null;
  active: boolean;
};

type EditorMode =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; tag: TagRow };

export function TagManager() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const tags = useQuery(trpc.tag.list.queryOptions({ includeInactive: true }));
  const [editor, setEditor] = useState<EditorMode>({ kind: "closed" });
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(COLOR_PRESETS[0]);
  const [error, setError] = useState<string | null>(null);

  const invalidate = () => qc.invalidateQueries(trpc.tag.list.queryFilter());

  const create = useMutation(
    trpc.tag.create.mutationOptions({
      onSuccess: async () => {
        await invalidate();
        setEditor({ kind: "closed" });
      },
      onError: (e) => setError(e.message),
    }),
  );
  const update = useMutation(
    trpc.tag.update.mutationOptions({
      onSuccess: async () => {
        await invalidate();
        setEditor({ kind: "closed" });
      },
      onError: (e) => setError(e.message),
    }),
  );
  const deactivate = useMutation(
    trpc.tag.deactivate.mutationOptions({
      onSuccess: invalidate,
      onError: (e) => setError(e.message),
    }),
  );
  const remove = useMutation(
    trpc.tag.delete.mutationOptions({
      onSuccess: invalidate,
      onError: (e) => setError(e.message),
    }),
  );

  function openCreate() {
    setName("");
    setColor(COLOR_PRESETS[0]);
    setError(null);
    setEditor({ kind: "create" });
  }

  function openEdit(tag: TagRow) {
    setName(tag.name);
    setColor(tag.color ?? COLOR_PRESETS[0]);
    setError(null);
    setEditor({ kind: "edit", tag });
  }

  function submit() {
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError("ใส่ชื่อ tag");
      return;
    }
    if (editor.kind === "create") {
      create.mutate({ name: trimmed, color, active: true });
      return;
    }
    if (editor.kind === "edit") {
      update.mutate({
        id: editor.tag.id,
        name: trimmed,
        color,
        active: editor.tag.active,
      });
    }
  }

  const rows = tags.data ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">ใช้ติดกับงานเพื่อกรองและจัดกลุ่ม</p>
        <Button type="button" size="sm" onClick={openCreate}>
          <PlusIcon />
          เพิ่ม tag
        </Button>
      </div>

      {error && editor.kind === "closed" ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}

      {tags.isLoading ? <p className="text-sm text-muted-foreground">กำลังโหลด…</p> : null}

      <ul className="divide-y divide-border rounded-lg border border-border bg-background">
        {rows.map((tag) => (
          <li key={tag.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <Badge
                variant="outline"
                style={
                  tag.color
                    ? { borderColor: tag.color, color: tag.color }
                    : undefined
                }
              >
                {tag.name}
              </Badge>
              {!tag.active ? (
                <span className="text-xs text-muted-foreground">ปิดใช้งาน</span>
              ) : null}
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                onClick={() => openEdit(tag)}
                aria-label="แก้ไข"
              >
                <PencilIcon />
              </Button>
              {tag.active ? (
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => {
                    setError(null);
                    deactivate.mutate({ id: tag.id });
                  }}
                >
                  ปิด
                </Button>
              ) : (
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => {
                    setError(null);
                    update.mutate({
                      id: tag.id,
                      name: tag.name,
                      color: tag.color,
                      active: true,
                    });
                  }}
                >
                  เปิด
                </Button>
              )}
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                onClick={() => {
                  setError(null);
                  remove.mutate({ id: tag.id });
                }}
                aria-label="ลบ"
              >
                <TrashIcon />
              </Button>
            </div>
          </li>
        ))}
        {rows.length === 0 && !tags.isLoading ? (
          <li className="px-4 py-6 text-center text-sm text-muted-foreground">
            ยังไม่มี tag
          </li>
        ) : null}
      </ul>

      <Dialog
        open={editor.kind !== "closed"}
        onOpenChange={(open) => {
          if (!open) setEditor({ kind: "closed" });
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editor.kind === "edit" ? "แก้ไข tag" : "เพิ่ม tag"}
            </DialogTitle>
            <DialogDescription>ตั้งชื่อและสีสำหรับแสดงบนงาน</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="tag-name">ชื่อ</FieldLabel>
              <Input
                id="tag-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="เช่น VIP, ด่วน"
              />
            </Field>
            <Field>
              <FieldLabel>สี</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`size-7 rounded-full border-2 ${
                      color === c ? "border-foreground" : "border-transparent"
                    }`}
                    style={{ backgroundColor: c }}
                    onClick={() => setColor(c)}
                    aria-label={c}
                  />
                ))}
              </div>
            </Field>
            {error ? <FieldError>{error}</FieldError> : null}
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditor({ kind: "closed" })}
            >
              ยกเลิก
            </Button>
            <Button
              type="button"
              onClick={submit}
              disabled={create.isPending || update.isPending}
            >
              บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
