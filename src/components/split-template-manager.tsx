"use client";

import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PencilIcon, PlusIcon, TrashIcon } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { shopPct } from "@/domain/split";
import type { GuestEngagement, ServiceType } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";

const selectClassName =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";

const SERVICE_LABELS: Record<ServiceType, string> = {
  tattoo: "สัก",
  nail: "ทำเล็บ",
  lash: "ต่อขนตา",
  class: "คลาส",
  other: "อื่นๆ",
};


const templateFormSchema = z
  .object({
    label: z.string().trim().min(1, "ใส่ชื่อหมวด"),
    serviceType: z.enum(["tattoo", "nail", "lash", "class", "other"]),
    artistPct: z.number().int().min(0).max(100),
    referralPct: z.number().int().min(0).max(100),
  })
  .superRefine((value, ctx) => {
    if (value.artistPct + value.referralPct > 100) {
      ctx.addIssue({
        code: "custom",
        message: "Artist + Referral ต้องไม่เกิน 100",
        path: ["artistPct"],
      });
    }
  });

type TemplateFormValues = z.infer<typeof templateFormSchema>;

type TemplateRow = {
  id: string;
  label: string;
  serviceType: ServiceType;
  guestEngagement: GuestEngagement;
  artistPct: number;
  referralPct: number;
};

type EditorMode =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; template: TemplateRow };

function defaultPcts(engagement: GuestEngagement) {
  if (engagement === "guest_sourced") return { artistPct: 70, referralPct: 0 };
  if (engagement === "shop_overflow") return { artistPct: 50, referralPct: 0 };
  return { artistPct: 60, referralPct: 0 };
}

export function SplitTemplateManager(props: {
  engagement: GuestEngagement;
  selectedId: string;
  onSelect: (template: TemplateRow | null) => void;
}) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const templates = useQuery(trpc.splitTemplate.list.queryOptions());
  const [editor, setEditor] = useState<EditorMode>({ kind: "closed" });
  const [actionError, setActionError] = useState<string | null>(null);

  const filtered = (templates.data ?? []).filter(
    (t) => t.guestEngagement === props.engagement,
  );

  async function invalidate() {
    await qc.invalidateQueries(trpc.splitTemplate.list.queryFilter());
  }

  const create = useMutation(
    trpc.splitTemplate.create.mutationOptions({
      onSuccess: async (created) => {
        await invalidate();
        props.onSelect(created);
        setEditor({ kind: "closed" });
      },
      onError: (e) => setActionError(e.message),
    }),
  );

  const update = useMutation(
    trpc.splitTemplate.update.mutationOptions({
      onSuccess: async (updated) => {
        await invalidate();
        if (props.selectedId === updated.id) props.onSelect(updated);
        setEditor({ kind: "closed" });
      },
      onError: (e) => setActionError(e.message),
    }),
  );

  const remove = useMutation(
    trpc.splitTemplate.delete.mutationOptions({
      onSuccess: async (_data, vars) => {
        await invalidate();
        if (props.selectedId === vars.id) props.onSelect(null);
        setActionError(null);
      },
      onError: (e) => setActionError(e.message),
    }),
  );

  const deactivate = useMutation(
    trpc.splitTemplate.deactivate.mutationOptions({
      onSuccess: async (_data, vars) => {
        await invalidate();
        if (props.selectedId === vars.id) props.onSelect(null);
        setActionError(null);
      },
      onError: (e) => setActionError(e.message),
    }),
  );

  async function handleRemove(template: TemplateRow) {
    setActionError(null);
    try {
      await remove.mutateAsync({ id: template.id });
    } catch {
      if (confirm(`หมวด “${template.label}” ถูกใช้กับงานแล้ว — ปิดใช้งานแทนไหม?`)) {
        await deactivate.mutateAsync({ id: template.id });
      }
    }
  }

  const editorInitial: TemplateFormValues =
    editor.kind === "edit"
      ? {
          label: editor.template.label,
          serviceType: editor.template.serviceType,
          artistPct: editor.template.artistPct,
          referralPct: editor.template.referralPct,
        }
      : {
          label: "",
          serviceType: "tattoo",
          ...defaultPcts(props.engagement),
        };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">หมวด (template)</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setActionError(null);
            setEditor({ kind: "create" });
          }}
        >
          <PlusIcon />
          เพิ่มหมวด
        </Button>
      </div>

      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
        {filtered.map((t) => {
          const selected = props.selectedId === t.id;
          const shop = shopPct(t);
          return (
            <li
              key={t.id}
              className={cn(
                "flex items-start gap-2 px-3 py-2 text-sm",
                selected && "bg-muted",
              )}
            >
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => props.onSelect(t)}
              >
                <p className="font-medium">{t.label}</p>
                <p className="text-muted-foreground">
                  {SERVICE_LABELS[t.serviceType]} · Artist {t.artistPct}% · Referral{" "}
                  {t.referralPct}% · ร้าน {shop}%
                </p>
              </button>
              <div className="flex shrink-0 gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`แก้ไข ${t.label}`}
                  onClick={() => {
                    setActionError(null);
                    setEditor({ kind: "edit", template: t });
                  }}
                >
                  <PencilIcon />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`ลบ ${t.label}`}
                  onClick={() => void handleRemove(t)}
                  disabled={remove.isPending || deactivate.isPending}
                >
                  <TrashIcon />
                </Button>
              </div>
            </li>
          );
        })}
        {filtered.length === 0 ? (
          <li className="px-3 py-6 text-center text-sm text-muted-foreground">
            ยังไม่มีหมวดสำหรับประเภทนี้ — กดเพิ่มหมวดเพื่อตั้ง % เริ่มต้น
          </li>
        ) : null}
      </ul>

      {actionError && editor.kind === "closed" ? (
        <p className="text-sm text-destructive">{actionError}</p>
      ) : null}

      <Dialog
        open={editor.kind !== "closed"}
        onOpenChange={(open) => {
          if (!open) setEditor({ kind: "closed" });
        }}
      >
        <DialogContent className="sm:max-w-md">
          {editor.kind !== "closed" ? (
            <TemplateEditorForm
              key={
                editor.kind === "edit"
                  ? `edit-${editor.template.id}`
                  : `create-${props.engagement}`
              }
              title={editor.kind === "edit" ? "แก้ไขหมวด" : "เพิ่มหมวด"}
              engagement={props.engagement}
              initial={editorInitial}
              pending={create.isPending || update.isPending}
              error={actionError}
              onCancel={() => setEditor({ kind: "closed" })}
              onSubmit={(value) => {
                setActionError(null);
                if (props.engagement !== "none" && value.referralPct > 0) {
                  setActionError("งาน Guest ไม่มี Referral");
                  return;
                }
                const payload = {
                  label: value.label,
                  serviceType: value.serviceType,
                  guestEngagement: props.engagement,
                  artistPct: value.artistPct,
                  referralPct: props.engagement === "none" ? value.referralPct : 0,
                  active: true,
                };
                if (editor.kind === "edit") {
                  update.mutate({ id: editor.template.id, ...payload });
                  return;
                }
                create.mutate(payload);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TemplateEditorForm(props: {
  title: string;
  engagement: GuestEngagement;
  initial: TemplateFormValues;
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (value: TemplateFormValues) => void;
}) {
  const form = useForm({
    defaultValues: props.initial,
    validators: {
      onSubmit: templateFormSchema,
    },
    onSubmit: ({ value }) => {
      props.onSubmit(value);
    },
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>{props.title}</DialogTitle>
        <DialogDescription>
          ตั้งชื่อหมวดและ % เริ่มต้น — ร้าน = 100 − Artist − Referral
        </DialogDescription>
      </DialogHeader>

      <form
        id="split-template-form"
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void form.handleSubmit();
        }}
      >
        <FieldGroup>
          <form.Field
            name="label"
            children={(field) => {
              const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>ชื่อหมวด</FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    aria-invalid={isInvalid}
                    placeholder="เช่น ช่างสักประจำ"
                  />
                  {isInvalid ? <FieldError errors={field.state.meta.errors} /> : null}
                </Field>
              );
            }}
          />

          <form.Field
            name="serviceType"
            children={(field) => {
              const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>ประเภทงาน</FieldLabel>
                    <select
                      id={field.name}
                      className={selectClassName}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value as ServiceType)}
                      aria-invalid={isInvalid}
                    >
                      {(Object.keys(SERVICE_LABELS) as ServiceType[]).map((key) => (
                        <option key={key} value={key}>
                          {SERVICE_LABELS[key]}
                        </option>
                      ))}
                    </select>
                    {isInvalid ? <FieldError errors={field.state.meta.errors} /> : null}
                  </Field>
              );
            }}
          />

          <div className="grid grid-cols-2 gap-3">
            <form.Field
              name="artistPct"
              children={(field) => {
                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>Artist %</FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="number"
                      min={0}
                      max={100}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(Number(e.target.value))}
                      aria-invalid={isInvalid}
                    />
                    {isInvalid ? <FieldError errors={field.state.meta.errors} /> : null}
                  </Field>
                );
              }}
            />
            <form.Field
              name="referralPct"
              children={(field) => {
                const disabled = props.engagement !== "none";
                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>Referral %</FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="number"
                      min={0}
                      max={100}
                      disabled={disabled}
                      value={disabled ? 0 : field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(Number(e.target.value))}
                      aria-invalid={isInvalid}
                    />
                    {disabled ? (
                      <FieldDescription>งาน Guest ไม่มี Referral</FieldDescription>
                    ) : null}
                    {isInvalid ? <FieldError errors={field.state.meta.errors} /> : null}
                  </Field>
                );
              }}
            />
          </div>

          <form.Subscribe
            selector={(state) => [state.values.artistPct, state.values.referralPct] as const}
            children={([artistPct, referralPct]) => (
              <p className="text-sm text-muted-foreground">
                ร้าน{" "}
                {Math.max(
                  0,
                  100 - artistPct - (props.engagement === "none" ? referralPct : 0),
                )}
                %
              </p>
            )}
          />
        </FieldGroup>

        {props.error ? <p className="text-sm text-destructive">{props.error}</p> : null}
      </form>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={props.onCancel}>
          ยกเลิก
        </Button>
        <Button type="submit" form="split-template-form" disabled={props.pending}>
          {props.pending ? "กำลังบันทึก…" : "บันทึก"}
        </Button>
      </DialogFooter>
    </>
  );
}
