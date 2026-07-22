"use client";

import { Field } from "@/components/field";
import { Modal } from "@/components/modal";
import { AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";

type ConfirmPhraseModalProps = {
  open: boolean;
  title?: string;
  description: string;
  phrase: string;
  confirming?: boolean;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmPhraseModal({
  open,
  title = "Confirmar ação",
  description,
  phrase,
  confirming = false,
  confirmLabel = "Confirmar",
  onCancel,
  onConfirm,
}: ConfirmPhraseModalProps) {
  const [typed, setTyped] = useState("");
  const matches = typed.trim().toLowerCase() === phrase.trim().toLowerCase();

  useEffect(() => {
    if (!open) setTyped("");
  }, [open]);

  return (
    <Modal open={open} title={title} onClose={onCancel}>
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-2xl border border-adc-danger-text/20 bg-adc-danger-bg px-4 py-3">
          <AlertTriangle
            className="mt-0.5 shrink-0 text-adc-danger-text"
            size={20}
          />
          <p className="text-sm leading-6 text-adc-navy">{description}</p>
        </div>

        <Field
          label={`Digite "${phrase}" para confirmar`}
          required
          hint="A ação só será liberada após digitar a frase exatamente."
        >
          <input
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            className="input"
            autoComplete="off"
            spellCheck={false}
            placeholder={phrase}
            disabled={confirming}
          />
        </Field>

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
            disabled={confirming || !matches}
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {confirming ? "Processando..." : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
