"use client";

import { RefreshButton } from "@/components/refresh-button";
import { ACTIVITY_TYPE_LABELS } from "@/lib/activity-labels";
import { apiFetch } from "@/lib/client/api";
import { getSession } from "@/lib/client/session";
import type { ActivityType } from "@generated/prisma/client";
import { AlertTriangle, Building2, Package, Users } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

function greetingForHour(hour: number) {
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function firstName(name: string | undefined) {
  if (!name?.trim()) return "usuário";
  return name.trim().split(/\s+/)[0] ?? "usuário";
}

type DashboardData = {
  counts: {
    products: number;
    employees: number;
    departments: number;
    lowStock: number;
    malfunctions: number;
  };
  lowStockProducts: Array<{
    id: string;
    name: string;
    code: string;
    quantity: number;
    availableQuantity: number;
    minStock: number;
  }>;
  openMalfunctions: Array<{
    id: string;
    description: string;
    createdAt: string;
    product: {
      id: string;
      name: string;
      code: string;
    };
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
  // O layout só monta as páginas no cliente, depois de carregar a sessão.
  const [userName] = useState(() => getSession()?.user.name ?? "");
  const greeting = greetingForHour(new Date().getHours());

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
          <p className="adc-eyebrow">
            {greeting}, {firstName(userName)}
          </p>
          <h1 className="text-2xl font-semibold text-adc-navy sm:text-3xl">
            Dashboard
          </h1>
          <p className="mt-2 text-sm text-adc-muted">
            Visão geral do estoque em tempo real.
          </p>
        </div>
        <RefreshButton onClick={() => void loadDashboard()} loading={loading} />
      </section>

      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
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
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold text-adc-navy">
              Produtos com estoque baixo
            </h2>
            <Link
              href="/products"
              className="text-xs font-medium text-adc-blue hover:underline"
            >
              Ver produtos
            </Link>
          </div>
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
                    {product.availableQuantity} disp. / mín. {product.minStock}
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
            <h2 className="font-semibold text-adc-navy">
              Produtos com mau funcionamento
            </h2>
            <Link
              href="/malfunctions"
              className="text-xs font-medium text-adc-blue hover:underline"
            >
              Ver tudo
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {loading ? (
              <p className="text-sm text-adc-muted">Carregando...</p>
            ) : data?.openMalfunctions.length ? (
              data.openMalfunctions.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-amber-500/10 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-adc-navy">
                      {item.product.name}
                    </p>
                    <p className="text-xs text-adc-muted">{item.product.code}</p>
                    <p className="mt-1 truncate text-xs text-adc-muted">
                      {item.description}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-amber-800 dark:text-amber-200">
                    {new Intl.DateTimeFormat("pt-BR", {
                      dateStyle: "short",
                    }).format(new Date(item.createdAt))}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-adc-muted">
                Nenhum mau funcionamento aberto.
              </p>
            )}
          </div>
        </div>

        <div className="adc-panel p-5 xl:col-span-2">
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
