"use client";

import { Field } from "@/components/field";
import { PasswordInput } from "@/components/password-input";
import { ThemeToggle } from "@/components/theme-toggle";
import { getSession, setSession } from "@/lib/client/session";
import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";

type LoginResponse = {
  token: string;
  expiresIn: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: "ADMIN" | "SUPERVISOR" | "EMPLOYEE";
    mustChangePassword?: boolean;
  };
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (getSession()) window.location.replace("/dashboard");
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await response.json()) as Partial<LoginResponse> & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Não foi possível entrar.");
      }

      if (!data.token || !data.user) {
        throw new Error("Resposta de login inválida.");
      }

      setSession({
        token: data.token,
        user: {
          ...data.user,
          mustChangePassword: !!data.user.mustChangePassword,
        },
      });
      toast.success(`Bem-vindo, ${data.user.name}!`);
      window.location.replace("/dashboard");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro no login.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8 sm:py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,#4d6aff33,transparent_40%),radial-gradient(circle_at_bottom_right,#10b98133,transparent_35%),linear-gradient(160deg,#040b1f_0%,#0a1f44_45%,#0f3b8a_100%)]" />
      <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:48px_48px]" />

      <div className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6">
        <ThemeToggle className="border-white/20 bg-white/10 text-white hover:bg-white/20" />
      </div>

      <section className="relative w-full max-w-md rounded-3xl border border-white/15 bg-adc-surface/95 p-5 shadow-2xl backdrop-blur sm:p-8">
        <div className="flex items-center gap-3">
          <Image
            src="/adc-logo.png"
            alt="ADC Benefícios"
            width={48}
            height={48}
            className="rounded-xl"
            priority
          />
          <div>
            <p className="text-sm font-semibold tracking-wide text-adc-blue">
              ADC Benefícios
            </p>
            <p className="text-xs text-adc-muted">Estocke · Gestão de estoque</p>
          </div>
        </div>

        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-adc-navy sm:text-3xl">
          Entrar
        </h1>
        <p className="mt-3 text-sm leading-6 text-adc-muted">
          Acesse com seu e-mail e senha para gerenciar o estoque da ADC.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5" autoComplete="on">
          <Field label="E-mail" required>
            <input
              type="email"
              name="email"
              id="login-email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="input"
              required
              autoComplete="email"
              inputMode="email"
            />
          </Field>

          <PasswordInput
            label="Senha"
            name="password"
            id="login-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoComplete="current-password"
          />

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-adc-muted">
          Contas são criadas pelo administrador na aba Funcionários.
        </p>
      </section>
    </main>
  );
}
