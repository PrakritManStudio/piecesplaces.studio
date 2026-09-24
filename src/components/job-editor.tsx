"use client";

import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { z } from "zod";

import { JobTagPicker } from "@/components/job-tag-picker";
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
import type { GuestEngagement } from "@/generated/prisma/enums";
import { ENGAGEMENT_LABELS } from "@/lib/labels";
import { staffPath } from "@/lib/staff-paths";
import { useTRPC } from "@/trpc/client";

const selectClassName =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";

export const jobFormSchema = z
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
    customerName: z.string(),
    styleNote: z.string(),
    serviceType: z.enum(["tattoo", "nail", "lash", "class", "other"]),
    tagIds: z.array(z.string()),
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
  });

export type JobFormValues = z.infer<typeof jobFormSchema>;

export function toDatetimeLocalValue(date: Date | string) {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function defaultScheduledAt() {
  return toDatetimeLocalValue(new Date());
}

type JobEditorProps =
  | {
      mode: "create";
      initialValues?: Partial<JobFormValues>;
      collaboratorIds?: string[];
    }
  | {
      mode: "edit";
      jobId: string;
      initialValues: JobFormValues;
      collaboratorIds: string[];
      lockMoneyFields?: boolean;
    };

export function JobEditor(props: JobEditorProps) {
  const trpc = useTRPC();
  const router = useRouter();
  const qc = useQueryClient();
  const users = useQuery(trpc.user.list.queryOptions());
  const guests = useQuery(trpc.guestProfile.list.queryOptions());
  const tags = useQuery(trpc.tag.list.queryOptions());
  const me = useQuery(trpc.user.me.queryOptions());
  const [submitError, setSubmitError] = useState<string | null>(null);

  const lockMoney = props.mode === "edit" && Boolean(props.lockMoneyFields);

  const create = useMutation(
    trpc.job.create.mutationOptions({
      onSuccess: async (job) => {
        await qc.invalidateQueries(trpc.job.list.queryFilter());
        router.push(staffPath.job(job.id));
      },
      onError: (e) => setSubmitError(e.message),
    }),
  );

  const update = useMutation(
    trpc.job.update.mutationOptions({
      onSuccess: async (job) => {
        await qc.invalidateQueries(trpc.job.list.queryFilter());
        await qc.invalidateQueries(trpc.job.byId.queryFilter({ id: job.id }));
        router.push(staffPath.job(job.id));
      },
      onError: (e) => setSubmitError(e.message),
    }),
  );

  const defaults: JobFormValues = {
    engagement: "none",
    templateId: "",
    title: "",
    scheduledAt: defaultScheduledAt(),
    ownerUserId: "",
    ownerGuestId: "",
    referralUserId: "",
    artistPct: 60,
    referralPct: 0,
    customerName: "",
    styleNote: "",
    serviceType: "tattoo",
    tagIds: [],
    ...props.initialValues,
  };

  const form = useForm({
    defaultValues: defaults,
    validators: {
      onSubmit: jobFormSchema,
    },
    onSubmit: ({ value }) => {
      setSubmitError(null);

      const collaboratorIds =
        props.mode === "edit"
          ? props.collaboratorIds
          : (props.collaboratorIds ?? []);

      const base = {
        title: value.title,
        serviceType: value.serviceType,
        scheduledAt: new Date(value.scheduledAt),
        styleNote: value.styleNote || null,
        customerName: value.customerName || null,
        splitTemplateId: value.templateId || null,
        artistPct: value.artistPct,
        referralPct: value.engagement === "none" ? value.referralPct : 0,
        collaboratorIds,
        tagIds: value.tagIds,
      };

      if (value.engagement === "none") {
        const ownerUserId = value.ownerUserId || me.data?.id || "";
        if (!ownerUserId) {
          setSubmitError("เลือกเจ้าของงาน");
          return;
        }
        const payload = {
          ...base,
          guestEngagement: "none" as const,
          ownerUserId,
          referralUserId: value.referralUserId || null,
        };
        if (props.mode === "edit") {
          update.mutate({ id: props.jobId, data: payload });
        } else {
          create.mutate(payload);
        }
        return;
      }

      const payload = {
        ...base,
        guestEngagement: value.engagement,
        ownerGuestId: value.ownerGuestId,
      };
      if (props.mode === "edit") {
        update.mutate({ id: props.jobId, data: payload });
      } else {
        create.mutate(payload);
      }
    },
  });

  const ownerOptions = useMemo(() => users.data ?? [], [users.data]);
  const guestOptions = useMemo(() => guests.data ?? [], [guests.data]);
  const defaultOwnerId = me.data?.id ?? "";
  const pending = create.isPending || update.isPending;
  const backHref = props.mode === "edit" ? staffPath.job(props.jobId) : staffPath.jobs;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {props.mode === "edit" ? "แก้ไขงาน" : "สร้างงาน"}
        </h1>
        <Link href={backHref} className="text-sm text-muted-foreground hover:underline">
          กลับ
        </Link>
      </div>

      {lockMoney ? (
        <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          งานนี้ไม่ใช่สถานะเปิด — แก้เจ้าของ / Referral / อัตรา % ไม่ได้
        </p>
      ) : null}

      <form
        className="space-y-4 rounded-lg border border-border bg-background p-4"
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit();
        }}
      >
        <FieldGroup>
          <form.Field name="engagement">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>ประเภท</FieldLabel>
                <select
                  id={field.name}
                  className={selectClassName}
                  value={field.state.value}
                  disabled={lockMoney}
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
          </form.Field>

          <form.Subscribe
            selector={(state) =>
              [
                state.values.engagement,
                state.values.templateId,
                state.values.artistPct,
                state.values.referralPct,
              ] as const
            }
          >
            {([engagement, templateId]) => (
              <SplitTemplateManager
                engagement={engagement}
                selectedId={templateId}
                editable={false}
                onSelect={(template) => {
                  if (lockMoney) return;
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
          </form.Subscribe>

          <form.Field name="title">
            {(field) => {
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
          </form.Field>

          <form.Field name="scheduledAt">
            {(field) => {
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
          </form.Field>

          <form.Subscribe selector={(state) => state.values.engagement}>
            {(engagement) =>
              engagement === "none" ? (
                <>
                  <form.Field name="ownerUserId">
                    {(field) => {
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
                            disabled={lockMoney}
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
                  </form.Field>
                  <form.Field name="referralUserId">
                    {(field) => (
                      <Field>
                        <FieldLabel htmlFor={field.name}>Referral (ถ้ามี)</FieldLabel>
                        <select
                          id={field.name}
                          className={selectClassName}
                          disabled={lockMoney}
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
                  </form.Field>
                </>
              ) : (
                <form.Field name="ownerGuestId">
                  {(field) => {
                    const isInvalid =
                      field.state.meta.isTouched && !field.state.meta.isValid;
                    return (
                      <Field data-invalid={isInvalid}>
                        <FieldLabel htmlFor={field.name}>Guest profile</FieldLabel>
                        <select
                          id={field.name}
                          className={selectClassName}
                          required
                          disabled={lockMoney}
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
                </form.Field>
              )
            }
          </form.Subscribe>

          <div className="grid grid-cols-2 gap-3">
            <form.Field name="artistPct">
              {(field) => {
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
                      disabled={lockMoney}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(Number(e.target.value))}
                      aria-invalid={isInvalid}
                    />
                    {isInvalid ? <FieldError errors={field.state.meta.errors} /> : null}
                  </Field>
                );
              }}
            </form.Field>
            <form.Field name="referralPct">
              {(field) => (
                <form.Subscribe selector={(state) => state.values.engagement}>
                  {(engagement) => {
                    const disabled = lockMoney || engagement !== "none";
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
                          value={engagement !== "none" ? 0 : field.state.value}
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
                </form.Subscribe>
              )}
            </form.Field>
          </div>

          <form.Subscribe
            selector={(state) =>
              [state.values.artistPct, state.values.referralPct, state.values.engagement] as const
            }
          >
            {([artistPct, referralPct, engagement]) => (
              <p className="text-sm text-muted-foreground">
                ร้าน{" "}
                {shopPct({
                  artistPct,
                  referralPct: engagement === "none" ? referralPct : 0,
                })}
                %
              </p>
            )}
          </form.Subscribe>

          <form.Field name="customerName">
            {(field) => (
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
          </form.Field>

          <form.Field name="styleNote">
            {(field) => (
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
          </form.Field>

          <form.Field name="tagIds">
            {(field) => (
              <Field>
                <FieldLabel>Tags</FieldLabel>
                <JobTagPicker
                  options={tags.data ?? []}
                  value={field.state.value}
                  onChange={(next) => field.handleChange(next)}
                />
              </Field>
            )}
          </form.Field>
        </FieldGroup>

        {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending
            ? props.mode === "edit"
              ? "กำลังบันทึก…"
              : "กำลังสร้าง…"
            : props.mode === "edit"
              ? "บันทึกการแก้ไข"
              : "สร้างงาน"}
        </Button>
      </form>
    </div>
  );
}
