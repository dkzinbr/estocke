"use client";

import { PasswordInput } from "@/components/password-input";
import { ThemeToggle } from "@/components/theme-toggle";
import { getSession, setSession } from "@/lib/client/session";
import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";

type DepartmentOption = {
  id: string;
  name: string;
};

type RegisterResponse = {
  token: string;
  expiresIn: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: "ADMIN" | "SUPERVISOR" | "EMPLOYEE";
  };
};

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [loadingDepartments, setLoadingDepartments] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (getSession()) window.location.replace("/dashboard");
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void (async () => {
        setLoadingDepartments(true);
        try {
          const response = await fetch("/api/departments?active=true");
          const data = (await response.json()) as
            | DepartmentOption[]
            | { error?: string };

          if (!response.ok || !Array.isArray(data)) {
            throw new Error(
              !Array.isArray(data) && data.error
                ? data.error
                : "Não foi possível carregar departamentos.",
            );
          }

          setDepartments(data);
          setDepartmentId(data[0]?.id ?? "");
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Erro ao carregar departamentos.",
          );
        } finally {
          setLoadingDepartments(false);
        }
      })();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!email.trim().toLowerCase().endsWith("@adcbeneficios.com.br")) {
      toast.error("Use um e-mail @adcbeneficios.com.br.");
      return;
    }

    if (!departmentId) {
      toast.error("Selecione um departamento.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }

    if (password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, departmentId }),
      });
      const data = (await response.json()) as Partial<RegisterResponse> & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Não foi possível criar a conta.");
      }

      if (!data.token || !data.user) {
        throw new Error("Resposta de cadastro inválida.");
      }

      setSession({ token: data.token, user: data.user });
      toast.success(`Conta criada. Bem-vindo, ${data.user.name}!`);
      window.location.replace("/dashboard");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao criar conta.",
      );
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
          Criar conta
        </h1>
        <p className="mt-3 text-sm leading-6 text-adc-muted">
          Preencha seus dados para começar. Novas contas entram como funcionário.
          O e-mail precisa ser @adcbeneficios.com.br e o departamento é
          obrigatório.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-8 space-y-5"
          autoComplete="on"
        >
          <label className="block">
            <span className="text-sm font-medium text-adc-navy">Nome</span>
            <input
              type="text"
              name="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="input mt-2"
              required
              autoComplete="name"
              minLength={2}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-adc-navy">E-mail</span>
            <input
              type="email"
              name="email"
              id="register-email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="input mt-2"
              required
              autoComplete="email"
              inputMode="email"
              placeholder="seu.nome@adcbeneficios.com.br"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-adc-navy">
              Departamento
            </span>
            <select
              name="departmentId"
              value={departmentId}
              onChange={(event) => setDepartmentId(event.target.value)}
              className="input mt-2"
              required
              disabled={loadingDepartments || !departments.length}
            >
              {loadingDepartments ? (
                <option value="">Carregando...</option>
              ) : departments.length ? (
                <>
                  <option value="">Selecione</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </>
              ) : (
                <option value="">Nenhum departamento disponível</option>
              )}
            </select>
          </label>

          <PasswordInput
            label="Senha"
            name="password"
            id="register-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoComplete="new-password"
            minLength={6}
          />

          <PasswordInput
            label="Confirmar senha"
            name="confirmPassword"
            id="register-confirm-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
            autoComplete="new-password"
            minLength={6}
          />

          <button
            type="submit"
            disabled={loading || loadingDepartments || !departments.length}
            className="btn-primary w-full disabled:opacity-60"
          >
            {loading ? "Criando conta..." : "Criar conta"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-adc-muted">
          Já tem uma conta?{" "}
          <Link
            href="/login"
            className="font-semibold text-adc-blue hover:underline"
          >
            Entrar
          </Link>
        </p>
      </section>
    </main>
  );
}
