"use client";

import { Modal } from "@/components/modal";
import { AlertTriangle } from "lucide-react";

type ConfirmDeleteModalProps = {
  open: boolean;
  title?: string;
  description: string;
  confirming?: boolean;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmDeleteModal({
  open,
  title = "Confirmar exclusão",
  description,
  confirming = false,
  confirmLabel = "Excluir",
  onCancel,
  onConfirm,
}: ConfirmDeleteModalProps) {
  return (
    <Modal open={open} title={title} onClose={onCancel}>
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-2xl border border-adc-danger-text/20 bg-adc-danger-bg px-4 py-3">
          <AlertTriangle className="mt-0.5 shrink-0 text-adc-danger-text" size={20} />
          <p className="text-sm leading-6 text-adc-navy">{description}</p>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={confirming}
            className="rounded-xl border border-adc-border px-4 py-2 text-sm font-semibold text-adc-navy disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirming}
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {confirming ? "Excluindo..." : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
