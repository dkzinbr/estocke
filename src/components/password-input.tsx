"use client";

import { Eye, EyeOff } from "lucide-react";
import { InputHTMLAttributes, useState } from "react";

type PasswordInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type"
> & {
  label: string;
};

export function PasswordInput({ label, className = "", required, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

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
      <div className="relative mt-2">
        <input
          {...props}
          required={required}
          type={visible ? "text" : "password"}
          className={`input w-full pr-11 ${className}`.trim()}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-adc-muted transition hover:text-adc-navy"
          aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
          tabIndex={-1}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </label>
  );
}
