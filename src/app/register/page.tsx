"use client";

import { ThemeToggle } from "@/components/theme-toggle";
import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";

export default function RegisterPage() {
  useEffect(() => {
    window.location.replace("/login");
  }, []);

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,#4d6aff33,transparent_40%),radial-gradient(circle_at_bottom_right,#10b98133,transparent_35%),linear-gradient(160deg,#040b1f_0%,#0a1f44_45%,#0f3b8a_100%)]" />

      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle className="border-white/20 bg-white/10 text-white hover:bg-white/20" />
      </div>

      <section className="relative w-full max-w-md rounded-3xl border border-white/15 bg-adc-surface/95 p-6 text-center shadow-2xl backdrop-blur sm:p-8">
        <Image
          src="/adc-logo.png"
          alt="ADC Benefícios"
          width={48}
          height={48}
          className="mx-auto rounded-xl"
          priority
        />
        <h1 className="mt-5 text-xl font-semibold text-adc-navy">
          Cadastro desativado
        </h1>
        <p className="mt-3 text-sm leading-6 text-adc-muted">
          Contas são criadas pelo administrador na aba Funcionários. Redirecionando
          para o login…
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex font-semibold text-adc-blue hover:underline"
        >
          Ir para o login
        </Link>
      </section>
    </main>
  );
}
