"use client";

import { RefreshButton } from "@/components/refresh-button";
import { ACTIVITY_TYPE_LABELS } from "@/lib/activity-labels";
import { apiFetch } from "@/lib/client/api";
import type { ActivityType } from "@generated/prisma/client";
import { AlertTriangle, Building2, History, Package, Users } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type DashboardData = {
  counts: {
    products: number;
    employees: number;
    history: number;
    departments: number;
    lowStock: number;
  };
  lowStockProducts: Array<{
    id: string;
    name: string;
    code: string;
    quantity: number;
    minStock: number;
  }>;
  recentEvents: Array<{
    id: string;
    type: ActivityType;
    summary: string;
    actorName: string | null;
    createdAt: string;
  }>;
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    setLoading(true);

    try {
      const response = await apiFetch<DashboardData>("/api/dashboard");
      setData(response);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao carregar dashboard.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadDashboard(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadDashboard]);

  const cards = [
    {
      label: "Produtos ativos",
      value: data?.counts.products ?? 0,
      icon: Package,
      href: "/products",
      tone: "bg-adc-mint/15 text-adc-mint",
    },
    {
      label: "Funcionários ativos",
      value: data?.counts.employees ?? 0,
      icon: Users,
      href: "/employees",
      tone: "bg-adc-accent/10 text-adc-accent",
    },
    {
      label: "Departamentos",
      value: data?.counts.departments ?? 0,
      icon: Building2,
      href: "/departments",
      tone: "bg-adc-blue/10 text-adc-blue",
    },
    {
      label: "Histórico",
      value: data?.counts.history ?? 0,
      icon: History,
      href: "/history",
      tone: "bg-violet-500/10 text-violet-700",
    },
    {
      label: "Estoque baixo",
      value: data?.counts.lowStock ?? 0,
      icon: AlertTriangle,
      href: "/products",
      tone: "bg-adc-danger-bg text-adc-danger-text",
    },
  ];

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="adc-eyebrow">ADC Benefícios</p>
          <h1 className="text-2xl font-semibold text-adc-navy sm:text-3xl">
            Dashboard
          </h1>
          <p className="mt-2 text-sm text-adc-muted">
            Visão geral do estoque em tempo real.
          </p>
        </div>
        <RefreshButton onClick={() => void loadDashboard()} loading={loading} />
      </section>

      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <Link
              key={card.label}
              href={card.href}
              className="adc-panel p-4 transition hover:border-adc-accent/30 hover:shadow-md sm:p-5"
            >
              <div className="flex items-center justify-between">
                <span
                  className={`grid size-10 place-items-center rounded-xl ${card.tone}`}
                >
                  <Icon size={18} />
                </span>
                <span className="text-3xl font-semibold text-adc-navy">
                  {loading ? "…" : card.value}
                </span>
              </div>
              <p className="mt-4 text-sm font-medium text-adc-navy">
                {card.label}
              </p>
            </Link>
          );
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="adc-panel p-5">
          <h2 className="font-semibold text-adc-navy">
            Produtos com estoque baixo
          </h2>
          <div className="mt-4 space-y-3">
            {loading ? (
              <p className="text-sm text-adc-muted">Carregando...</p>
            ) : data?.lowStockProducts.length ? (
              data.lowStockProducts.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between rounded-xl bg-adc-danger-bg px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-adc-navy">{product.name}</p>
                    <p className="text-xs text-adc-muted">{product.code}</p>
                  </div>
                  <span className="text-sm font-semibold text-adc-danger-text">
                    {product.quantity} / mín. {product.minStock}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-adc-muted">
                Nenhum produto abaixo do mínimo.
              </p>
            )}
          </div>
        </div>

        <div className="adc-panel p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold text-adc-navy">Histórico recente</h2>
            <Link
              href="/history"
              className="text-xs font-medium text-adc-blue hover:underline"
            >
              Ver tudo
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {loading ? (
              <p className="text-sm text-adc-muted">Carregando...</p>
            ) : data?.recentEvents.length ? (
              data.recentEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-start justify-between gap-4 rounded-xl bg-background px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-adc-navy">{event.summary}</p>
                    <p className="text-xs text-adc-muted">
                      {ACTIVITY_TYPE_LABELS[event.type]} ·{" "}
                      {event.actorName ?? "sistema"}
                    </p>
                  </div>
                  <p className="shrink-0 text-xs text-adc-muted">
                    {new Intl.DateTimeFormat("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    }).format(new Date(event.createdAt))}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-adc-muted">
                Nenhum evento registrado ainda.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
