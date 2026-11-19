"use client";

import { ConfirmDeleteModal } from "@/components/confirm-delete-modal";
import { EmployeeAvatar } from "@/components/employee-avatar";
import { Field } from "@/components/field";
import { Modal } from "@/components/modal";
import { RefreshButton } from "@/components/refresh-button";
import { apiFetch, jsonBody } from "@/lib/client/api";
import { getSession } from "@/lib/client/session";
import { isEmployeePhotoValue } from "@/lib/employee-photo-utils";
import { canRequestProduct } from "@/lib/product-request-rules";
import { isAdminRole } from "@/lib/roles";
import {
  Camera,
  ClipboardList,
  Link2,
  Minus,
  Package,
  Plus,
  Search,
  Trash2,
  UserPlus,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type ProductRef = {
  id: string;
  name: string;
  code: string;
  quantity: number;
  minStock: number;
  active?: boolean;
};

type Assignment = {
  id: string;
  productId: string;
  employeeId: string;
  quantity: number;
  product: ProductRef;
};

type Employee = {
  id: string;
  name: string;
  email: string;
  contactEmail: string | null;
  phone: string | null;
  photoUrl: string | null;
  departmentId: string | null;
  userId: string | null;
  department: { id: string; name: string } | null;
  active: boolean;
  assignments: Assignment[];
  _count: { assignments: number };
};

type DepartmentOption = {
  id: string;
  name: string;
};

type ProductOption = {
  id: string;
  name: string;
  code: string;
  quantity: number;
  assignedQuantity: number;
  linkedQuantity?: number;
  availableQuantity: number;
  hasOpenMalfunction?: boolean;
  assignments: { employeeId: string; quantity: number }[];
};

type FormAssignment = {
  productId: string;
  quantity: number;
};

type EmployeeForm = {
  id?: string;
  name: string;
  email: string;
  contactEmail: string;
  phone: string;
  departmentId: string;
  photoUrl: string;
  active: boolean;
};

const emptyForm: EmployeeForm = {
  name: "",
  email: "",
  contactEmail: "",
  phone: "",
  departmentId: "",
  photoUrl: "",
  active: true,
};

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [allProducts, setAllProducts] = useState<ProductOption[]>([]);
  const [search, setSearch] = useState("");
  const [active, setActive] = useState("true");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<Employee | null>(null);
  const [form, setForm] = useState<EmployeeForm>(emptyForm);
  const [assignEmployee, setAssignEmployee] = useState<Employee | null>(null);
  const [assignments, setAssignments] = useState<FormAssignment[]>([]);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [deleting, setDeleting] = useState(false);
  // O layout só monta as páginas no cliente, depois de carregar a sessão.
  const [isAdmin] = useState(() => isAdminRole(getSession()?.user.role));
  const [productSearch, setProductSearch] = useState("");
  const [quickOrderingId, setQuickOrderingId] = useState<string | null>(null);

  const loadEmployees = useCallback(
    async (nextSearch = search, nextActive = active) => {
      setLoading(true);

      try {
        const data = await apiFetch<Employee[]>("/api/employees", {
          query: {
            search: nextSearch,
            active: nextActive === "all" ? undefined : nextActive,
          },
        });
        setEmployees(data);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Erro ao listar funcionários.",
        );
      } finally {
        setLoading(false);
      }
    },
    [active, search],
  );

  const loadProducts = useCallback(async () => {
    try {
      const data = await apiFetch<ProductOption[]>("/api/products", {
        query: { active: true },
      });
      setAllProducts(data);
    } catch {
      // keep empty list
    }
  }, []);

  const loadDepartments = useCallback(async () => {
    try {
      const data = await apiFetch<DepartmentOption[]>("/api/departments", {
        query: { active: true },
      });
      setDepartments(data);
    } catch {
      // keep empty list
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void Promise.all([loadEmployees(), loadProducts(), loadDepartments()]);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadEmployees, loadProducts, loadDepartments]);

  function resetPhotoSelection() {
    setPhotoFile(null);
    setPhotoPreview((current) => {
      if (current?.startsWith("blob:")) URL.revokeObjectURL(current);
      return null;
    });
  }

  function openCreate() {
    resetPhotoSelection();
    setForm({
      ...emptyForm,
      departmentId: departments[0]?.id ?? "",
    });
    setFormOpen(true);
  }

  function openEdit(employee: Employee) {
    resetPhotoSelection();
    const storedPhoto = isEmployeePhotoValue(employee.photoUrl)
      ? employee.photoUrl!
      : "";
    setForm({
      id: employee.id,
      name: employee.name,
      email: employee.email,
      contactEmail: employee.contactEmail ?? "",
      phone: employee.phone ?? "",
      departmentId: employee.departmentId ?? employee.department?.id ?? "",
      photoUrl: storedPhoto,
      active: employee.active,
    });
    setFormOpen(true);
  }

  function openAssign(employee: Employee) {
    setProductSearch("");
    setAssignEmployee(employee);
    setAssignments(
      employee.assignments.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
    );
    setAssignOpen(true);
  }

  function openDetail(employee: Employee) {
    setSelected(employee);
    setDetailOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setForm(emptyForm);
    resetPhotoSelection();
  }

  function closeAssign() {
    setAssignOpen(false);
    setAssignEmployee(null);
    setAssignments([]);
    setProductSearch("");
  }

  function handlePhotoChange(file: File | null) {
    resetPhotoSelection();
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      toast.error("Use JPG, PNG, WEBP ou GIF.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("A foto deve ter no máximo 5 MB.");
      return;
    }

    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  function clearPhoto() {
    resetPhotoSelection();
    setForm((current) => ({ ...current, photoUrl: "" }));
  }

  function maxQuantityFor(product: ProductOption) {
    const currentDb =
      assignEmployee
        ? product.assignments
            .filter((item) => item.employeeId === assignEmployee.id)
            .reduce((sum, item) => sum + item.quantity, 0)
        : 0;
    return product.availableQuantity + currentDb;
  }

  function assignmentQty(productId: string) {
    return (
      assignments.find((item) => item.productId === productId)?.quantity ?? 0
    );
  }

  function setAssignmentQty(productId: string, quantity: number) {
    setAssignments((current) => {
      const without = current.filter((item) => item.productId !== productId);
      if (quantity <= 0) return without;
      return [...without, { productId, quantity }];
    });
  }

  function bumpAssignment(productId: string, delta: number, max: number) {
    const next = Math.min(Math.max(assignmentQty(productId) + delta, 0), max);
    setAssignmentQty(productId, next);
  }

  async function quickOrder(product: ProductOption) {
    if (!assignEmployee) {
      toast.error("Selecione um funcionário para o pedido rápido.");
      return;
    }

    if (
      !canRequestProduct({
        quantity: product.quantity,
        availableQuantity: product.availableQuantity,
        hasOpenMalfunction: !!product.hasOpenMalfunction,
      })
    ) {
      toast.error(
        "Item único em mau funcionamento. Não é possível pedir.",
      );
      return;
    }

    setQuickOrderingId(product.id);
    try {
      await apiFetch("/api/requests", {
        method: "POST",
        body: jsonBody({
          productId: product.id,
          employeeId: assignEmployee.id,
          note: "Pedido rápido (sem estoque disponível)",
        }),
      });
      toast.success(`Pedido rápido criado para ${product.name}.`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao criar pedido.",
      );
    } finally {
      setQuickOrderingId(null);
    }
  }

  const filteredAssignProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    const list = query
      ? allProducts.filter(
          (product) =>
            product.name.toLowerCase().includes(query) ||
            product.code.toLowerCase().includes(query),
        )
      : allProducts;

    return [...list].sort((a, b) => {
      const aQty = assignmentQty(a.id);
      const bQty = assignmentQty(b.id);
      if (aQty > 0 && bQty === 0) return -1;
      if (bQty > 0 && aQty === 0) return 1;
      return a.name.localeCompare(b.name, "pt-BR");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- assignmentQty depends on assignments
  }, [allProducts, assignments, productSearch]);

  const linkedCount = assignments.filter((item) => item.quantity > 0).length;
  const linkedUnits = assignments.reduce(
    (sum, item) => sum + item.quantity,
    0,
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      let photoUrl = form.photoUrl || null;

      if (photoFile) {
        const body = new FormData();
        body.append("photo", photoFile);
        const uploaded = await apiFetch<{ photoUrl: string }>(
          "/api/employees/photo",
          { method: "POST", body },
        );
        photoUrl = uploaded.photoUrl;
      }

      if (form.id) {
        const wasActive = employees.find((item) => item.id === form.id)?.active;
        await apiFetch<Employee>(`/api/employees/${form.id}`, {
          method: "PATCH",
          body: jsonBody({
            name: form.name,
            contactEmail: form.contactEmail || null,
            phone: form.phone || null,
            departmentId: form.departmentId || null,
            photoUrl,
            active: form.active,
          }),
        });
        if (wasActive === true && form.active === false) {
          toast.success(
            "Funcionário desativado. O acesso de login também foi bloqueado.",
          );
        } else if (wasActive === false && form.active === true) {
          toast.success(
            "Funcionário reativado. O acesso de login também foi liberado.",
          );
        } else {
          toast.success("Funcionário atualizado.");
        }
      } else {
        const created = await apiFetch<Employee & { temporaryPassword?: string }>(
          "/api/employees",
          {
            method: "POST",
            body: jsonBody({
              name: form.name,
              email: form.email,
              contactEmail: form.contactEmail || null,
              phone: form.phone || null,
              departmentId: form.departmentId || null,
              photoUrl,
              active: form.active,
            }),
          },
        );
        const pwd = created.temporaryPassword;
        toast.success(
          pwd
            ? `Funcionário criado. Senha inicial: ${pwd} (alterar no 1º login).`
            : "Funcionário criado.",
        );
      }

      closeForm();
      await Promise.all([loadEmployees(), loadProducts()]);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao salvar funcionário.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleAssignSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!assignEmployee) return;
    setSaving(true);

    try {
      await apiFetch<Employee>(`/api/employees/${assignEmployee.id}`, {
        method: "PATCH",
        body: jsonBody({
          assignments: assignments.filter((item) => item.quantity > 0),
        }),
      });
      toast.success("Produtos vinculados.");
      closeAssign();
      setDetailOpen(false);
      setSelected(null);
      await Promise.all([loadEmployees(), loadProducts()]);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao vincular produtos.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;

    setDeleting(true);

    try {
      await apiFetch<void>(`/api/employees/${deleteTarget.id}`, {
        method: "DELETE",
      });
      toast.success("Funcionário excluído.");
      setDeleteTarget(null);
      setDetailOpen(false);
      setSelected(null);
      await Promise.all([loadEmployees(), loadProducts()]);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao excluir funcionário.",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="adc-eyebrow">Equipe</p>
          <h1 className="text-2xl font-semibold text-adc-navy sm:text-3xl">
            Funcionários
          </h1>
          <p className="mt-2 text-sm text-adc-muted">
            {isAdmin
              ? "Toque na foto para ver as quantidades vinculadas a cada pessoa."
              : "Consulte funcionários e as quantidades vinculadas."}
          </p>
        </div>

        {isAdmin ? (
          <button
            type="button"
            onClick={openCreate}
            className="btn-primary inline-flex w-full items-center justify-center gap-2 sm:w-auto"
          >
            <UserPlus size={16} />
            Novo funcionário
          </button>
        ) : null}
      </section>

      <section className="adc-panel overflow-hidden">
        <div className="border-b border-adc-border bg-background/60 p-4">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void loadEmployees();
            }}
            className="flex flex-col gap-2 sm:flex-row sm:items-center"
          >
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar nome, e-mail ou departamento"
              className="input w-full sm:min-w-[220px] sm:flex-1"
            />
            <select
              value={active}
              onChange={(event) => {
                setActive(event.target.value);
                void loadEmployees(search, event.target.value);
              }}
              className="input w-full sm:w-auto"
            >
              <option value="true">Ativos</option>
              <option value="false">Inativos</option>
              <option value="all">Todos</option>
            </select>
            <button className="btn-primary w-full sm:w-auto">Buscar</button>
            <RefreshButton
              onClick={() => void loadEmployees()}
              loading={loading}
            />
          </form>
        </div>

        <div className="p-4 sm:p-6">
          {loading ? (
            <p className="py-10 text-center text-sm text-adc-muted">
              Carregando funcionários...
            </p>
          ) : employees.length ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {employees.map((employee) => (
                <button
                  key={employee.id}
                  type="button"
                  onClick={() => openDetail(employee)}
                  className="group flex flex-col items-center gap-3 rounded-2xl border border-adc-border bg-background/40 p-4 text-center transition hover:border-adc-accent/50 hover:bg-background hover:shadow-md"
                >
                  <EmployeeAvatar
                    name={employee.name}
                    photoUrl={employee.photoUrl}
                    size="lg"
                    className="transition group-hover:scale-[1.03]"
                  />
                  <div className="min-w-0 w-full">
                    <p className="truncate font-semibold text-adc-navy">
                      {employee.name}
                    </p>
                    <p className="truncate text-xs text-adc-muted">
                      {employee.department?.name || "Sem departamento"}
                    </p>
                    <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-adc-accent/10 px-2 py-1 text-[11px] font-semibold text-adc-accent">
                      <Package size={12} />
                      {employee._count.assignments} produto
                      {employee._count.assignments === 1 ? "" : "s"}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-adc-muted">
              Nenhum funcionário encontrado.
            </p>
          )}
        </div>
      </section>

      <Modal
        open={detailOpen && !!selected}
        title={selected?.name ?? "Funcionário"}
        onClose={() => {
          setDetailOpen(false);
          setSelected(null);
        }}
      >
        {selected ? (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <EmployeeAvatar
                name={selected.name}
                photoUrl={selected.photoUrl}
                size="xl"
              />
              <div className="min-w-0">
                <p className="font-semibold text-adc-navy">{selected.name}</p>
                <p className="text-sm text-adc-muted">{selected.email}</p>
                {selected.contactEmail ? (
                  <p className="text-sm text-adc-muted">
                    Contato: {selected.contactEmail}
                  </p>
                ) : null}
                <p className="text-sm text-adc-muted">
                  {selected.department?.name || "Sem departamento"}
                  {selected.phone ? ` · ${selected.phone}` : ""}
                </p>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-adc-navy">
                Produtos com esta pessoa
              </h3>
              {selected.assignments.length ? (
                <ul className="mt-3 space-y-2">
                  {selected.assignments.map((item) => (
                    <li
                      key={item.id}
                      className="rounded-xl border border-adc-border bg-background px-3 py-3"
                    >
                      <p className="font-medium text-adc-navy">
                        {item.product.name} × {item.quantity}
                      </p>
                      <p className="text-xs text-adc-muted">
                        {item.product.code} · estoque total{" "}
                        {item.product.quantity}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-adc-muted">
                  Nenhum produto vinculado ainda.
                </p>
              )}
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              {isAdmin ? (
                <>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(selected)}
                    className="rounded-xl border border-adc-border px-4 py-2 text-sm font-semibold text-red-600"
                  >
                    Excluir
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      openAssign(selected);
                      setDetailOpen(false);
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-adc-border px-4 py-2 text-sm font-semibold text-adc-navy"
                  >
                    <Link2 size={16} />
                    Vincular produtos
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      openEdit(selected);
                      setDetailOpen(false);
                    }}
                    className="btn-primary"
                  >
                    Editar
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setDetailOpen(false);
                    setSelected(null);
                  }}
                  className="btn-primary"
                >
                  Fechar
                </button>
              )}
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={formOpen}
        title={form.id ? "Editar funcionário" : "Novo funcionário"}
        onClose={closeForm}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Nome" required>
            <input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              className="input"
              required
            />
          </Field>
          <Field
            label="E-mail (login)"
            required={!form.id}
            hint={
              form.id
                ? "O e-mail de login não pode ser alterado após o cadastro."
                : undefined
            }
          >
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              className="input"
              required
              readOnly={!!form.id}
              disabled={!!form.id}
            />
          </Field>
          <Field
            label="E-mail de contato"
            hint="Opcional. Pode ser diferente do e-mail de login."
          >
            <input
              type="email"
              value={form.contactEmail}
              onChange={(event) =>
                setForm({ ...form, contactEmail: event.target.value })
              }
              className="input"
            />
          </Field>
          {!form.id ? (
            <p className="rounded-xl border border-adc-border bg-background/60 px-3 py-2.5 text-sm text-adc-muted">
              A conta recebe a{" "}
              <span className="font-medium text-adc-navy">senha inicial padrão</span>
              . No primeiro acesso, o usuário será obrigado a alterá-la.
            </p>
          ) : null}
          <Field label="Telefone">
            <input
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
              className="input"
            />
          </Field>
          <Field label="Departamento">
            <select
              value={form.departmentId}
              onChange={(event) =>
                setForm({ ...form, departmentId: event.target.value })
              }
              className="input"
            >
              <option value="">Sem departamento</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Foto"
            hint="JPG, PNG, WEBP ou GIF até 5 MB. Em produção (Vercel) a foto é armazenada inline no banco."
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <EmployeeAvatar
                name={form.name || "Funcionário"}
                photoUrl={photoPreview ?? (form.photoUrl || null)}
                size="lg"
              />
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-adc-border px-3 py-2 text-sm font-semibold text-adc-navy transition hover:bg-background">
                  <Camera size={16} />
                  {form.photoUrl || photoPreview ? "Trocar foto" : "Enviar foto"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="sr-only"
                    onChange={(event) =>
                      handlePhotoChange(event.target.files?.[0] ?? null)
                    }
                  />
                </label>
                {(form.photoUrl || photoPreview) && (
                  <button
                    type="button"
                    onClick={clearPhoto}
                    className="inline-flex items-center gap-2 rounded-xl border border-adc-border px-3 py-2 text-sm font-semibold text-red-600"
                  >
                    <Trash2 size={16} />
                    Remover
                  </button>
                )}
              </div>
            </div>
          </Field>

          <label className="flex items-start gap-2 text-sm text-adc-navy">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={form.active}
              onChange={(event) =>
                setForm({ ...form, active: event.target.checked })
              }
            />
            <span>
              Funcionário ativo
              <span className="mt-0.5 block text-xs text-adc-muted">
                Desmarcar bloqueia o login deste usuário na plataforma.
              </span>
            </span>
          </label>

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={closeForm}
              className="rounded-xl border border-adc-border px-4 py-2 text-sm font-semibold text-adc-navy"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={assignOpen && !!assignEmployee}
        title={`Vincular produtos · ${assignEmployee?.name ?? ""}`}
        onClose={closeAssign}
      >
        <form onSubmit={handleAssignSubmit} className="space-y-4">
          <div className="rounded-2xl border border-adc-border bg-background/60 p-3 sm:p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-adc-navy">
                  Vincular produtos
                </p>
                <p className="mt-1 text-xs text-adc-muted">
                  Defina quantas unidades ficam com esta pessoa.
                </p>
              </div>
              <p className="text-xs font-medium text-adc-muted">
                {linkedCount} produto{linkedCount === 1 ? "" : "s"} ·{" "}
                {linkedUnits} unidade{linkedUnits === 1 ? "" : "s"}
              </p>
            </div>

            <div className="relative mt-3">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-adc-muted"
              />
              <input
                value={productSearch}
                onChange={(event) => setProductSearch(event.target.value)}
                placeholder="Buscar produto por nome ou código"
                className="input pl-9"
              />
            </div>

            <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
              {filteredAssignProducts.length ? (
                filteredAssignProducts.map((product) => {
                  const max = maxQuantityFor(product);
                  const qty = assignmentQty(product.id);
                  const linked = qty > 0;
                  const outOfStock = max <= 0;
                  const requestAllowed = canRequestProduct({
                    quantity: product.quantity,
                    availableQuantity: product.availableQuantity,
                    hasOpenMalfunction: !!product.hasOpenMalfunction,
                  });
                  const uniqueBroken =
                    !!product.hasOpenMalfunction && product.quantity <= 1;

                  return (
                    <div
                      key={product.id}
                      className={`rounded-xl border px-3 py-3 transition ${
                        linked
                          ? "border-adc-accent/40 bg-adc-accent/5"
                          : "border-adc-border bg-adc-surface"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-adc-navy">
                            {product.name}
                          </p>
                          <p className="mt-0.5 text-xs text-adc-muted">
                            {product.code} · estoque {product.quantity}
                            {product.hasOpenMalfunction
                              ? " · mau funcionamento"
                              : ""}
                          </p>
                        </div>
                        {!outOfStock ? (
                          <div className="flex shrink-0 items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => bumpAssignment(product.id, -1, max)}
                              disabled={qty <= 0}
                              className="inline-flex size-8 items-center justify-center rounded-lg border border-adc-border text-adc-navy transition hover:bg-background disabled:cursor-not-allowed disabled:opacity-40"
                              aria-label={`Diminuir ${product.name}`}
                            >
                              <Minus size={14} />
                            </button>
                            <input
                              type="number"
                              min={0}
                              max={max}
                              value={qty}
                              onChange={(event) => {
                                const next = Number(event.target.value);
                                const clamped = Number.isFinite(next)
                                  ? Math.min(Math.max(next, 0), max)
                                  : 0;
                                setAssignmentQty(product.id, clamped);
                              }}
                              className="input w-14 px-1 text-center"
                              aria-label={`Quantidade de ${product.name}`}
                            />
                            <button
                              type="button"
                              onClick={() => bumpAssignment(product.id, 1, max)}
                              disabled={qty >= max}
                              className="inline-flex size-8 items-center justify-center rounded-lg border border-adc-border text-adc-navy transition hover:bg-background disabled:cursor-not-allowed disabled:opacity-40"
                              aria-label={`Aumentar ${product.name}`}
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        ) : null}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-adc-muted">
                        <span>
                          {outOfStock ? (
                            uniqueBroken ? (
                              <strong className="text-amber-700">
                                Item único em mau funcionamento
                              </strong>
                            ) : (
                              <>
                                Sem estoque disponível
                                {assignEmployee && requestAllowed ? (
                                  <span className="text-adc-muted">
                                    {" "}
                                    · peça reposição
                                  </span>
                                ) : null}
                              </>
                            )
                          ) : (
                            <>
                              Disponível para vincular:{" "}
                              <strong className="text-adc-navy">{max}</strong>
                            </>
                          )}
                        </span>
                        {linked && !outOfStock ? (
                          <button
                            type="button"
                            onClick={() => setAssignmentQty(product.id, 0)}
                            className="font-semibold text-red-600 hover:underline"
                          >
                            Remover
                          </button>
                        ) : null}
                      </div>
                      {outOfStock && assignEmployee && requestAllowed ? (
                        <button
                          type="button"
                          onClick={() => void quickOrder(product)}
                          disabled={quickOrderingId === product.id}
                          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-adc-blue/30 bg-adc-blue/10 px-3 py-2 text-sm font-semibold text-adc-blue transition hover:bg-adc-blue/15 disabled:opacity-60"
                        >
                          <ClipboardList size={16} />
                          {quickOrderingId === product.id
                            ? "Criando pedido..."
                            : "Pedido rápido"}
                        </button>
                      ) : null}
                      {!outOfStock ? (
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-adc-border/70">
                          <div
                            className="h-full rounded-full bg-adc-accent transition-all"
                            style={{
                              width: `${max > 0 ? Math.min((qty / max) * 100, 100) : 0}%`,
                            }}
                          />
                        </div>
                      ) : null}
                    </div>
                  );
                })
              ) : (
                <p className="py-6 text-center text-sm text-adc-muted">
                  Nenhum produto encontrado para vínculo.
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={closeAssign}
              className="rounded-xl border border-adc-border px-4 py-2 text-sm font-semibold text-adc-navy"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Salvar vínculos"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDeleteModal
        open={!!deleteTarget}
        description={`Tem certeza que deseja excluir o funcionário "${deleteTarget?.name}"? Essa ação não pode ser desfeita.`}
        confirming={deleting}
        onCancel={() => {
          if (!deleting) setDeleteTarget(null);
        }}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
