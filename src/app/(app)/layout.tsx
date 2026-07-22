"use client";

import { ForceChangePasswordModal } from "@/components/force-change-password-modal";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  clearSession,
  getSession,
  getTokenExpiresAt,
  type Session,
} from "@/lib/client/session";
import { isAdminRole, canViewAllOperations, ROLE_LABELS } from "@/lib/roles";
import {
  AlertTriangle,
  Building2,
  ClipboardList,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Shield,
  Users,
  X,
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
  {
    href: "/malfunctions",
    label: "Mal funcionamento",
    short: "Problemas",
    icon: AlertTriangle,
  },
];

const opsNavItems = [
  { href: "/history", label: "Histórico", short: "Hist.", icon: History },
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

function firstName(name: string | undefined) {
  if (!name?.trim()) return "usuário";
  return name.trim().split(/\s+/)[0] ?? "usuário";
}

function initials(name: string | undefined) {
  if (!name?.trim()) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [session, setSessionState] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(false);

  const admin = isAdminRole(session?.user.role);
  const canSeeOps = canViewAllOperations(session?.user.role);
  const navItems = useMemo(() => {
    const items = [...baseNavItems];
    if (canSeeOps) items.push(...opsNavItems);
    if (admin) items.push(...adminNavItems);
    return items;
  }, [admin, canSeeOps]);

  const displayName = session?.user.name ?? "";
  const roleLabel =
    session?.user.role && session.user.role in ROLE_LABELS
      ? ROLE_LABELS[session.user.role]
      : session?.user.email;

  useEffect(() => {
    setMenuOpen(false);
    setAccountOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen && !accountOpen) return;

    function onPointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      const el = target instanceof Element ? target : target.parentElement;
      if (el?.closest("[data-mobile-menu], [data-account-menu]")) return;
      setMenuOpen(false);
      setAccountOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [menuOpen, accountOpen]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const current = getSession();

      if (!current) {
        window.location.replace("/login");
        return;
      }

      setSessionState(current);
      setMustChangePassword(!!current.user.mustChangePassword);
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
      <ForceChangePasswordModal
        open={mustChangePassword}
        onCompleted={() => setMustChangePassword(false)}
      />

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
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-adc-border bg-adc-surface/90 safe-px py-3 backdrop-blur lg:px-8">
          <div className="relative mx-auto flex max-w-7xl items-center justify-between gap-3">
            {/* Mobile: hamburger + brand — desktop usa a sidebar */}
            <div
              className="relative flex min-w-0 items-center gap-2 lg:hidden"
              data-mobile-menu
            >
              <button
                type="button"
                onClick={() => {
                  setAccountOpen(false);
                  setMenuOpen((open) => !open);
                }}
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-adc-border bg-adc-surface text-adc-navy transition hover:bg-background"
                aria-label="Abrir menu"
                aria-expanded={menuOpen}
              >
                {menuOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
              <div className="flex min-w-0 items-center gap-2">
                <Image
                  src="/adc-logo.png"
                  alt="ADC Benefícios"
                  width={28}
                  height={28}
                  className="rounded-md"
                />
                <p className="truncate text-sm font-semibold text-adc-navy">
                  Estocke
                </p>
              </div>

              {menuOpen ? (
                <div className="absolute left-0 top-[calc(100%+0.5rem)] z-40 w-56 overflow-hidden rounded-xl border border-adc-border bg-adc-surface py-1 shadow-lg">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const active = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMenuOpen(false)}
                        className={`flex items-center gap-2.5 px-3 py-2 text-sm transition ${
                          active
                            ? "bg-adc-blue/10 font-semibold text-adc-blue"
                            : "text-adc-navy hover:bg-background"
                        }`}
                      >
                        <Icon size={16} />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>

            {/* Conta — mobile até widescreen */}
            <div className="relative ml-auto" data-account-menu>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setAccountOpen((open) => !open);
                }}
                className="inline-flex max-w-[46vw] items-center gap-1.5 rounded-full border border-adc-border bg-adc-surface py-1 pl-1 pr-2.5 text-left transition hover:bg-background sm:max-w-none sm:gap-2 sm:pr-3"
                aria-label="Conta"
                aria-expanded={accountOpen}
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#0f3b8a] to-[#4d6aff] text-[10px] font-semibold text-white sm:size-8 sm:text-[11px]">
                  {initials(displayName)}
                </span>
                <span className="min-w-0 truncate text-xs font-semibold text-adc-navy sm:text-sm">
                  {firstName(displayName)}
                </span>
              </button>

              {accountOpen ? (
                <div className="absolute right-0 top-[calc(100%+0.5rem)] z-40 w-52 overflow-hidden rounded-xl border border-adc-border bg-adc-surface py-1 shadow-lg sm:w-56">
                  <div className="border-b border-adc-border px-3 py-2">
                    <p className="truncate text-xs font-semibold text-adc-navy sm:text-sm">
                      {firstName(displayName)}
                    </p>
                    <p className="truncate text-[11px] text-adc-muted sm:text-xs">
                      {roleLabel}
                    </p>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-xs font-medium text-adc-navy sm:text-sm">
                      Tema
                    </span>
                    <ThemeToggle className="size-8 rounded-lg" />
                  </div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-adc-navy transition hover:bg-background sm:text-sm"
                  >
                    <LogOut size={14} />
                    Sair
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <main className="safe-px safe-pb px-4 py-4 sm:py-6 lg:px-8 lg:pb-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
