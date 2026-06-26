import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { CircularProgress, FormControl, MenuItem, Select } from "@mui/material";
import { Button } from "../components/Button";
import CustomerModal from "../components/CustomerModal";
import {
  deleteRequest,
  getRequest,
  postRequest,
  updateRequest,
} from "../services/request";

type AdminResourceKey =
  | "employees"
  | "roles"
  | "colors"
  | "sizes"
  | "clothings-types"
  | "fabrics"
  | "payment-types";

type Primitive = string | number | boolean | null;
type GenericRecord = Record<string, Primitive>;

type RoleOption = {
  id: number;
  desc: string;
};

type PaymentTypeForm = {
  desc: string;
  kind: string;
  active: boolean;
  requiresDueDate: boolean;
  allowsEntryAmount: boolean;
  allowsInstallments: boolean;
  maxInstallments: string;
  defaultInstallments: string;
  financialFlow: string;
};

type ResourceConfig = {
  key: AdminResourceKey;
  title: string;
  endpoint: string;
  emptyLabel: string;
  deleteLabel: string;
  primaryKey: string;
  isSoftDelete?: boolean;
};

const resourceConfigList: ResourceConfig[] = [
  {
    key: "employees",
    title: "Funcionarias",
    endpoint: "/admin/employees",
    emptyLabel: "Nenhuma funcionaria cadastrada.",
    deleteLabel: "Desativar",
    primaryKey: "idEmployee",
    isSoftDelete: true,
  },
  {
    key: "roles",
    title: "Cargos",
    endpoint: "/admin/roles",
    emptyLabel: "Nenhum cargo cadastrado.",
    deleteLabel: "Excluir",
    primaryKey: "id",
  },
  {
    key: "colors",
    title: "Cores",
    endpoint: "/admin/colors",
    emptyLabel: "Nenhuma cor cadastrada.",
    deleteLabel: "Excluir",
    primaryKey: "id",
  },
  {
    key: "sizes",
    title: "Tamanhos",
    endpoint: "/admin/sizes",
    emptyLabel: "Nenhum tamanho cadastrado.",
    deleteLabel: "Excluir",
    primaryKey: "id",
  },
  {
    key: "clothings-types",
    title: "Tipos de Roupas",
    endpoint: "/admin/clothings-types",
    emptyLabel: "Nenhum tipo de roupa cadastrado.",
    deleteLabel: "Excluir",
    primaryKey: "id",
  },
  {
    key: "fabrics",
    title: "Tecidos",
    endpoint: "/admin/fabrics",
    emptyLabel: "Nenhum tecido cadastrado.",
    deleteLabel: "Excluir",
    primaryKey: "id",
  },
  {
    key: "payment-types",
    title: "Formas de Pagamento",
    endpoint: "/admin/payment-types",
    emptyLabel: "Nenhuma forma de pagamento cadastrada.",
    deleteLabel: "Desativar",
    primaryKey: "idPaymentType",
    isSoftDelete: true,
  },
];

const employeeInitialForm = {
  fullName: "",
  shortName: "",
  document: "",
  rg: "",
  zipCode: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  primaryPhone: "",
  secondaryPhone: "",
  nameSecPhone: "",
  email: "",
  comment: "",
  birthDate: "",
  roleId: "",
  bankData: "",
  active: true,
};

const simpleInitialForm = {
  desc: "",
};

const paymentTypeInitialForm: PaymentTypeForm = {
  desc: "",
  kind: "CASH",
  active: true,
  requiresDueDate: false,
  allowsEntryAmount: false,
  allowsInstallments: false,
  maxInstallments: "1",
  defaultInstallments: "1",
  financialFlow: "IMMEDIATE_CASH",
};

function formatDate(value: Primitive) {
  if (!value || typeof value !== "string") return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("pt-BR").format(date);
}

function normalizeDateInput(value: Primitive) {
  if (!value || typeof value !== "string") return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toISOString().slice(0, 10);
}

function formatPhone(value: Primitive) {
  if (!value || typeof value !== "string") return "-";

  if (value.length === 11) {
    return `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`;
  }

  return value;
}

export default function AdminPage() {
  const [selectedResource, setSelectedResource] =
    useState<AdminResourceKey>("employees");
  const [resourceRows, setResourceRows] = useState<Record<AdminResourceKey, GenericRecord[]>>({
    employees: [],
    roles: [],
    colors: [],
    sizes: [],
    "clothings-types": [],
    fabrics: [],
    "payment-types": [],
  });
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [employeeForm, setEmployeeForm] = useState(employeeInitialForm);
  const [simpleForm, setSimpleForm] = useState(simpleInitialForm);
  const [paymentTypeForm, setPaymentTypeForm] = useState<PaymentTypeForm>(paymentTypeInitialForm);

  const currentConfig = useMemo(
    () => resourceConfigList.find((item) => item.key === selectedResource)!,
    [selectedResource],
  );

  const currentRows = resourceRows[selectedResource] ?? [];

  async function fetchResource(resource: AdminResourceKey) {
    const config = resourceConfigList.find((item) => item.key === resource)!;
    const data = await getRequest(config.endpoint);
    setResourceRows((prev) => ({
      ...prev,
      [resource]: data,
    }));
  }

  async function fetchRoles() {
    const data = await getRequest("/admin/roles");
    setRoles(data);
  }

  useEffect(() => {
    const fetchAdminData = async () => {
      try {
        setLoading(true);
        setError("");
        await Promise.all([
          ...resourceConfigList.map((resource) => fetchResource(resource.key)),
          fetchRoles(),
        ]);
      } catch (err) {
        console.error(err);
        setError("Nao foi possivel carregar os dados da administracao.");
      } finally {
        setLoading(false);
      }
    };

    fetchAdminData();
  }, []);

  useEffect(() => {
    setIsFormOpen(false);
    setCurrentPage(1);
    setEditingId(null);
    setError("");
    setEmployeeForm(employeeInitialForm);
    setSimpleForm(simpleInitialForm);
    setPaymentTypeForm(paymentTypeInitialForm);
  }, [selectedResource]);

  const employeeRows = useMemo(() => {
    if (selectedResource !== "employees") return [];

    return currentRows.map((row) => ({
      ...row,
      roleDesc: roles.find((role) => Number(role.id) === Number(row.roleId))?.desc ?? "-",
    }));
  }, [currentRows, roles, selectedResource]);

  useEffect(() => {
    setCurrentPage(1);
  }, [pageSize]);

  const visibleRows = selectedResource === "employees" ? employeeRows : currentRows;
  const totalPages = Math.max(1, Math.ceil(visibleRows.length / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedRows = visibleRows.slice(startIndex, startIndex + pageSize);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  function startEdit(row: GenericRecord) {
    const id = Number(row[currentConfig.primaryKey]);
    setIsFormOpen(true);
    setEditingId(id);
    setError("");

    if (selectedResource === "employees") {
      setEmployeeForm({
        fullName: String(row.fullName ?? ""),
        shortName: String(row.shortName ?? ""),
        document: String(row.document ?? ""),
        rg: String(row.rg ?? ""),
        zipCode: String(row.zipCode ?? ""),
        street: String(row.street ?? ""),
        number: String(row.number ?? ""),
        complement: String(row.complement ?? ""),
        neighborhood: String(row.neighborhood ?? ""),
        city: String(row.city ?? ""),
        state: String(row.state ?? ""),
        primaryPhone: String(row.primaryPhone ?? ""),
        secondaryPhone: String(row.secondaryPhone ?? ""),
        nameSecPhone: String(row.nameSecPhone ?? ""),
        email: String(row.email ?? ""),
        comment: String(row.comment ?? ""),
        birthDate: normalizeDateInput(row.birthDate),
        roleId: String(row.roleId ?? ""),
        bankData: String(row.bankData ?? ""),
        active: Boolean(row.active),
      });
      return;
    }

    if (selectedResource === "payment-types") {
      setPaymentTypeForm({
        desc: String(row.desc ?? ""),
        kind: String(row.kind ?? "CASH"),
        active: Boolean(row.active),
        requiresDueDate: Boolean(row.requiresDueDate),
        allowsEntryAmount: Boolean(row.allowsEntryAmount),
        allowsInstallments: Boolean(row.allowsInstallments),
        maxInstallments: String(row.maxInstallments ?? 1),
        defaultInstallments: String(row.defaultInstallments ?? 1),
        financialFlow: String(row.financialFlow ?? "IMMEDIATE_CASH"),
      });
      return;
    }

    setSimpleForm({
      desc: String(row.desc ?? ""),
    });
  }

  function openCreateModal() {
    setEditingId(null);
    setError("");
    setEmployeeForm(employeeInitialForm);
    setSimpleForm(simpleInitialForm);
    setPaymentTypeForm(paymentTypeInitialForm);
    setIsFormOpen(true);
  }

  function closeForm() {
    setIsFormOpen(false);
    setError("");
  }

  function resetForm() {
    setEditingId(null);
    setError("");
    setEmployeeForm(employeeInitialForm);
    setSimpleForm(simpleInitialForm);
    setPaymentTypeForm(paymentTypeInitialForm);
    setIsFormOpen(false);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setSubmitting(true);
      setError("");

      const payload =
        selectedResource === "employees"
          ? {
              ...employeeForm,
              roleId: employeeForm.roleId ? Number(employeeForm.roleId) : null,
            }
          : selectedResource === "payment-types"
            ? {
                ...paymentTypeForm,
                maxInstallments: paymentTypeForm.maxInstallments
                  ? Number(paymentTypeForm.maxInstallments)
                  : null,
                defaultInstallments: paymentTypeForm.defaultInstallments
                  ? Number(paymentTypeForm.defaultInstallments)
                  : 1,
              }
            : simpleForm;

      if (editingId) {
        await updateRequest(`${currentConfig.endpoint}/${editingId}`, payload);
      } else {
        await postRequest(currentConfig.endpoint, payload);
      }

      await fetchResource(selectedResource);
      if (selectedResource !== "roles") {
        await fetchRoles();
      }
      resetForm();
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.message || "Nao foi possivel salvar o registro.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(row: GenericRecord) {
    const id = Number(row[currentConfig.primaryKey]);
    const label =
      selectedResource === "employees"
        ? String(row.fullName ?? row.shortName ?? id)
        : String(row.desc ?? id);

    const confirmed = window.confirm(
      `${currentConfig.isSoftDelete ? "Desativar" : "Excluir"} "${label}"?`,
    );

    if (!confirmed) return;

    try {
      setSubmitting(true);
      setError("");
      await deleteRequest(`${currentConfig.endpoint}/${id}`, {});
      await fetchResource(selectedResource);
      if (selectedResource === "roles") {
        await fetchRoles();
      }
      if (editingId === id) {
        resetForm();
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.message || "Nao foi possivel remover o registro.");
    } finally {
      setSubmitting(false);
    }
  }

  function renderEmployeeTable() {
    return (
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full border-separate border-spacing-y-2">
          <thead>
            <tr className="text-left">
              <th className="px-4 pt-2 font-editorial text-[1.4rem] text-primary">Nome</th>
              <th className="px-4 pt-2 font-editorial text-[1.4rem] text-primary">Cargo</th>
              <th className="px-4 pt-2 font-editorial text-[1.4rem] text-primary">Contato</th>
              <th className="px-4 pt-2 font-editorial text-[1.4rem] text-primary">Email</th>
              <th className="px-4 pt-2 font-editorial text-[1.4rem] text-primary">Nascimento</th>
              <th className="px-4 pt-2 font-editorial text-[1.4rem] text-primary">Status</th>
              <th className="px-4 pt-2 font-editorial text-[1.4rem] text-primary text-right">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {(paginatedRows as GenericRecord[]).map((row) => (
              <tr key={String(row.idEmployee)} className="bg-surface-lowest">
                <td className="px-4 py-3">
                  <p className="text-[15px] font-semibold text-primary">{String(row.fullName ?? "")}</p>
                  <p className="text-[12px] uppercase tracking-[0.08em] text-neutral-700">
                    {String(row.shortName ?? "")}
                  </p>
                </td>
                <td className="px-4 py-3 text-[14px] text-neutral-700">{String(row.roleDesc ?? "-")}</td>
                <td className="px-4 py-3 text-[14px] text-neutral-700">{formatPhone(row.primaryPhone)}</td>
                <td className="px-4 py-3 text-[14px] text-neutral-700">{String(row.email ?? "-")}</td>
                <td className="px-4 py-3 text-[14px] text-neutral-700">{formatDate(row.birthDate)}</td>
                <td className="px-4 py-3 text-[14px] text-neutral-700">{Boolean(row.active) ? "Ativa" : "Inativa"}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" size="sm" onClick={() => startEdit(row)}>
                      <Pencil size={14} />
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => handleDelete(row)}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  function renderPaymentTypesTable() {
    return (
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full border-separate border-spacing-y-2">
          <thead>
            <tr className="text-left">
              <th className="px-4 pt-2 font-editorial text-[1.4rem] text-primary">ID</th>
              <th className="px-4 pt-2 font-editorial text-[1.4rem] text-primary">Descricao</th>
              <th className="px-4 pt-2 font-editorial text-[1.4rem] text-primary">Fluxo</th>
              <th className="px-4 pt-2 font-editorial text-[1.4rem] text-primary">Regras</th>
              <th className="px-4 pt-2 font-editorial text-[1.4rem] text-primary text-right">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {(paginatedRows as GenericRecord[]).map((row) => (
              <tr key={String(row.idPaymentType)} className="bg-surface-lowest">
                <td className="px-4 py-3 text-[14px] font-semibold text-primary">{String(row.idPaymentType ?? "")}</td>
                <td className="px-4 py-3 text-[14px] text-neutral-700">{String(row.desc ?? "")}</td>
                <td className="px-4 py-3 text-[14px] text-neutral-700">{String(row.financialFlow ?? "IMMEDIATE_CASH")}</td>
                <td className="px-4 py-3 text-[14px] text-neutral-700">
                  {Boolean(row.allowsEntryAmount) ? "Entrada" : "Sem entrada"} • {Boolean(row.allowsInstallments) ? "Parcela" : "Sem parcelas"} • {Boolean(row.requiresDueDate) ? "Com vencimento" : "Sem vencimento"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" size="sm" onClick={() => startEdit(row)}>
                      <Pencil size={14} />
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => handleDelete(row)}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  function renderSimpleTable() {
    return (
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full border-separate border-spacing-y-2">
          <thead>
            <tr className="text-left">
              <th className="px-4 pt-2 font-editorial text-[1.4rem] text-primary">ID</th>
              <th className="px-4 pt-2 font-editorial text-[1.4rem] text-primary">Descricao</th>
              <th className="px-4 pt-2 font-editorial text-[1.4rem] text-primary text-right">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {(paginatedRows as GenericRecord[]).map((row) => (
              <tr key={String(row.id)} className="bg-surface-lowest">
                <td className="px-4 py-3 text-[14px] font-semibold text-primary">{String(row.id)}</td>
                <td className="px-4 py-3 text-[14px] text-neutral-700">{String(row.desc ?? "")}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" size="sm" onClick={() => startEdit(row)}>
                      <Pencil size={14} />
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => handleDelete(row)}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  function renderMobileCards() {
    return (
      <div className="divide-y divide-outline-variant/35 bg-white lg:hidden">
        {(paginatedRows as GenericRecord[]).map((row) => (
          <div key={String(row[currentConfig.primaryKey])} className="px-4 py-4">
            {selectedResource === "employees" ? (
              <>
                <p className="text-base font-semibold text-primary">{String(row.fullName ?? "")}</p>
                <p className="text-xs uppercase tracking-[0.08em] text-neutral-700">
                  {String(row.shortName ?? "")} • {String(row.roleDesc ?? "-")}
                </p>
                <p className="mt-1 text-sm text-neutral-700">
                  {formatPhone(row.primaryPhone)} • {String(row.email ?? "sem email")}
                </p>
              </>
            ) : selectedResource === "payment-types" ? (
              <>
                <p className="text-base font-semibold text-primary">{String(row.desc ?? "")}</p>
                <p className="text-xs uppercase tracking-[0.08em] text-neutral-700">
                  ID {String(row.idPaymentType ?? "")} • {String(row.financialFlow ?? "IMMEDIATE_CASH")}
                </p>
                <p className="mt-1 text-sm text-neutral-700">
                  {Boolean(row.allowsEntryAmount) ? "Permite entrada" : "Sem entrada"} • {Boolean(row.allowsInstallments) ? "Permite parcelas" : "Sem parcelas"}
                </p>
              </>
            ) : (
              <>
                <p className="text-base font-semibold text-primary">{String(row.desc ?? "")}</p>
                <p className="text-xs uppercase tracking-[0.08em] text-neutral-700">
                  ID {String(row.id ?? "")}
                </p>
              </>
            )}
            <div className="mt-3 flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => startEdit(row)}>
                Editar
              </Button>
              <Button variant="danger" size="sm" onClick={() => handleDelete(row)}>
                {currentConfig.deleteLabel}
              </Button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="w-full min-h-full bg-white p-3 sm:p-5 md:bg-surface-low">
      <div className="mb-6 flex items-center gap-3 pt-12">
        <h1 className="text-6xl font-semibold text-primary md:text-4xl">Administracao</h1>
      </div>

      {loading ? (
        <div className="mt-20 flex items-center justify-center">
          <CircularProgress />
        </div>
      ) : (
        <div className="space-y-4">
          <section className="space-y-4">
            <div className="hidden border-b border-outline-variant/35 md:block">
              <div className="flex flex-wrap gap-2">
                {resourceConfigList.map((resource) => (
                  <button
                    key={resource.key}
                    type="button"
                    onClick={() => setSelectedResource(resource.key)}
                    className={`px-4 py-3 text-sm uppercase tracking-[0.1em] transition-colors ${
                      selectedResource === resource.key
                        ? "border-b-2 border-primary font-semibold text-primary"
                        : "text-neutral-700 hover:text-primary"
                    }`}
                  >
                    {resource.title}
                  </button>
                ))}
              </div>
            </div>

            <div className="md:hidden">
              <FormControl fullWidth size="medium">
                <Select
                  value={selectedResource}
                  onChange={(event) =>
                    setSelectedResource(event.target.value as AdminResourceKey)
                  }
                  sx={{
                    height: 46,
                    backgroundColor: "white",
                    "& .MuiOutlinedInput-notchedOutline": {
                      borderColor: "rgba(112, 105, 106, 0.45)",
                    },
                  }}
                >
                  {resourceConfigList.map((resource) => (
                    <MenuItem key={resource.key} value={resource.key}>
                      {resource.title}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </div>

            <div className="grid gap-4">
              <div className="bg-white md:bg-transparent">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-3xl font-semibold text-primary">{currentConfig.title}</h2>
                  <Button variant="primary" size="md" onClick={openCreateModal}>
                    + Novo
                  </Button>
                </div>

                {visibleRows.length === 0 ? (
                  <div className="bg-surface-lowest p-6 text-sm text-neutral-700">
                    {currentConfig.emptyLabel}
                  </div>
                ) : (
                  <>
                    {selectedResource === "employees"
                      ? renderEmployeeTable()
                      : selectedResource === "payment-types"
                        ? renderPaymentTypesTable()
                        : renderSimpleTable()}
                    {renderMobileCards()}
                    <div className="mt-4 hidden items-center justify-between md:flex">
                      <p className="text-[13px] tracking-[0.04em] text-neutral-700">
                        Exibindo {visibleRows.length === 0 ? 0 : startIndex + 1}-
                        {Math.min(startIndex + pageSize, visibleRows.length)} de {visibleRows.length}
                      </p>
                      <div className="flex items-center gap-2">
                        <FormControl size="medium" className="min-w-[120px]">
                          <Select
                            value={String(pageSize)}
                            onChange={(e) => {
                              setPageSize(Number(e.target.value));
                              setCurrentPage(1);
                            }}
                            sx={{
                              height: 40,
                              borderRadius: 1,
                              backgroundColor: "white",
                              "& .MuiOutlinedInput-notchedOutline": {
                                borderColor: "rgba(112, 105, 106, 0.45)",
                              },
                            }}
                          >
                            <MenuItem value="5">5 por pagina</MenuItem>
                            <MenuItem value="10">10 por pagina</MenuItem>
                            <MenuItem value="20">20 por pagina</MenuItem>
                          </Select>
                        </FormControl>
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                        >
                          Anterior
                        </Button>
                        <span className="px-2 text-sm text-primary">
                          {currentPage} / {totalPages}
                        </span>
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={currentPage === totalPages}
                          onClick={() =>
                            setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                          }
                        >
                          Proxima
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </section>
        </div>
      )}

      <CustomerModal
        open={isFormOpen}
        onClose={closeForm}
        title={editingId ? `Editar ${currentConfig.title}` : `Novo em ${currentConfig.title}`}
        subtitle={
          selectedResource === "employees"
            ? "Preencha os dados da funcionaria e salve para atualizar a tabela."
            : selectedResource === "payment-types"
              ? "Configure as regras operacionais da forma de pagamento."
              : "Edite a descricao e confirme para salvar o cadastro."
        }
      >
        <div className="mx-auto max-w-3xl">
          <div className="mb-4 flex items-center gap-2">
            <Plus size={18} className="text-primary" />
            <h3 className="text-2xl font-semibold text-primary">
              {editingId ? "Editar registro" : "Novo registro"}
            </h3>
          </div>

          {error ? (
            <div className="mb-4 flex items-start gap-2 bg-[#ffe7e7] px-3 py-2 text-sm text-[#8f1515]">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          <form className="space-y-3" onSubmit={handleSubmit}>
            {selectedResource === "employees" ? (
              <>
                <input value={employeeForm.fullName} onChange={(e) => setEmployeeForm((prev) => ({ ...prev, fullName: e.target.value }))} placeholder="Nome completo" className="h-11 w-full border border-outline-variant/50 bg-white px-3 text-sm text-primary" required />
                <input value={employeeForm.shortName} onChange={(e) => setEmployeeForm((prev) => ({ ...prev, shortName: e.target.value }))} placeholder="Nome curto" className="h-11 w-full border border-outline-variant/50 bg-white px-3 text-sm text-primary" required />
                <select value={employeeForm.roleId} onChange={(e) => setEmployeeForm((prev) => ({ ...prev, roleId: e.target.value }))} className="h-11 w-full border border-outline-variant/50 bg-white px-3 text-sm text-primary" required>
                  <option value="">Selecione o cargo</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.desc}
                    </option>
                  ))}
                </select>
                <div className="grid gap-3 md:grid-cols-2">
                  <input value={employeeForm.document} onChange={(e) => setEmployeeForm((prev) => ({ ...prev, document: e.target.value }))} placeholder="CPF/CNPJ" className="h-11 w-full border border-outline-variant/50 bg-white px-3 text-sm text-primary" />
                  <input value={employeeForm.rg} onChange={(e) => setEmployeeForm((prev) => ({ ...prev, rg: e.target.value }))} placeholder="RG" className="h-11 w-full border border-outline-variant/50 bg-white px-3 text-sm text-primary" />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <input value={employeeForm.primaryPhone} onChange={(e) => setEmployeeForm((prev) => ({ ...prev, primaryPhone: e.target.value }))} placeholder="Telefone principal" className="h-11 w-full border border-outline-variant/50 bg-white px-3 text-sm text-primary" />
                  <input value={employeeForm.secondaryPhone} onChange={(e) => setEmployeeForm((prev) => ({ ...prev, secondaryPhone: e.target.value }))} placeholder="Telefone secundario" className="h-11 w-full border border-outline-variant/50 bg-white px-3 text-sm text-primary" />
                </div>
                <input value={employeeForm.email} onChange={(e) => setEmployeeForm((prev) => ({ ...prev, email: e.target.value }))} placeholder="Email" className="h-11 w-full border border-outline-variant/50 bg-white px-3 text-sm text-primary" />
                <input type="date" value={employeeForm.birthDate} onChange={(e) => setEmployeeForm((prev) => ({ ...prev, birthDate: e.target.value }))} className="h-11 w-full border border-outline-variant/50 bg-white px-3 text-sm text-primary" />
                <div className="grid gap-3 md:grid-cols-2">
                  <input value={employeeForm.zipCode} onChange={(e) => setEmployeeForm((prev) => ({ ...prev, zipCode: e.target.value }))} placeholder="CEP" className="h-11 w-full border border-outline-variant/50 bg-white px-3 text-sm text-primary" />
                  <input value={employeeForm.state} onChange={(e) => setEmployeeForm((prev) => ({ ...prev, state: e.target.value }))} placeholder="UF" className="h-11 w-full border border-outline-variant/50 bg-white px-3 text-sm text-primary" />
                </div>
                <input value={employeeForm.street} onChange={(e) => setEmployeeForm((prev) => ({ ...prev, street: e.target.value }))} placeholder="Endereco" className="h-11 w-full border border-outline-variant/50 bg-white px-3 text-sm text-primary" />
                <div className="grid gap-3 md:grid-cols-2">
                  <input value={employeeForm.number} onChange={(e) => setEmployeeForm((prev) => ({ ...prev, number: e.target.value }))} placeholder="Numero" className="h-11 w-full border border-outline-variant/50 bg-white px-3 text-sm text-primary" />
                  <input value={employeeForm.complement} onChange={(e) => setEmployeeForm((prev) => ({ ...prev, complement: e.target.value }))} placeholder="Complemento" className="h-11 w-full border border-outline-variant/50 bg-white px-3 text-sm text-primary" />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <input value={employeeForm.neighborhood} onChange={(e) => setEmployeeForm((prev) => ({ ...prev, neighborhood: e.target.value }))} placeholder="Bairro" className="h-11 w-full border border-outline-variant/50 bg-white px-3 text-sm text-primary" />
                  <input value={employeeForm.city} onChange={(e) => setEmployeeForm((prev) => ({ ...prev, city: e.target.value }))} placeholder="Cidade" className="h-11 w-full border border-outline-variant/50 bg-white px-3 text-sm text-primary" />
                </div>
                <input value={employeeForm.bankData} onChange={(e) => setEmployeeForm((prev) => ({ ...prev, bankData: e.target.value }))} placeholder="Dados bancarios / Pix" className="h-11 w-full border border-outline-variant/50 bg-white px-3 text-sm text-primary" />
                <textarea value={employeeForm.comment} onChange={(e) => setEmployeeForm((prev) => ({ ...prev, comment: e.target.value }))} placeholder="Observacoes" className="min-h-24 w-full border border-outline-variant/50 bg-white px-3 py-2 text-sm text-primary" />
                <label className="flex items-center gap-2 text-sm text-primary">
                  <input type="checkbox" checked={employeeForm.active} onChange={(e) => setEmployeeForm((prev) => ({ ...prev, active: e.target.checked }))} />
                  Funcionaria ativa
                </label>
              </>
            ) : selectedResource === "payment-types" ? (
              <>
                <input value={paymentTypeForm.desc} onChange={(e) => setPaymentTypeForm((prev) => ({ ...prev, desc: e.target.value }))} placeholder="Descricao" className="h-11 w-full border border-outline-variant/50 bg-white px-3 text-sm text-primary" required />
                <div className="grid gap-3 md:grid-cols-2">
                  <select value={paymentTypeForm.kind} onChange={(e) => setPaymentTypeForm((prev) => ({ ...prev, kind: e.target.value }))} className="h-11 w-full border border-outline-variant/50 bg-white px-3 text-sm text-primary">
                    <option value="CASH">Dinheiro</option>
                    <option value="CHECK">Cheque</option>
                    <option value="BOOKLET">Carne</option>
                    <option value="INVOICE">Duplicata</option>
                    <option value="CARD">Cartao</option>
                  </select>
                  <select value={paymentTypeForm.financialFlow} onChange={(e) => setPaymentTypeForm((prev) => ({ ...prev, financialFlow: e.target.value }))} className="h-11 w-full border border-outline-variant/50 bg-white px-3 text-sm text-primary">
                    <option value="IMMEDIATE_CASH">Recebimento imediato</option>
                    <option value="FUTURE_CUSTOMER">A receber do cliente</option>
                    <option value="FUTURE_OPERATOR">A receber da operadora</option>
                  </select>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="flex items-center gap-2 text-sm text-primary">
                    <input type="checkbox" checked={paymentTypeForm.active} onChange={(e) => setPaymentTypeForm((prev) => ({ ...prev, active: e.target.checked }))} />
                    Forma ativa
                  </label>
                  <label className="flex items-center gap-2 text-sm text-primary">
                    <input type="checkbox" checked={paymentTypeForm.requiresDueDate} onChange={(e) => setPaymentTypeForm((prev) => ({ ...prev, requiresDueDate: e.target.checked }))} />
                    Exige vencimento
                  </label>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="flex items-center gap-2 text-sm text-primary">
                    <input type="checkbox" checked={paymentTypeForm.allowsEntryAmount} onChange={(e) => setPaymentTypeForm((prev) => ({ ...prev, allowsEntryAmount: e.target.checked }))} />
                    Permite entrada
                  </label>
                  <label className="flex items-center gap-2 text-sm text-primary">
                    <input type="checkbox" checked={paymentTypeForm.allowsInstallments} onChange={(e) => setPaymentTypeForm((prev) => ({ ...prev, allowsInstallments: e.target.checked, maxInstallments: e.target.checked ? prev.maxInstallments : "1", defaultInstallments: e.target.checked ? prev.defaultInstallments : "1" }))} />
                    Permite parcelamento
                  </label>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <input type="number" min="1" value={paymentTypeForm.defaultInstallments} onChange={(e) => setPaymentTypeForm((prev) => ({ ...prev, defaultInstallments: e.target.value }))} placeholder="Parcelas padrao" className="h-11 w-full border border-outline-variant/50 bg-white px-3 text-sm text-primary" />
                  <input type="number" min="1" value={paymentTypeForm.maxInstallments} onChange={(e) => setPaymentTypeForm((prev) => ({ ...prev, maxInstallments: e.target.value }))} placeholder="Maximo de parcelas" className="h-11 w-full border border-outline-variant/50 bg-white px-3 text-sm text-primary" disabled={!paymentTypeForm.allowsInstallments} />
                </div>
              </>
            ) : (
              <input value={simpleForm.desc} onChange={(e) => setSimpleForm({ desc: e.target.value })} placeholder="Descricao" className="h-11 w-full border border-outline-variant/50 bg-white px-3 text-sm text-primary" required />
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              <Button type="submit" variant="primary" size="md" isLoading={submitting}>
                {editingId ? "Salvar alteracoes" : "Cadastrar"}
              </Button>
              <Button type="button" variant="secondary" size="md" onClick={closeForm}>
                Cancelar
              </Button>
            </div>
          </form>
        </div>
      </CustomerModal>
    </div>
  );
}
