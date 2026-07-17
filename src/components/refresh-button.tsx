"use client";

import { RefreshCw } from "lucide-react";

type RefreshButtonProps = {
  onClick: () => void;
  loading?: boolean;
  label?: string;
};

export function RefreshButton({
  onClick,
  loading = false,
  label = "Atualizar",
}: RefreshButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-xl border border-adc-border bg-adc-surface px-3 py-2 text-sm font-medium text-adc-navy shadow-sm transition hover:bg-background disabled:cursor-not-allowed disabled:opacity-60"
    >
      <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
      {label}
    </button>
  );
}
