"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  signInWithEmailPassword,
  signInWithGoogle,
} from "@/lib/auth-client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@admin.admin");
  const [password, setPassword] = useState("admin@admin.admin");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"email" | "google" | null>(null);

  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
            Staff
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Pieces Places Studio
          </h1>
          <p className="text-sm text-muted-foreground">
            เข้าสู่ระบบชั่วคราวด้วยอีเมล หรือ Google
          </p>
        </div>

        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setPending("email");
            setError(null);
            const { error } = await signInWithEmailPassword(
              email.trim(),
              password,
              "/jobs",
            );
            if (error) {
              setError(error.message ?? "เข้าสู่ระบบไม่สำเร็จ");
              setPending(null);
              return;
            }
            router.push("/jobs");
            router.refresh();
          }}
        >
          <label className="block space-y-1 text-left text-sm">
            <span className="text-muted-foreground">อีเมล</span>
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <label className="block space-y-1 text-left text-sm">
            <span className="text-muted-foreground">รหัสผ่าน</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={pending !== null}
          >
            {pending === "email" ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบด้วยอีเมล"}
          </Button>
        </form>

        <div className="relative text-center text-xs text-muted-foreground">
          <span className="bg-zinc-50 px-2">หรือ</span>
          <div className="absolute inset-x-0 top-1/2 -z-10 h-px bg-border" />
        </div>

        <Button
          className="w-full"
          size="lg"
          variant="outline"
          disabled={pending !== null}
          onClick={async () => {
            setPending("google");
            setError(null);
            const { error } = await signInWithGoogle("/jobs");
            if (error) {
              setError(error.message ?? "เข้าสู่ระบบด้วย Google ไม่สำเร็จ");
              setPending(null);
              return;
            }
            router.refresh();
          }}
        >
          {pending === "google" ? "กำลังเปิด Google…" : "เข้าสู่ระบบด้วย Google"}
        </Button>

        {error ? (
          <p className="text-center text-sm text-destructive">{error}</p>
        ) : null}
      </div>
    </div>
  );
}
