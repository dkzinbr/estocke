"use client";

export default function Home() {
  if (typeof window !== "undefined") {
    window.location.replace(
      window.localStorage.getItem("estocke_token") ? "/dashboard" : "/login",
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-sm text-adc-muted">Abrindo Estocke · ADC Benefícios...</p>
    </main>
  );
}
