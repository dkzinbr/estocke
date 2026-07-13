"use client";

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

      window.localStorage.setItem("estocke_token", data.token);
      window.localStorage.setItem("estocke_user", JSON.stringify(data.user));
      setStatus("ok");
      setMessage("Access confirmed. Redirecting...");
      router.replace("/");
    } catch {
      setStatus("error");
      setMessage("Connection failed while confirming access.");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <form
        onSubmit={handleConfirm}
        className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm"
      >
        <p className="text-sm font-medium tracking-wide text-teal-700">Estocke</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
          Confirm access
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">{message}</p>

        <button
          type="submit"
          disabled={!token || status === "loading" || status === "ok"}
          className="mt-8 w-full rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
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
        <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
          <p className="text-sm text-zinc-600">Loading verification...</p>
        </main>
      }
    >
      <VerifyAccessForm />
    </Suspense>
  );
}
