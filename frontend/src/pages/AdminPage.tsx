import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Pencil, Trash2 } from "lucide-react";
import { CircularProgress, FormControl, MenuItem, Select } from "@mui/material";
import { Button } from "../components/Button";
import CustomerModal from "../components/CustomerModal";
import {
  deleteRequest,
  getRequest,
  postRequest,
  updateRequest,
} from "../services/request";
import { getUserFacingApiErrorMessage } from "../utils/apiError";

type AdminResourceKey =
  | "employees"
  | "suppliers"
  | "roles"
  | "professions"
  | "colors"
  | "sizes"
  | "clothings-types"
  | "fabrics"
  | "financial-categories"
  | "financial-accounts"
  | "measurement-definitions"
  | "payment-types"
  | "audits";

type Primitive = string | number | boolean | null;
type GenericRecord = Record<string, Primitive>;

type DeleteModalState = {
  open: boolean;
  id: number | null;
  label: string;
};

type RoleOption = {
  id: number;
  desc: string;
  active?: boolean;
};

type AuditTypeOption = {
  idAuditType: number;
  description: string;
};

type ResourceConfig = {
  key: AdminResourceKey;
  title: string;
  endpoint: string;
  emptyLabel: string;
  deleteLabel: string;
  primaryKey: string;
  isSoftDelete?: boolean;
  readOnly?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
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
    key: "suppliers",
    title: "Fornecedores",
    endpoint: "/admin/suppliers",
    emptyLabel: "Nenhum fornecedor cadastrado.",
    deleteLabel: "Desativar",
    primaryKey: "idSupplier",
    isSoftDelete: true,
  },
  {
    key: "roles",
    title: "Cargos",
    endpoint: "/admin/roles",
    emptyLabel: "Nenhum cargo cadastrado.",
    deleteLabel: "Desativar",
    primaryKey: "id",
    isSoftDelete: true,
  },
  {
    key: "professions",
    title: "Profissões",
    endpoint: "/professions",
    emptyLabel: "Nenhuma profissão cadastrada.",
    deleteLabel: "Excluir",
    primaryKey: "id",
  },
  {
    key: "colors",
    title: "Cores",
    endpoint: "/admin/colors",
    emptyLabel: "Nenhuma cor cadastrada.",
    deleteLabel: "Desativar",
    primaryKey: "id",
    isSoftDelete: true,
  },
  {
    key: "sizes",
    title: "Tamanhos",
    endpoint: "/admin/sizes",
    emptyLabel: "Nenhum tamanho cadastrado.",
    deleteLabel: "Desativar",
    primaryKey: "id",
    isSoftDelete: true,
  },
  {
    key: "clothings-types",
    title: "Tipos de Roupas",
    endpoint: "/admin/clothings-types",
    emptyLabel: "Nenhum tipo de roupa cadastrado.",
    deleteLabel: "Desativar",
    primaryKey: "id",
    isSoftDelete: true,
  },
  {
    key: "fabrics",
    title: "Tecidos",
    endpoint: "/admin/fabrics",
    emptyLabel: "Nenhum tecido cadastrado.",
    deleteLabel: "Desativar",
    primaryKey: "id",
    isSoftDelete: true,
  },
  {
    key: "financial-categories",
    title: "Categorias Financeiras",
    endpoint: "/admin/financial-categories",
    emptyLabel: "Nenhuma categoria financeira cadastrada.",
    deleteLabel: "Desativar",
    primaryKey: "idFinancialCategory",
    isSoftDelete: true,
  },
  {
    key: "financial-accounts",
    title: "Contas",
    endpoint: "/admin/financial-accounts",
    emptyLabel: "Nenhuma conta cadastrada.",
    deleteLabel: "Desativar",
    primaryKey: "idFinancialAccount",
    isSoftDelete: true,
  },
  {
    key: "measurement-definitions",
    title: "Medidas",
    endpoint: "/admin/measurement-definitions",
    emptyLabel: "Nenhuma medida cadastrada.",
    deleteLabel: "",
    primaryKey: "idMeasurementDefinition",
    canDelete: false,
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
  {
    key: "audits",
    title: "Auditoria",
    endpoint: "/admin/audits",
    emptyLabel: "Nenhum registro de auditoria encontrado.",
    deleteLabel: "",
    primaryKey: "idAudit",
    readOnly: true,
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
  description: "",
  label: "",
  scope: "LOJA",
  targetType: "BANK",
  active: true,
};

const supplierInitialForm = {
  fullName: "",
  tradeName: "",
  contactName: "",
  document: "",
  rg: "",
  street: "",
  neighborhood: "",
  city: "",
  state: "",
  zipCode: "",
  phoneCommercial1: "",
  phoneCommercial2: "",
  fax: "",
  phoneMobile: "",
  email: "",
  comment: "",
  active: true,
  blocked: false,
};

function formatDate(value: Primitive) {
  if (!value || typeof value !== "string") return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("pt-BR").format(date);
}

function extractDateOnlyParts(value: Primitive) {
  if (!value || typeof value !== "string") return null;

  const base = value.slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(base);
  if (!match) return null;

  return {
    year: match[1],
    month: match[2],
    day: match[3],
  };
}

function formatDateOnly(value: Primitive) {
  const parts = extractDateOnlyParts(value);
  if (!parts) return "-";

  return `${parts.day}/${parts.month}/${parts.year}`;
}

function normalizeDateInput(value: Primitive) {
  return extractDateOnlyParts(value)
    ? String(value).slice(0, 10)
    : "";
}

function formatPhone(value: Primitive) {
  if (!value || typeof value !== "string") return "-";

  if (value.length === 11) {
    return `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`;
  }

  return value;
}

function onlyDigits(value: Primitive) {
  return String(value || "").replace(/\D/g, "");
}

function getOptionalDocumentValidationMessage(value: Primitive) {
  const digits = onlyDigits(value);

  if (!digits) return "";
  if (digits.length === 11 || digits.length === 14) return "";

  return "CPF/CNPJ deve conter 11 ou 14 digitos quando informado.";
}

export default function AdminPage() {
  const [selectedResource, setSelectedResource] =
    useState<AdminResourceKey>("employees");
  const [resourceRows, setResourceRows] = useState<
    Record<AdminResourceKey, GenericRecord[]>
  >({
    employees: [],
    suppliers: [],
    roles: [],
    professions: [],
    colors: [],
    sizes: [],
    "clothings-types": [],
    fabrics: [],
    "financial-categories": [],
    "financial-accounts": [],
    "measurement-definitions": [],
    "payment-types": [],
    audits: [],
  });
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [auditTypes, setAuditTypes] = useState<AuditTypeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [auditLoading, setAuditLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteModal, setDeleteModal] = useState<DeleteModalState>({
    open: false,
    id: null,
    label: "",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [employeeForm, setEmployeeForm] = useState(employeeInitialForm);
  const [supplierForm, setSupplierForm] = useState(supplierInitialForm);
  const [simpleForm, setSimpleForm] = useState(simpleInitialForm);
  const [auditFilters, setAuditFilters] = useState({
    startDate: "",
    endDate: "",
    history: "",
    auditTypeId: "",
  });

  const currentConfig = useMemo(
    () => resourceConfigList.find((item) => item.key === selectedResource)!,
    [selectedResource],
  );
  const shouldUppercaseSimpleInput =
    selectedResource === "colors" ||
    selectedResource === "sizes" ||
    selectedResource === "clothings-types" ||
    selectedResource === "fabrics" ||
    selectedResource === "financial-categories";
  const simpleInputClassName = `h-11 w-full border border-outline-variant/50 bg-white px-3 text-sm text-primary${
    shouldUppercaseSimpleInput ? " uppercase" : ""
  }`;
  const shouldUppercaseAdminField = (field: string) =>
    ![
      "document",
      "rg",
      "zipCode",
      "number",
      "primaryPhone",
      "secondaryPhone",
      "phoneCommercial1",
      "phoneCommercial2",
      "phoneMobile",
      "fax",
      "email",
      "birthDate",
    ].includes(field);
  const getAdminInputClassName = (field: string) =>
    `h-11 w-full border border-outline-variant/50 bg-white px-3 text-sm text-primary${
      shouldUppercaseAdminField(field) ? " uppercase" : ""
    }`;

  const currentRows = useMemo(
    () => resourceRows[selectedResource] ?? [],
    [resourceRows, selectedResource],
  );

  async function fetchResource(resource: AdminResourceKey) {
    const config = resourceConfigList.find((item) => item.key === resource)!;
    const params = new URLSearchParams();

    if (resource === "audits") {
      if (auditFilters.startDate) {
        params.set("startDate", auditFilters.startDate);
      }
      if (auditFilters.endDate) {
        params.set("endDate", auditFilters.endDate);
      }
      if (auditFilters.history.trim()) {
        params.set("history", auditFilters.history.trim());
      }
      if (auditFilters.auditTypeId) {
        params.set("auditTypeId", auditFilters.auditTypeId);
      }
    }

    const endpoint =
      params.size > 0
        ? `${config.endpoint}?${params.toString()}`
        : config.endpoint;
    const data = await getRequest(endpoint);
    setResourceRows((prev) => ({
      ...prev,
      [resource]: data,
    }));
  }

  async function fetchRoles() {
    const data = await getRequest("/admin/roles");
    setRoles(data);
  }

  async function fetchAuditTypes() {
    const data = await getRequest("/admin/audit-types");
    setAuditTypes(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    const fetchAdminData = async () => {
      try {
        setLoading(true);
        setError("");
        await Promise.all([
          ...resourceConfigList.map((resource) => fetchResource(resource.key)),
          fetchRoles(),
          fetchAuditTypes(),
        ]);
      } catch (err) {
        console.error(err);
        setError("Não foi possível carregar os dados da administração.");
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
    setSupplierForm(supplierInitialForm);
    setSimpleForm(simpleInitialForm);
  }, [selectedResource]);

  const employeeRows = useMemo(() => {
    if (selectedResource !== "employees") return [];

    return currentRows.map((row) => ({
      ...row,
      roleDesc:
        roles.find((role) => Number(role.id) === Number(row.roleId))?.desc ??
        "-",
    }));
  }, [currentRows, roles, selectedResource]);

  const availableRoles = useMemo(() => {
    if (selectedResource !== "employees") return roles;

    const currentRoleId = Number(employeeForm.roleId || 0);
    return roles.filter(
      (role) => role.active !== false || Number(role.id) === currentRoleId,
    );
  }, [employeeForm.roleId, roles, selectedResource]);

  useEffect(() => {
    setCurrentPage(1);
  }, [pageSize]);

  useEffect(() => {
    if (selectedResource === "audits") {
      setCurrentPage(1);
    }
  }, [auditFilters, selectedResource]);

  useEffect(() => {
    if (selectedResource !== "audits") {
      return;
    }

    const fetchAudits = async () => {
      try {
        setAuditLoading(true);
        await fetchResource("audits");
      } catch (err) {
        console.error(err);
        setError("Não foi possível carregar os dados da auditoria.");
      } finally {
        setAuditLoading(false);
      }
    };

    void fetchAudits();
  }, [auditFilters, selectedResource]);

  const visibleRows =
    selectedResource === "employees" ? employeeRows : currentRows;
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

    if (selectedResource === "suppliers") {
      setSupplierForm({
        fullName: String(row.fullName ?? ""),
        tradeName: String(row.tradeName ?? ""),
        contactName: String(row.contactName ?? ""),
        document: String(row.document ?? ""),
        rg: String(row.rg ?? ""),
        street: String(row.street ?? ""),
        neighborhood: String(row.neighborhood ?? ""),
        city: String(row.city ?? ""),
        state: String(row.state ?? ""),
        zipCode: String(row.zipCode ?? ""),
        phoneCommercial1: String(row.phoneCommercial1 ?? ""),
        phoneCommercial2: String(row.phoneCommercial2 ?? ""),
        fax: String(row.fax ?? ""),
        phoneMobile: String(row.phoneMobile ?? ""),
        email: String(row.email ?? ""),
        comment: String(row.comment ?? ""),
        active: Boolean(row.active),
        blocked: Boolean(row.blocked) || false,
      });
      return;
    }

    setSimpleForm({
      desc: String(row.desc ?? ""),
      description: String(row.description ?? ""),
      label: String(row.label ?? ""),
      scope: String(row.scope ?? "LOJA"),
      targetType: String(row.targetType ?? "BANK"),
      active: row.active === undefined ? true : Boolean(row.active),
    });
  }

  function openCreateModal() {
    setEditingId(null);
    setError("");
    setEmployeeForm(employeeInitialForm);
    setSupplierForm(supplierInitialForm);
    setSimpleForm(simpleInitialForm);
    setIsFormOpen(true);
  }

  function closeForm() {
    setIsFormOpen(false);
    setError("");
  }

  function closeDeleteModal() {
    setDeleteModal({
      open: false,
      id: null,
      label: "",
    });
  }

  function resetForm() {
    setEditingId(null);
    setError("");
    setEmployeeForm(employeeInitialForm);
    setSupplierForm(supplierInitialForm);
    setSimpleForm(simpleInitialForm);
    setIsFormOpen(false);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setSubmitting(true);
      setError("");

      if (selectedResource === "employees") {
        const message = getOptionalDocumentValidationMessage(
          employeeForm.document,
        );

        if (message) {
          setError(message);
          return;
        }
      }

      if (selectedResource === "suppliers") {
        const message = getOptionalDocumentValidationMessage(
          supplierForm.document,
        );

        if (message) {
          setError(message);
          return;
        }
      }

      const payload =
        selectedResource === "employees"
          ? {
              ...employeeForm,
              roleId: employeeForm.roleId ? Number(employeeForm.roleId) : null,
            }
          : selectedResource === "suppliers"
            ? supplierForm
            : selectedResource === "financial-categories"
              ? {
                  description: simpleForm.description,
                }
              : selectedResource === "financial-accounts"
                ? {
                    desc: simpleForm.desc,
                    scope: simpleForm.scope,
                    targetType: simpleForm.targetType,
                    active: simpleForm.active,
                  }
                : selectedResource === "measurement-definitions"
                  ? {
                      label: simpleForm.label,
                    }
                  : {
                      desc: simpleForm.desc,
                    };

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
    } catch (err: unknown) {
      console.error(err);
      setError(
        getUserFacingApiErrorMessage(
          err,
          "Não foi possível salvar o registro.",
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleDelete(row: GenericRecord) {
    const id = Number(row[currentConfig.primaryKey]);
    const label =
      selectedResource === "employees"
        ? String(row.fullName ?? row.shortName ?? id)
        : selectedResource === "suppliers"
          ? String(row.tradeName ?? row.fullName ?? id)
          : String(row.desc ?? row.description ?? id);

    setDeleteModal({
      open: true,
      id,
      label,
    });
  }

  async function confirmDelete() {
    if (!deleteModal.id) return;

    try {
      setSubmitting(true);
      setError("");
      await deleteRequest(`${currentConfig.endpoint}/${deleteModal.id}`, {});
      await fetchResource(selectedResource);
      if (selectedResource === "roles") {
        await fetchRoles();
      }
      if (editingId === deleteModal.id) {
        resetForm();
      }
      closeDeleteModal();
    } catch (err: unknown) {
      console.error(err);
      setError(
        getUserFacingApiErrorMessage(
          err,
          "Não foi possível remover o registro.",
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }

  function renderEmployeeTable() {
    return (
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full border-separate border-spacing-y-2">
          <thead className="bg-[#dbd1d1] rounded-t-md">
            <tr className="text-left">
              <th className="px-4 pt-2 font-editorial text-[1.4rem] text-primary">
                Nome
              </th>
              <th className="px-4 pt-2 font-editorial text-[1.4rem] text-primary">
                Cargo
              </th>
              <th className="px-4 pt-2 font-editorial text-[1.4rem] text-primary">
                Contato
              </th>
              <th className="px-4 pt-2 font-editorial text-[1.4rem] text-primary">
                Email
              </th>
              <th className="px-4 pt-2 font-editorial text-[1.4rem] text-primary">
                Nascimento
              </th>
              <th className="px-4 pt-2 font-editorial text-[1.4rem] text-primary">
                Status
              </th>
              <th className="px-4 pt-2 font-editorial text-[1.4rem] text-primary text-right">
                Acoes
              </th>
            </tr>
          </thead>
          <tbody>
            {(paginatedRows as GenericRecord[]).map((row) => (
              <tr key={String(row.idEmployee)} className="bg-surface-lowest">
                <td className="px-4 py-3">
                  <p className="text-[15px] font-semibold text-primary">
                    {String(row.fullName ?? "")}
                  </p>
                  <p className="text-[12px] uppercase tracking-[0.08em] text-neutral-700">
                    {String(row.shortName ?? "")}
                  </p>
                </td>
                <td className="px-4 py-3 text-[14px] text-neutral-700">
                  {String(row.roleDesc ?? "-")}
                </td>
                <td className="px-4 py-3 text-[14px] text-neutral-700">
                  {formatPhone(row.primaryPhone)}
                </td>
                <td className="px-4 py-3 text-[14px] text-neutral-700">
                  {String(row.email ?? "-")}
                </td>
                <td className="px-4 py-3 text-[14px] text-neutral-700">
                  {formatDateOnly(row.birthDate)}
                </td>
                <td className="px-4 py-3 text-[14px] text-neutral-700">
                  {row.active ? "Ativa" : "Inativa"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    {currentConfig.canEdit === false ? null : (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => startEdit(row)}
                      >
                        <Pencil size={14} />
                      </Button>
                    )}
                    {currentConfig.canDelete === false ? null : (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleDelete(row)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    )}
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
          <thead className="bg-[#dbd1d1] rounded-t-md">
            <tr className="text-left">
              <th className="px-4 pt-2 font-editorial text-[1.4rem] text-primary">
                ID
              </th>
              <th className="px-4 pt-2 font-editorial text-[1.4rem] text-primary">
                Descrição
              </th>
              <th className="px-4 pt-2 font-editorial text-[1.4rem] text-primary">
                Status
              </th>
              <th className="px-4 pt-2 font-editorial text-[1.4rem] text-primary text-right">
                Acoes
              </th>
            </tr>
          </thead>
          <tbody>
            {(paginatedRows as GenericRecord[]).map((row) => (
              <tr key={String(row.idPaymentType)} className="bg-surface-lowest">
                <td className="px-4 py-3 text-[14px] font-semibold text-primary">
                  {String(row.idPaymentType ?? "")}
                </td>
                <td className="px-4 py-3 text-[14px] text-neutral-700">
                  {String(row.desc ?? "")}
                </td>
                <td className="px-4 py-3 text-[14px] text-neutral-700">
                  {row.active === false ? "Inativa" : "Ativa"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    {currentConfig.canEdit === false ? null : (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => startEdit(row)}
                      >
                        <Pencil size={14} />
                      </Button>
                    )}
                    {currentConfig.canDelete === false ? null : (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleDelete(row)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  function renderSuppliersTable() {
    return (
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full border-separate border-spacing-y-2">
          <thead className="bg-[#dbd1d1] rounded-t-md">
            <tr className="text-left">
              <th className="px-4 pt-2 font-editorial text-[1.4rem] text-primary">
                Nome
              </th>
              <th className="px-4 pt-2 font-editorial text-[1.4rem] text-primary">
                Contato
              </th>
              <th className="px-4 pt-2 font-editorial text-[1.4rem] text-primary">
                Cidade
              </th>
              <th className="px-4 pt-2 font-editorial text-[1.4rem] text-primary">
                Telefone
              </th>
              <th className="px-4 pt-2 font-editorial text-[1.4rem] text-primary">
                Status
              </th>
              <th className="px-4 pt-2 font-editorial text-[1.4rem] text-primary text-right">
                Acoes
              </th>
            </tr>
          </thead>
          <tbody>
            {(paginatedRows as GenericRecord[]).map((row) => (
              <tr key={String(row.idSupplier)} className="bg-surface-lowest">
                <td className="px-4 py-3">
                  <p className="text-[15px] font-semibold text-primary">
                    {String(row.tradeName || row.fullName || "")}
                  </p>
                  <p className="text-[12px] uppercase tracking-[0.08em] text-neutral-700">
                    {String(row.fullName ?? "")}
                  </p>
                </td>
                <td className="px-4 py-3 text-[14px] text-neutral-700">
                  {String(row.contactName ?? "-")}
                </td>
                <td className="px-4 py-3 text-[14px] text-neutral-700">
                  {String(row.city ?? "-")}{" "}
                  {row.state ? `/ ${String(row.state)}` : ""}
                </td>
                <td className="px-4 py-3 text-[14px] text-neutral-700">
                  {formatPhone(row.phoneCommercial1) !== "-"
                    ? formatPhone(row.phoneCommercial1)
                    : formatPhone(row.phoneMobile)}
                </td>
                <td className="px-4 py-3 text-[14px] text-neutral-700">
                  {row.blocked ? "Bloqueado" : row.active ? "Ativo" : "Inativo"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => startEdit(row)}
                    >
                      <Pencil size={14} />
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDelete(row)}
                    >
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
    const showStatusColumn = selectedResource === "roles";
    const descriptionField =
      selectedResource === "financial-categories"
        ? "description"
        : selectedResource === "measurement-definitions"
          ? "label"
          : "desc";

    return (
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full border-separate border-spacing-y-2">
          <thead className="bg-[#dbd1d1] rounded-t-md">
            <tr className="text-left">
              <th className="px-4 pt-2 font-editorial text-[1.4rem] text-primary">
                ID
              </th>
              <th className="px-4 pt-2 font-editorial text-[1.4rem] text-primary">
                Descrição
              </th>
              {showStatusColumn ? (
                <th className="px-4 pt-2 font-editorial text-[1.4rem] text-primary">
                  Status
                </th>
              ) : null}
              <th className="px-4 pt-2 font-editorial text-[1.4rem] text-primary text-right">
                Acoes
              </th>
            </tr>
          </thead>
          <tbody>
            {(paginatedRows as GenericRecord[]).map((row) => (
              <tr
                key={String(row[currentConfig.primaryKey])}
                className="bg-surface-lowest"
              >
                <td className="px-4 py-3 text-[14px] font-semibold text-primary">
                  {String(row[currentConfig.primaryKey] ?? "")}
                </td>
                <td className="px-4 py-3 text-[14px] text-neutral-700">
                  {String(row[descriptionField] ?? "")}
                </td>
                {showStatusColumn ? (
                  <td className="px-4 py-3 text-[14px] text-neutral-700">
                    {row.active === false ? "Inativo" : "Ativo"}
                  </td>
                ) : null}
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => startEdit(row)}
                    >
                      <Pencil size={14} />
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDelete(row)}
                    >
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

  function renderAuditsTable() {
    return (
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full border-separate border-spacing-y-2">
          <thead className="bg-[#dbd1d1] rounded-t-md">
            <tr className="text-left">
              <th className="px-4 pt-2 font-editorial text-[1.4rem] text-primary">
                Data
              </th>
              <th className="px-4 pt-2 font-editorial text-[1.4rem] text-primary">
                Tipo
              </th>
              <th className="px-4 pt-2 font-editorial text-[1.4rem] text-primary">
                Usuário
              </th>
              <th className="px-4 pt-2 font-editorial text-[1.4rem] text-primary">
                Histórico
              </th>
              <th className="px-4 pt-2 font-editorial text-[1.4rem] text-primary">
                Motivo
              </th>
            </tr>
          </thead>
          <tbody>
            {(paginatedRows as GenericRecord[]).map((row) => (
              <tr
                key={String(row.idAudit)}
                className="bg-surface-lowest align-top"
              >
                <td className="px-4 py-3 text-[14px] text-neutral-700">
                  {formatDate(row.occurredAt)}
                </td>
                <td className="px-4 py-3 text-[14px] font-semibold text-primary">
                  {String(row.auditTypeDescription ?? "-")}
                </td>
                <td className="px-4 py-3 text-[14px] text-neutral-700">
                  {String(row.userName ?? "-")}
                </td>
                <td className="px-4 py-3 text-[14px] text-neutral-700">
                  {String(row.history ?? "-")}
                </td>
                <td className="px-4 py-3 text-[14px] text-neutral-700">
                  {String(row.reason ?? "-")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  function renderAuditFilters() {
    return (
      <div className="mb-4 grid gap-4 rounded-xl bg-surface-lowest p-4 md:grid-cols-[160px_160px_minmax(0,1fr)_220px]">
        <div className="flex flex-col gap-2">
          <label
            className="text-sm font-medium text-primary"
            htmlFor="audit-start-date"
          >
            Data inicial
          </label>
          <input
            id="audit-start-date"
            type="date"
            value={auditFilters.startDate}
            onChange={(event) =>
              setAuditFilters((prev) => ({
                ...prev,
                startDate: event.target.value,
              }))
            }
            className="h-11 w-full border border-outline-variant/50 bg-white px-3 text-sm text-primary"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label
            className="text-sm font-medium text-primary"
            htmlFor="audit-end-date"
          >
            Data final
          </label>
          <input
            id="audit-end-date"
            type="date"
            value={auditFilters.endDate}
            onChange={(event) =>
              setAuditFilters((prev) => ({
                ...prev,
                endDate: event.target.value,
              }))
            }
            className="h-11 w-full border border-outline-variant/50 bg-white px-3 text-sm text-primary"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label
            className="text-sm font-medium text-primary"
            htmlFor="audit-history"
          >
            Histórico
          </label>
          <input
            id="audit-history"
            type="text"
            value={auditFilters.history}
            onChange={(event) =>
              setAuditFilters((prev) => ({
                ...prev,
                history: event.target.value,
              }))
            }
            className="h-11 w-full border border-outline-variant/50 bg-white px-3 text-sm text-primary"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label
            className="text-sm font-medium text-primary"
            htmlFor="audit-type"
          >
            Tipo
          </label>
          <select
            id="audit-type"
            value={auditFilters.auditTypeId}
            onChange={(event) =>
              setAuditFilters((prev) => ({
                ...prev,
                auditTypeId: event.target.value,
              }))
            }
            className="h-11 w-full border border-outline-variant/50 bg-white px-3 text-sm text-primary"
          >
            <option value="">Todos</option>
            {auditTypes.map((auditType) => (
              <option key={auditType.idAuditType} value={auditType.idAuditType}>
                {auditType.description}
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  }

  function renderMobileCards() {
    return (
      <div className="divide-y divide-outline-variant/35 bg-white lg:hidden">
        {(paginatedRows as GenericRecord[]).map((row) => (
          <div
            key={String(row[currentConfig.primaryKey])}
            className="px-4 py-4"
          >
            {selectedResource === "employees" ? (
              <>
                <p className="text-base font-semibold text-primary">
                  {String(row.fullName ?? "")}
                </p>
                <p className="text-xs uppercase tracking-[0.08em] text-neutral-700">
                  {String(row.shortName ?? "")} • {String(row.roleDesc ?? "-")}
                </p>
                <p className="mt-1 text-sm text-neutral-700">
                  {formatPhone(row.primaryPhone)} •{" "}
                  {String(row.email ?? "sem email")}
                </p>
              </>
            ) : selectedResource === "suppliers" ? (
              <>
                <p className="text-base font-semibold text-primary">
                  {String(row.tradeName || row.fullName || "")}
                </p>
                <p className="text-xs uppercase tracking-[0.08em] text-neutral-700">
                  {String(row.fullName ?? "")}
                </p>
                <p className="mt-1 text-sm text-neutral-700">
                  {String(row.city ?? "sem cidade")}{" "}
                  {row.state ? `/ ${String(row.state)}` : ""}
                </p>
              </>
            ) : selectedResource === "payment-types" ? (
              <>
                <p className="text-base font-semibold text-primary">
                  {String(row.desc ?? "")}
                </p>
                <p className="text-xs uppercase tracking-[0.08em] text-neutral-700">
                  ID {String(row.idPaymentType ?? "")}
                </p>
                <p className="mt-1 text-sm text-neutral-700">
                  {row.active === false ? "Inativa" : "Ativa"}
                </p>
              </>
            ) : selectedResource === "roles" ? (
              <>
                <p className="text-base font-semibold text-primary">
                  {String(row.desc ?? "")}
                </p>
                <p className="text-xs uppercase tracking-[0.08em] text-neutral-700">
                  ID {String(row.id ?? "")}
                </p>
                <p className="mt-1 text-sm text-neutral-700">
                  {row.active === false ? "Inativo" : "Ativo"}
                </p>
              </>
            ) : selectedResource === "audits" ? (
              <>
                <p className="text-base font-semibold text-primary">
                  {String(row.auditTypeDescription ?? "-")}
                </p>
                <p className="text-xs uppercase tracking-[0.08em] text-neutral-700">
                  {formatDate(row.occurredAt)} • {String(row.userName ?? "-")}
                </p>
                <p className="mt-1 text-sm text-neutral-700">
                  {String(row.history ?? "-")}
                </p>
                <p className="mt-1 text-xs text-neutral-700">
                  Motivo: {String(row.reason ?? "-")}
                </p>
              </>
            ) : selectedResource === "measurement-definitions" ? (
              <>
                <p className="text-base font-semibold text-primary">
                  {String(row.label ?? "")}
                </p>
              </>
            ) : (
              <>
                <p className="text-base font-semibold text-primary">
                  {String(
                    selectedResource === "financial-categories"
                      ? (row.description ?? "")
                      : (row.desc ?? ""),
                  )}
                </p>
                <p className="text-xs uppercase tracking-[0.08em] text-neutral-700">
                  ID {String(row[currentConfig.primaryKey] ?? "")}
                </p>
              </>
            )}
            {currentConfig.readOnly ? null : (
              <div className="mt-3 flex gap-2">
                {currentConfig.canEdit === false ? null : (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => startEdit(row)}
                  >
                    Editar
                  </Button>
                )}
                {currentConfig.canDelete === false ? null : (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleDelete(row)}
                  >
                    {currentConfig.deleteLabel}
                  </Button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="w-full min-h-full bg-white p-3 sm:p-5 md:bg-surface-low">
      <div className="mb-6 flex items-center gap-3 pt-12">
        <h1 className="text-4xl font-semibold text-primary md:text-[2rem]">
          Administração
        </h1>
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
                    className={`px-4 py-3 text-sm uppercase tracking-widest transition-colors ${
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
                  <h2 className="text-3xl font-semibold text-primary">
                    {currentConfig.title}
                  </h2>
                  {currentConfig.readOnly ? null : (
                    <Button
                      variant="primary"
                      size="md"
                      onClick={openCreateModal}
                    >
                      + Novo
                    </Button>
                  )}
                </div>

                {selectedResource === "audits" ? renderAuditFilters() : null}

                {selectedResource === "audits" && auditLoading ? (
                  <div className="mb-4 rounded-xl bg-surface-lowest px-4 py-3 text-sm text-neutral-700">
                    Atualizando auditoria...
                  </div>
                ) : null}

                {visibleRows.length === 0 ? (
                  <div className="bg-surface-lowest p-6 text-sm text-neutral-700">
                    {currentConfig.emptyLabel}
                  </div>
                ) : (
                  <>
                    {selectedResource === "employees"
                      ? renderEmployeeTable()
                      : selectedResource === "suppliers"
                        ? renderSuppliersTable()
                        : selectedResource === "payment-types"
                          ? renderPaymentTypesTable()
                          : selectedResource === "audits"
                            ? renderAuditsTable()
                            : renderSimpleTable()}
                    {renderMobileCards()}
                    <div className="mt-4 hidden items-center justify-between md:flex">
                      <p className="text-[13px] tracking-[0.04em] text-neutral-700">
                        Exibindo {visibleRows.length === 0 ? 0 : startIndex + 1}
                        -{Math.min(startIndex + pageSize, visibleRows.length)}{" "}
                        de {visibleRows.length}
                      </p>
                      <div className="flex items-center gap-2">
                        <FormControl size="medium" className="min-w-30">
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
                          onClick={() =>
                            setCurrentPage((prev) => Math.max(1, prev - 1))
                          }
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
                            setCurrentPage((prev) =>
                              Math.min(totalPages, prev + 1),
                            )
                          }
                        >
                          Próxima
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
        open={isFormOpen && !currentConfig.readOnly}
        onClose={closeForm}
        title={
          editingId
            ? `Editar ${currentConfig.title}`
            : `Novo em ${currentConfig.title}`
        }
        subtitle={
          selectedResource === "employees"
            ? "Preencha os dados da funcionaria e salve para atualizar a tabela."
            : selectedResource === "suppliers"
              ? "Preencha os dados do fornecedor e confirme para salvar."
              : selectedResource === "payment-types"
                ? "Edite a descrição da forma de pagamento e confirme para salvar."
                : "Edite a descrição e confirme para salvar o cadastro."
        }
      >
        <div className="mx-auto max-w-3xl">
          {error ? (
            <div className="mb-4 flex items-start gap-2 bg-[#ffe7e7] px-3 py-2 text-sm text-[#8f1515]">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          <form className="space-y-3" onSubmit={handleSubmit}>
            {selectedResource === "employees" ? (
              <>
                <input
                  value={employeeForm.fullName}
                  onChange={(e) =>
                    setEmployeeForm((prev) => ({
                      ...prev,
                      fullName: e.target.value,
                    }))
                  }
                  placeholder="Nome completo"
                  className={getAdminInputClassName("fullName")}
                  required
                />
                <input
                  value={employeeForm.shortName}
                  onChange={(e) =>
                    setEmployeeForm((prev) => ({
                      ...prev,
                      shortName: e.target.value,
                    }))
                  }
                  placeholder="Nome curto"
                  className={getAdminInputClassName("shortName")}
                  required
                />
                <select
                  value={employeeForm.roleId}
                  onChange={(e) =>
                    setEmployeeForm((prev) => ({
                      ...prev,
                      roleId: e.target.value,
                    }))
                  }
                  className="h-11 w-full border border-outline-variant/50 bg-white px-3 text-sm text-primary"
                  required
                >
                  <option value="">Selecione o cargo</option>
                  {availableRoles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.desc}
                    </option>
                  ))}
                </select>
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    value={employeeForm.document}
                    onChange={(e) =>
                      setEmployeeForm((prev) => ({
                        ...prev,
                        document: e.target.value,
                      }))
                    }
                    placeholder="CPF/CNPJ"
                    className={getAdminInputClassName("document")}
                  />
                  <input
                    value={employeeForm.rg}
                    onChange={(e) =>
                      setEmployeeForm((prev) => ({
                        ...prev,
                        rg: e.target.value,
                      }))
                    }
                    placeholder="RG"
                    className={getAdminInputClassName("rg")}
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    value={employeeForm.primaryPhone}
                    onChange={(e) =>
                      setEmployeeForm((prev) => ({
                        ...prev,
                        primaryPhone: e.target.value,
                      }))
                    }
                    placeholder="Telefone principal"
                    className={getAdminInputClassName("primaryPhone")}
                  />
                  <input
                    value={employeeForm.secondaryPhone}
                    onChange={(e) =>
                      setEmployeeForm((prev) => ({
                        ...prev,
                        secondaryPhone: e.target.value,
                      }))
                    }
                    placeholder="Telefone secundario"
                    className={getAdminInputClassName("secondaryPhone")}
                  />
                </div>
                <input
                  value={employeeForm.email}
                  onChange={(e) =>
                    setEmployeeForm((prev) => ({
                      ...prev,
                      email: e.target.value,
                    }))
                  }
                  placeholder="Email"
                  className={getAdminInputClassName("email")}
                />
                <input
                  type="date"
                  value={employeeForm.birthDate}
                  onChange={(e) =>
                    setEmployeeForm((prev) => ({
                      ...prev,
                      birthDate: e.target.value,
                    }))
                  }
                  className={getAdminInputClassName("birthDate")}
                />
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    value={employeeForm.zipCode}
                    onChange={(e) =>
                      setEmployeeForm((prev) => ({
                        ...prev,
                        zipCode: e.target.value,
                      }))
                    }
                    placeholder="CEP"
                    className={getAdminInputClassName("zipCode")}
                  />
                  <input
                    value={employeeForm.state}
                    onChange={(e) =>
                      setEmployeeForm((prev) => ({
                        ...prev,
                        state: e.target.value,
                      }))
                    }
                    placeholder="UF"
                    className={getAdminInputClassName("state")}
                  />
                </div>
                <input
                  value={employeeForm.street}
                  onChange={(e) =>
                    setEmployeeForm((prev) => ({
                      ...prev,
                      street: e.target.value,
                    }))
                  }
                  placeholder="Endereco"
                  className={getAdminInputClassName("street")}
                />
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    value={employeeForm.number}
                    onChange={(e) =>
                      setEmployeeForm((prev) => ({
                        ...prev,
                        number: e.target.value,
                      }))
                    }
                    placeholder="Numero"
                    className={getAdminInputClassName("number")}
                  />
                  <input
                    value={employeeForm.complement}
                    onChange={(e) =>
                      setEmployeeForm((prev) => ({
                        ...prev,
                        complement: e.target.value,
                      }))
                    }
                    placeholder="Complemento"
                    className={getAdminInputClassName("complement")}
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    value={employeeForm.neighborhood}
                    onChange={(e) =>
                      setEmployeeForm((prev) => ({
                        ...prev,
                        neighborhood: e.target.value,
                      }))
                    }
                    placeholder="Bairro"
                    className={getAdminInputClassName("neighborhood")}
                  />
                  <input
                    value={employeeForm.city}
                    onChange={(e) =>
                      setEmployeeForm((prev) => ({
                        ...prev,
                        city: e.target.value,
                      }))
                    }
                    placeholder="Cidade"
                    className={getAdminInputClassName("city")}
                  />
                </div>
                <input
                  value={employeeForm.bankData}
                  onChange={(e) =>
                    setEmployeeForm((prev) => ({
                      ...prev,
                      bankData: e.target.value,
                    }))
                  }
                  placeholder="Dados bancarios / Pix"
                  className={getAdminInputClassName("bankData")}
                />
                <textarea
                  value={employeeForm.comment}
                  onChange={(e) =>
                    setEmployeeForm((prev) => ({
                      ...prev,
                      comment: e.target.value,
                    }))
                  }
                  placeholder="Observacoes"
                  className="min-h-24 w-full border border-outline-variant/50 bg-white px-3 py-2 text-sm text-primary uppercase"
                />
                <label className="flex items-center gap-2 text-sm text-primary">
                  <input
                    type="checkbox"
                    checked={employeeForm.active}
                    onChange={(e) =>
                      setEmployeeForm((prev) => ({
                        ...prev,
                        active: e.target.checked,
                      }))
                    }
                  />
                  Funcionaria ativa
                </label>
              </>
            ) : selectedResource === "suppliers" ? (
              <>
                <input
                  value={supplierForm.fullName}
                  onChange={(e) =>
                    setSupplierForm((prev) => ({
                      ...prev,
                      fullName: e.target.value,
                    }))
                  }
                  placeholder="Nome completo / razão social"
                  className={getAdminInputClassName("fullName")}
                  required
                />
                <input
                  value={supplierForm.tradeName}
                  onChange={(e) =>
                    setSupplierForm((prev) => ({
                      ...prev,
                      tradeName: e.target.value,
                    }))
                  }
                  placeholder="Nome fantasia"
                  className="h-11 w-full border border-outline-variant/50 bg-white px-3 text-sm text-primary"
                />
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    value={supplierForm.contactName}
                    onChange={(e) =>
                      setSupplierForm((prev) => ({
                        ...prev,
                        contactName: e.target.value,
                      }))
                    }
                    placeholder="Contato"
                    className={getAdminInputClassName("contactName")}
                  />
                  <input
                    value={supplierForm.email}
                    onChange={(e) =>
                      setSupplierForm((prev) => ({
                        ...prev,
                        email: e.target.value,
                      }))
                    }
                    placeholder="Email"
                    className={getAdminInputClassName("email")}
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    value={supplierForm.document}
                    onChange={(e) =>
                      setSupplierForm((prev) => ({
                        ...prev,
                        document: e.target.value,
                      }))
                    }
                    placeholder="CPF/CNPJ"
                    className={getAdminInputClassName("document")}
                  />
                  <input
                    value={supplierForm.rg}
                    onChange={(e) =>
                      setSupplierForm((prev) => ({
                        ...prev,
                        rg: e.target.value,
                      }))
                    }
                    placeholder="RG/IE"
                    className={getAdminInputClassName("rg")}
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    value={supplierForm.phoneCommercial1}
                    onChange={(e) =>
                      setSupplierForm((prev) => ({
                        ...prev,
                        phoneCommercial1: e.target.value,
                      }))
                    }
                    placeholder="Telefone comercial 1"
                    className={getAdminInputClassName("phoneCommercial1")}
                  />
                  <input
                    value={supplierForm.phoneCommercial2}
                    onChange={(e) =>
                      setSupplierForm((prev) => ({
                        ...prev,
                        phoneCommercial2: e.target.value,
                      }))
                    }
                    placeholder="Telefone comercial 2"
                    className={getAdminInputClassName("phoneCommercial2")}
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    value={supplierForm.phoneMobile}
                    onChange={(e) =>
                      setSupplierForm((prev) => ({
                        ...prev,
                        phoneMobile: e.target.value,
                      }))
                    }
                    placeholder="Celular"
                    className={getAdminInputClassName("phoneMobile")}
                  />
                  <input
                    value={supplierForm.fax}
                    onChange={(e) =>
                      setSupplierForm((prev) => ({
                        ...prev,
                        fax: e.target.value,
                      }))
                    }
                    placeholder="Fax"
                    className={getAdminInputClassName("fax")}
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    value={supplierForm.zipCode}
                    onChange={(e) =>
                      setSupplierForm((prev) => ({
                        ...prev,
                        zipCode: e.target.value,
                      }))
                    }
                    placeholder="CEP"
                    className={getAdminInputClassName("zipCode")}
                  />
                  <input
                    value={supplierForm.state}
                    onChange={(e) =>
                      setSupplierForm((prev) => ({
                        ...prev,
                        state: e.target.value,
                      }))
                    }
                    placeholder="UF"
                    className={getAdminInputClassName("state")}
                  />
                </div>
                <input
                  value={supplierForm.street}
                  onChange={(e) =>
                    setSupplierForm((prev) => ({
                      ...prev,
                      street: e.target.value,
                    }))
                  }
                  placeholder="Endereco"
                  className={getAdminInputClassName("street")}
                />
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    value={supplierForm.neighborhood}
                    onChange={(e) =>
                      setSupplierForm((prev) => ({
                        ...prev,
                        neighborhood: e.target.value,
                      }))
                    }
                    placeholder="Bairro"
                    className={getAdminInputClassName("neighborhood")}
                  />
                  <input
                    value={supplierForm.city}
                    onChange={(e) =>
                      setSupplierForm((prev) => ({
                        ...prev,
                        city: e.target.value,
                      }))
                    }
                    placeholder="Cidade"
                    className={getAdminInputClassName("city")}
                  />
                </div>
                <textarea
                  value={supplierForm.comment}
                  onChange={(e) =>
                    setSupplierForm((prev) => ({
                      ...prev,
                      comment: e.target.value,
                    }))
                  }
                  placeholder="Observacoes"
                  className="min-h-24 w-full border border-outline-variant/50 bg-white px-3 py-2 text-sm text-primary uppercase"
                />
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm text-primary">
                    <input
                      type="checkbox"
                      checked={supplierForm.active}
                      onChange={(e) =>
                        setSupplierForm((prev) => ({
                          ...prev,
                          active: e.target.checked,
                        }))
                      }
                    />
                    Fornecedor ativo
                  </label>
                </div>
              </>
            ) : selectedResource === "payment-types" ? (
              <>
                <input
                  value={simpleForm.desc}
                  onChange={(e) =>
                    setSimpleForm((prev) => ({ ...prev, desc: e.target.value }))
                  }
                  placeholder="Descrição"
                  className={simpleInputClassName}
                  required
                />
                <label className="flex items-center gap-2 text-sm text-primary">
                  <input
                    type="checkbox"
                    checked={simpleForm.active}
                    onChange={(e) =>
                      setSimpleForm((prev) => ({
                        ...prev,
                        active: e.target.checked,
                      }))
                    }
                  />
                  Forma de pagamento ativa
                </label>
              </>
            ) : selectedResource === "roles" ? (
              <>
                <input
                  value={simpleForm.desc}
                  onChange={(e) =>
                    setSimpleForm((prev) => ({ ...prev, desc: e.target.value }))
                  }
                  placeholder="Descrição"
                  className={simpleInputClassName}
                  required
                />
                <label className="flex items-center gap-2 text-sm text-primary">
                  <input
                    type="checkbox"
                    checked={simpleForm.active}
                    onChange={(e) =>
                      setSimpleForm((prev) => ({
                        ...prev,
                        active: e.target.checked,
                      }))
                    }
                  />
                  Cargo ativo
                </label>
              </>
            ) : selectedResource === "financial-accounts" ? (
              <>
                <input
                  value={simpleForm.desc}
                  onChange={(e) =>
                    setSimpleForm((prev) => ({ ...prev, desc: e.target.value }))
                  }
                  placeholder="Descrição da conta"
                  className="h-11 w-full border border-outline-variant/50 bg-white px-3 text-sm text-primary"
                  required
                />
                <div className="grid gap-3 md:grid-cols-2">
                  <select
                    value={simpleForm.scope}
                    onChange={(e) =>
                      setSimpleForm((prev) => ({
                        ...prev,
                        scope: e.target.value,
                      }))
                    }
                    className="h-11 w-full border border-outline-variant/50 bg-white px-3 text-sm text-primary"
                  >
                    <option value="LOJA">Loja</option>
                    <option value="PESSOAL">Pessoal</option>
                  </select>
                  <select
                    value={simpleForm.targetType}
                    onChange={(e) =>
                      setSimpleForm((prev) => ({
                        ...prev,
                        targetType: e.target.value,
                      }))
                    }
                    className="h-11 w-full border border-outline-variant/50 bg-white px-3 text-sm text-primary"
                  >
                    <option value="BANK">Banco</option>
                    <option value="CASH">Caixa</option>
                  </select>
                </div>
                <label className="flex items-center gap-2 text-sm text-primary">
                  <input
                    type="checkbox"
                    checked={simpleForm.active}
                    onChange={(e) =>
                      setSimpleForm((prev) => ({
                        ...prev,
                        active: e.target.checked,
                      }))
                    }
                  />
                  Conta ativa
                </label>
              </>
            ) : selectedResource === "financial-categories" ? (
              <input
                value={simpleForm.description}
                onChange={(e) =>
                  setSimpleForm((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="Descrição"
                className={simpleInputClassName}
                required
              />
            ) : selectedResource === "measurement-definitions" ? (
              <input
                value={simpleForm.label}
                onChange={(e) =>
                  setSimpleForm((prev) => ({
                    ...prev,
                    label: e.target.value,
                  }))
                }
                placeholder="Nome da medida"
                className="h-11 w-full border border-outline-variant/50 bg-white px-3 text-sm text-primary"
                required
              />
            ) : (
              <input
                value={simpleForm.desc}
                onChange={(e) =>
                  setSimpleForm((prev) => ({ ...prev, desc: e.target.value }))
                }
                placeholder="Descrição"
                className={simpleInputClassName}
                required
              />
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={submitting}
              >
                {editingId ? "Salvar alteracoes" : "Cadastrar"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={closeForm}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </div>
      </CustomerModal>

      <CustomerModal
        open={deleteModal.open}
        onClose={closeDeleteModal}
        title={
          currentConfig.isSoftDelete ? "Desativar registro" : "Excluir registro"
        }
        subtitle="Confirme a ação antes de continuar."
      >
        <div className="space-y-5">
          <p className="text-sm text-neutral-700">
            {currentConfig.isSoftDelete ? "Deseja desativar" : "Deseja excluir"}{" "}
            <span className="font-semibold text-primary">
              {deleteModal.label}
            </span>
            ?
          </p>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={closeDeleteModal}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant={currentConfig.isSoftDelete ? "primary" : "danger"}
              size="md"
              onClick={() => void confirmDelete()}
              isLoading={submitting}
            >
              {currentConfig.isSoftDelete
                ? "Confirmar desativação"
                : "Confirmar exclusão"}
            </Button>
          </div>
        </div>
      </CustomerModal>
    </div>
  );
}
