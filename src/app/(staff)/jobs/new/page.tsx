"use client";

import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";

import { SplitTemplateManager } from "@/components/split-template-manager";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { shopPct } from "@/domain/split";
import type { GuestEngagement, ServiceType } from "@/generated/prisma/enums";
import { parseThbToSatang } from "@/lib/money";
import { useTRPC } from "@/trpc/client";

const selectClassName =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";

const ENGAGEMENT_LABELS: Record<GuestEngagement, string> = {
  none: "ช่างประจำ",
  guest_sourced: "Guest A — หาลูกค้าเอง",
  shop_overflow: "Guest B — ร้านส่งงาน",
};


function defaultScheduledAt() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

const jobFormSchema = z
  .object({
    engagement: z.enum(["none", "guest_sourced", "shop_overflow"]),
    templateId: z.string(),
    title: z.string().trim().min(1, "ใส่ชื่องาน"),
    scheduledAt: z.string().min(1, "ใส่วันนัด"),
    ownerUserId: z.string(),
    ownerGuestId: z.string(),
    referralUserId: z.string(),
    artistPct: z.number().int().min(0).max(100),
    referralPct: z.number().int().min(0).max(100),
    estimateThb: z.string(),
    customerName: z.string(),
    styleNote: z.string(),
    serviceType: z.enum(["tattoo", "nail", "lash", "class", "other"]),
  })
  .superRefine((value, ctx) => {
    if (value.artistPct + value.referralPct > 100) {
      ctx.addIssue({
        code: "custom",
        message: "Artist + Referral ต้องไม่เกิน 100",
        path: ["artistPct"],
      });
    }
    if (value.engagement !== "none" && !value.ownerGuestId) {
      ctx.addIssue({
        code: "custom",
        message: "เลือก Guest profile",
        path: ["ownerGuestId"],
      });
    }
    if (value.estimateThb.trim() && parseThbToSatang(value.estimateThb) == null) {
      ctx.addIssue({
        code: "custom",
        message: "ยอดประมาณการไม่ถูกต้อง",
        path: ["estimateThb"],
      });
    }
  });

type JobFormValues = z.infer<typeof jobFormSchema>;

export default function NewJobPage() {
  const trpc = useTRPC();
  const router = useRouter();
  const qc = useQueryClient();
  const users = useQuery(trpc.user.list.queryOptions());
  const guests = useQuery(trpc.guestProfile.list.queryOptions());
  const me = useQuery(trpc.user.me.queryOptions());
  const [submitError, setSubmitError] = useState<string | null>(null);

  const create = useMutation(
    trpc.job.create.mutationOptions({
      onSuccess: async (job) => {
        await qc.invalidateQueries(trpc.job.list.queryFilter());
        router.push(`/jobs/${job.id}`);
      },
      onError: (e) => setSubmitError(e.message),
    }),
  );

  const form = useForm({
    defaultValues: {
      engagement: "none" as GuestEngagement,
      templateId: "",
      title: "",
      scheduledAt: "",
      ownerUserId: "",
      ownerGuestId: "",
      referralUserId: "",
      artistPct: 60,
      referralPct: 0,
      estimateThb: "",
      customerName: "",
      styleNote: "",
      serviceType: "tattoo" as ServiceType,
    } satisfies JobFormValues,
    validators: {
      onSubmit: jobFormSchema,
    },
    onSubmit: ({ value }) => {
      setSubmitError(null);
      const estimated = value.estimateThb.trim()
        ? parseThbToSatang(value.estimateThb)
        : null;
      if (value.estimateThb.trim() && estimated == null) {
        setSubmitError("ยอดประมาณการไม่ถูกต้อง");
        return;
      }

      const base = {
        title: value.title,
        serviceType: value.serviceType,
        scheduledAt: new Date(value.scheduledAt),
        styleNote: value.styleNote || null,
        customerName: value.customerName || null,
        estimatedTotalSatang: estimated,
        splitTemplateId: value.templateId || null,
        artistPct: value.artistPct,
        referralPct: value.engagement === "none" ? value.referralPct : 0,
        collaboratorIds: [] as string[],
      };

      if (value.engagement === "none") {
        const ownerUserId = value.ownerUserId || me.data?.id || "";
        if (!ownerUserId) {
          setSubmitError("เลือกเจ้าของงาน");
          return;
        }
        create.mutate({
          ...base,
          guestEngagement: "none",
          ownerUserId,
          referralUserId: value.referralUserId || null,
        });
        return;
      }

      create.mutate({
        ...base,
        guestEngagement: value.engagement,
        ownerGuestId: value.ownerGuestId,
      });
    },
  });

  useEffect(() => {
    if (!form.getFieldValue("scheduledAt")) {
      form.setFieldValue("scheduledAt", defaultScheduledAt());
    }
  }, [form]);

  const ownerOptions = useMemo(() => users.data ?? [], [users.data]);
  const guestOptions = useMemo(() => guests.data ?? [], [guests.data]);
  const defaultOwnerId = me.data?.id ?? "";

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">สร้างงาน</h1>
        <Link href="/jobs" className="text-sm text-muted-foreground hover:underline">
          กลับ
        </Link>
      </div>

      <form
        className="space-y-4 rounded-lg border border-border bg-background p-4"
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit();
        }}
      >
        <FieldGroup>
          <form.Field
            name="engagement"
            children={(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>ประเภท</FieldLabel>
                <select
                  id={field.name}
                  className={selectClassName}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => {
                    const next = e.target.value as GuestEngagement;
                    field.handleChange(next);
                    form.setFieldValue("templateId", "");
                    form.setFieldValue("referralUserId", "");
                    form.setFieldValue("referralPct", 0);
                    if (next === "guest_sourced") form.setFieldValue("artistPct", 70);
                    else if (next === "shop_overflow") form.setFieldValue("artistPct", 50);
                    else form.setFieldValue("artistPct", 60);
                  }}
                >
                  {(Object.keys(ENGAGEMENT_LABELS) as GuestEngagement[]).map((value) => (
                    <option key={value} value={value}>
                      {ENGAGEMENT_LABELS[value]}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          />

          <form.Subscribe
            selector={(state) =>
              [
                state.values.engagement,
                state.values.templateId,
                state.values.artistPct,
                state.values.referralPct,
              ] as const
            }
            children={([engagement, templateId]) => (
              <SplitTemplateManager
                engagement={engagement}
                selectedId={templateId}
                onSelect={(template) => {
                  if (!template) {
                    form.setFieldValue("templateId", "");
                    return;
                  }
                  form.setFieldValue("templateId", template.id);
                  form.setFieldValue("artistPct", template.artistPct);
                  form.setFieldValue(
                    "referralPct",
                    engagement === "none" ? template.referralPct : 0,
                  );
                  form.setFieldValue("serviceType", template.serviceType);
                }}
              />
            )}
          />

          <form.Field
            name="title"
            children={(field) => {
              const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>ชื่องาน</FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    required
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    aria-invalid={isInvalid}
                  />
                  {isInvalid ? <FieldError errors={field.state.meta.errors} /> : null}
                </Field>
              );
            }}
          />

          <form.Field
            name="scheduledAt"
            children={(field) => {
              const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>วันนัด</FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="datetime-local"
                    required
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    aria-invalid={isInvalid}
                  />
                  {isInvalid ? <FieldError errors={field.state.meta.errors} /> : null}
                </Field>
              );
            }}
          />

          <form.Subscribe
            selector={(state) => state.values.engagement}
            children={(engagement) =>
              engagement === "none" ? (
                <>
                  <form.Field
                    name="ownerUserId"
                    children={(field) => {
                      const value = field.state.value || defaultOwnerId;
                      const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid;
                      return (
                        <Field data-invalid={isInvalid}>
                          <FieldLabel htmlFor={field.name}>เจ้าของงาน</FieldLabel>
                          <select
                            id={field.name}
                            className={selectClassName}
                            required
                            value={value}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                          >
                            {ownerOptions.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.name}
                              </option>
                            ))}
                          </select>
                          {isInvalid ? (
                            <FieldError errors={field.state.meta.errors} />
                          ) : null}
                        </Field>
                      );
                    }}
                  />
                  <form.Field
                    name="referralUserId"
                    children={(field) => (
                      <Field>
                        <FieldLabel htmlFor={field.name}>Referral (ถ้ามี)</FieldLabel>
                        <select
                          id={field.name}
                          className={selectClassName}
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => {
                            const id = e.target.value;
                            field.handleChange(id);
                            if (!id) form.setFieldValue("referralPct", 0);
                            else if (form.getFieldValue("referralPct") === 0) {
                              form.setFieldValue("referralPct", 5);
                            }
                          }}
                        >
                          <option value="">— ไม่มี —</option>
                          {ownerOptions.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name}
                            </option>
                          ))}
                        </select>
                        <FieldDescription>เลือกได้ถ้ามีผู้แนะนำ</FieldDescription>
                      </Field>
                    )}
                  />
                </>
              ) : (
                <form.Field
                  name="ownerGuestId"
                  children={(field) => {
                    const isInvalid =
                      field.state.meta.isTouched && !field.state.meta.isValid;
                    return (
                      <Field data-invalid={isInvalid}>
                        <FieldLabel htmlFor={field.name}>Guest profile</FieldLabel>
                        <select
                          id={field.name}
                          className={selectClassName}
                          required
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                        >
                          <option value="">— เลือก —</option>
                          {guestOptions.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.name}
                            </option>
                          ))}
                        </select>
                        {isInvalid ? (
                          <FieldError errors={field.state.meta.errors} />
                        ) : null}
                      </Field>
                    );
                  }}
                />
              )
            }
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
                      required
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
              children={(field) => (
                <form.Subscribe
                  selector={(state) => state.values.engagement}
                  children={(engagement) => {
                    const disabled = engagement !== "none";
                    const isInvalid =
                      field.state.meta.isTouched && !field.state.meta.isValid;
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
                          onChange={(e) =>
                            field.handleChange(Number(e.target.value))
                          }
                          aria-invalid={isInvalid}
                        />
                        {isInvalid ? (
                          <FieldError errors={field.state.meta.errors} />
                        ) : null}
                      </Field>
                    );
                  }}
                />
              )}
            />
          </div>

          <form.Subscribe
            selector={(state) =>
              [state.values.artistPct, state.values.referralPct, state.values.engagement] as const
            }
            children={([artistPct, referralPct, engagement]) => (
              <p className="text-sm text-muted-foreground">
                ร้าน{" "}
                {shopPct({
                  artistPct,
                  referralPct: engagement === "none" ? referralPct : 0,
                })}
                % (แก้ได้ต่องานหลังเลือกหมวด)
              </p>
            )}
          />

          <form.Field
            name="estimateThb"
            children={(field) => {
              const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>ยอดประมาณการ (บาท)</FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    inputMode="decimal"
                    placeholder="เช่น 5000"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    aria-invalid={isInvalid}
                  />
                  {isInvalid ? <FieldError errors={field.state.meta.errors} /> : null}
                </Field>
              );
            }}
          />

          <form.Field
            name="customerName"
            children={(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>ชื่อลูกค้า</FieldLabel>
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              </Field>
            )}
          />

          <form.Field
            name="styleNote"
            children={(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>โน้ตสไตล์</FieldLabel>
                <Textarea
                  id={field.name}
                  name={field.name}
                  rows={2}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              </Field>
            )}
          />
        </FieldGroup>

        {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}
        <Button type="submit" className="w-full" disabled={create.isPending}>
          {create.isPending ? "กำลังสร้าง…" : "สร้างงาน"}
        </Button>
      </form>
    </div>
  );
}
