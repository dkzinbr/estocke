"use client";

import { PasswordInput } from "@/components/password-input";
import { apiFetch, jsonBody } from "@/lib/client/api";
import { getSession, setSession } from "@/lib/client/session";
import { FormEvent, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onCompleted: () => void;
};

export function ForceChangePasswordModal({ open, onCompleted }: Props) {
  const [mounted, setMounted] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open || !mounted) return null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }

    setSaving(true);
    try {
      const result = await apiFetch<{
        user: {
          id: string;
          name: string;
          email: string;
          role: "ADMIN" | "SUPERVISOR" | "EMPLOYEE";
          mustChangePassword: boolean;
        };
      }>("/api/auth/change-password", {
        method: "POST",
        body: jsonBody({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });

      const session = getSession();
      if (session) {
        setSession({
          token: session.token,
          user: {
            ...session.user,
            ...result.user,
            mustChangePassword: false,
          },
        });
      }

      toast.success("Senha atualizada com sucesso.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      onCompleted();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao alterar a senha.",
      );
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="force-change-password-title"
        className="relative z-10 w-full max-w-md rounded-3xl border border-adc-border bg-adc-surface shadow-2xl"
      >
        <div className="border-b border-adc-border px-5 py-4 sm:px-6">
          <h2
            id="force-change-password-title"
            className="text-lg font-semibold text-adc-navy"
          >
            Alterar senha
          </h2>
          <p className="mt-1 text-sm text-adc-muted">
            Por segurança, defina uma nova senha antes de continuar na
            plataforma.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5 sm:px-6">
          <PasswordInput
            label="Senha atual"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
            autoComplete="current-password"
            autoFocus
          />
          <PasswordInput
            label="Nova senha"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
          />
          <PasswordInput
            label="Confirmar nova senha"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
          />

          <button
            type="submit"
            disabled={saving}
            className="btn-primary w-full disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar nova senha"}
          </button>
        </form>
      </div>
    </div>,
    document.body,
  );
}
