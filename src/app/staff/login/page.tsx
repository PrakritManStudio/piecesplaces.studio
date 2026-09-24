"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { signInWithGoogle } from "@/lib/auth-client";
import { STAFF_HOME } from "@/lib/staff-paths";

export default function StaffLoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

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
            เข้าสู่ระบบด้วย Google เท่านั้น · บัญชีต้องถูกสร้างโดย admin ก่อน
          </p>
        </div>

        <Button
          className="w-full"
          size="lg"
          disabled={pending}
          onClick={async () => {
            setPending(true);
            setError(null);
            const { error } = await signInWithGoogle(STAFF_HOME);
            if (error) {
              setError(error.message ?? "เข้าสู่ระบบด้วย Google ไม่สำเร็จ");
              setPending(false);
              return;
            }
          }}
        >
          {pending ? "กำลังเปิด Google…" : "เข้าสู่ระบบด้วย Google"}
        </Button>

        {error ? (
          <p className="text-center text-sm text-destructive">{error}</p>
        ) : null}
      </div>
    </div>
  );
}
