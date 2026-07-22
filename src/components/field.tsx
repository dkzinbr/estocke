"use client";

import { ReactNode } from "react";

type FieldProps = {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
};

/** Label de formulário; use `required` para exibir o asterisco. */
export function Field({ label, required, hint, children }: FieldProps) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-adc-navy">
        {label}
        {required ? (
          <span className="ml-0.5 text-adc-danger-text" aria-hidden>
            *
          </span>
        ) : null}
      </span>
      <div className="mt-1.5">{children}</div>
      {hint ? <p className="mt-1 text-xs text-adc-muted">{hint}</p> : null}
    </label>
  );
}
