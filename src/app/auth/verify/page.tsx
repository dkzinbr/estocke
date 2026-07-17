"use client";

import { setSession } from "@/lib/client/session";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";

function VerifyAccessForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [status, setStatus] = useState<"idle" | "loading" | "error" | "ok">(
    "idle",
  );
  const [message, setMessage] = useState(
    token
      ? "Click the button below to confirm your access."
      : "Incomplete verification link.",
  );

  async function handleConfirm(event: FormEvent) {
    event.preventDefault();

    if (!token) {
      setStatus("error");
      setMessage("Verification token is missing.");
      return;
    }

    setStatus("loading");

    try {
      const response = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await response.json();

      if (!response.ok) {
        setStatus("error");
        setMessage(data.error ?? "Could not confirm access.");
        return;
      }

      setSession({ token: data.token, user: data.user });
      setStatus("ok");
      setMessage("Access confirmed. Redirecting...");
      router.replace("/dashboard");
    } catch {
      setStatus("error");
      setMessage("Connection failed while confirming access.");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <form
        onSubmit={handleConfirm}
        className="w-full max-w-md rounded-2xl border border-adc-border bg-white p-8 shadow-sm"
      >
        <p className="text-sm font-medium tracking-wide text-adc-blue">Estocke</p>
        <h1 className="mt-2 text-2xl font-semibold text-adc-navy">
          Confirm access
        </h1>
        <p className="mt-3 text-sm leading-6 text-adc-muted">{message}</p>

        <button
          type="submit"
          disabled={!token || status === "loading" || status === "ok"}
          className="mt-8 w-full rounded-xl bg-adc-blue px-4 py-3 text-sm font-semibold text-white transition hover:bg-adc-brand disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "loading" ? "Confirming..." : "Confirm access"}
        </button>
      </form>
    </main>
  );
}

export default function VerifyAccessPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-background px-4">
          <p className="text-sm text-adc-muted">Loading verification...</p>
        </main>
      }
    >
      <VerifyAccessForm />
    </Suspense>
  );
}
