"use client";

import { RefreshButton } from "@/components/refresh-button";
import { apiFetch } from "@/lib/client/api";
import { ACTIVITY_TYPE_LABELS } from "@/lib/activity-labels";
import type { ActivityType } from "@generated/prisma/client";
import { History } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type ActivityEvent = {
  id: string;
  type: ActivityType;
  typeLabel: string;
  summary: string;
  detail: string | null;
  actorName: string | null;
  createdAt: string;
};

const TYPE_OPTIONS = Object.entries(ACTIVITY_TYPE_LABELS) as [
  ActivityType,
  string,
][];

export default function HistoryPage() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [loading, setLoading] = useState(true);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<ActivityEvent[]>("/api/history", {
        query: {
          search: search || undefined,
          type: type || undefined,
        },
      });
      setEvents(data);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao carregar histórico.",
      );
    } finally {
      setLoading(false);
    }
  }, [search, type]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadEvents();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadEvents]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadEvents();
  }

  return (
    <div className="space-y-6">
      <section>
        <p className="adc-eyebrow">Auditoria</p>
        <h1 className="text-2xl font-semibold text-adc-navy sm:text-3xl">
          Histórico
        </h1>
        <p className="mt-2 text-sm text-adc-muted">
          Tudo o que acontece na plataforma: pedidos, mal funcionamentos,
          cadastros, transferências e ajustes.
        </p>
      </section>

      <section className="adc-panel overflow-hidden">
        <div className="border-b border-adc-border bg-background/50 p-4">
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-2 sm:flex-row sm:items-center"
          >
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar resumo, detalhe ou autor"
              className="input w-full sm:flex-1"
            />
            <select
              value={type}
              onChange={(event) => setType(event.target.value)}
              className="input w-full sm:min-w-[220px] sm:w-auto"
            >
              <option value="">Todos os tipos</option>
              {TYPE_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <button className="btn-primary w-full sm:w-auto">Filtrar</button>
            <RefreshButton onClick={() => void loadEvents()} loading={loading} />
          </form>
        </div>

        <div className="divide-y divide-adc-border/70">
          {loading ? (
            <p className="px-4 py-10 text-center text-sm text-adc-muted">
              Carregando histórico...
            </p>
          ) : events.length ? (
            events.map((event) => (
              <article
                key={event.id}
                className="flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-adc-blue/10 px-2 py-0.5 text-[11px] font-semibold text-adc-blue">
                      <History size={12} />
                      {event.typeLabel}
                    </span>
                    <span className="text-xs text-adc-muted">
                      {event.actorName
                        ? `por ${event.actorName}`
                        : "sistema"}
                    </span>
                  </div>
                  <p className="mt-2 font-medium text-adc-navy">
                    {event.summary}
                  </p>
                  {event.detail ? (
                    <p className="mt-1 text-sm text-adc-muted">{event.detail}</p>
                  ) : null}
                </div>
                <p className="shrink-0 text-xs text-adc-muted">
                  {new Intl.DateTimeFormat("pt-BR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  }).format(new Date(event.createdAt))}
                </p>
              </article>
            ))
          ) : (
            <p className="px-4 py-10 text-center text-sm text-adc-muted">
              Nenhum evento encontrado.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
