"use client";

import { ThemeToggle } from "@/components/theme-toggle";
import {
  clearSession,
  getSession,
  getTokenExpiresAt,
  type Session,
} from "@/lib/client/session";
import { isAdminRole, ROLE_LABELS } from "@/lib/roles";
import {
  AlertTriangle,
  Building2,
  ClipboardList,
  History,
  LayoutDashboard,
  LogOut,
  Package,
  Shield,
  Users,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const baseNavItems = [
  { href: "/dashboard", label: "Dashboard", short: "Home", icon: LayoutDashboard },
  { href: "/products", label: "Produtos", short: "Itens", icon: Package },
  { href: "/employees", label: "Funcionários", short: "Equipe", icon: Users },
  { href: "/requests", label: "Pedidos", short: "Pedidos", icon: ClipboardList },
  { href: "/history", label: "Histórico", short: "Hist.", icon: History },
  {
    href: "/malfunctions",
    label: "Mal funcionamento",
    short: "Problemas",
    icon: AlertTriangle,
  },
];

const adminNavItems = [
  {
    href: "/departments",
    label: "Departamentos",
    short: "Depts",
    icon: Building2,
  },
  {
    href: "/users",
    label: "Usuários",
    short: "Admin",
    icon: Shield,
  },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [session, setSessionState] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  const admin = isAdminRole(session?.user.role);
  const navItems = useMemo(
    () => (admin ? [...baseNavItems, ...adminNavItems] : baseNavItems),
    [admin],
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const current = getSession();

      if (!current) {
        window.location.replace("/login");
        return;
      }

      setSessionState(current);
      setReady(true);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!session) return;

    const expiresAt = getTokenExpiresAt(session.token);
    if (expiresAt == null) {
      clearSession();
      window.location.replace("/login");
      return;
    }

    const remainingMs = expiresAt - Date.now();

    if (remainingMs <= 0) {
      clearSession();
      toast.message("Sessão expirada. Faça login novamente.");
      window.location.replace("/login");
      return;
    }

    const timer = window.setTimeout(() => {
      clearSession();
      toast.message("Sessão expirada após 3 horas. Faça login novamente.");
      window.location.replace("/login");
    }, remainingMs);

    return () => window.clearTimeout(timer);
  }, [session]);

  function handleLogout() {
    clearSession();
    window.location.replace("/login");
  }

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <p className="text-sm text-adc-muted">Carregando sessão...</p>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-background text-adc-navy">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-white/10 bg-adc-sidebar p-5 text-white lg:block">
        <Link href="/dashboard" className="flex items-center gap-3">
          <Image
            src="/adc-logo.png"
            alt="ADC Benefícios"
            width={40}
            height={40}
            className="rounded-xl bg-white/10 p-1"
          />
          <div>
            <p className="font-semibold">Estocke</p>
            <p className="text-xs text-white/60">ADC Benefícios</p>
          </div>
        </Link>

        <nav className="mt-10 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-white/15 text-white shadow-sm ring-1 ring-adc-mint-soft/40"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-5 left-5 right-5 space-y-3">
          <div className="flex justify-start">
            <ThemeToggle className="border-white/15 bg-white/10 text-white hover:bg-white/15" />
          </div>
          <div className="rounded-2xl bg-white/5 p-3 text-xs text-white/55 ring-1 ring-white/10">
            Conectando você às melhores soluções de saúde e odontologia.
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 border-b border-adc-border bg-adc-surface/90 safe-px py-3 backdrop-blur lg:px-8">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3 lg:hidden">
              <Image
                src="/adc-logo.png"
                alt="ADC Benefícios"
                width={32}
                height={32}
                className="rounded-lg"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-adc-navy">
                  Estocke
                </p>
                <p className="truncate text-xs text-adc-muted">ADC Benefícios</p>
              </div>
            </div>

            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              <div className="hidden text-right xs:block sm:block">
                <p className="max-w-[140px] truncate text-sm font-medium text-adc-navy sm:max-w-none">
                  {session?.user.name}
                </p>
                <p className="hidden max-w-[180px] truncate text-xs text-adc-muted sm:block">
                  {session?.user.role && session.user.role in ROLE_LABELS
                    ? ROLE_LABELS[session.user.role]
                    : session?.user.email}
                </p>
              </div>
              <ThemeToggle className="lg:hidden" />
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-2 rounded-xl border border-adc-border bg-adc-surface px-3 py-2 text-sm font-medium text-adc-navy transition hover:bg-background"
              >
                <LogOut size={16} />
                <span className="hidden sm:inline">Sair</span>
              </button>
            </div>
          </div>
        </header>

        <main className="safe-px safe-pb px-4 py-4 pb-24 sm:py-6 lg:px-8 lg:pb-8">
          {children}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-adc-border bg-adc-surface/95 safe-pb backdrop-blur lg:hidden">
        <div
          className={`grid gap-1 px-0.5 py-2 ${
            admin ? "grid-cols-8" : "grid-cols-6"
          }`}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-[11px] font-medium transition ${
                  active
                    ? "bg-adc-blue/10 text-adc-blue"
                    : "text-adc-muted hover:bg-background hover:text-adc-navy"
                }`}
              >
                <Icon size={18} />
                <span>{item.short}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
