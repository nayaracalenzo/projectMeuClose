import { CircularProgress } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "../components/Button";
import CustomerDetailsCard, { type CustomerFieldConfig } from "../components/CustomerDetailsCard";
import CustomerReceivablesModal from "../components/CustomerReceivablesModal";
import CustomerSalesModal from "../components/CustomerSalesModal";
import { getRequest, updateRequest } from "../services/request";
import { formatDocument } from "../utils/formatDocument";
import { getUserFacingApiErrorMessage } from "../utils/apiError";
import { maskCpfCnpj } from "../utils/maskCpfCnpj";

type ClientDetails = {
  id: number;
  typeCustomer: "INDIVIDUAL" | "COMPANY";
  document: string | null;
  rg: string | null;
  fullName: string | null;
  birthDate: string | null;
  companyName: string | null;
  tradeName: string | null;
  phone: string | null;
  email: string | null;
  zipCode: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  active: boolean;
  blocked: boolean | null;
  professionId: number | null;
  professionName: string | null;
  comment: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type ProfessionOption = {
  id: number;
  name: string;
};

type ValidationIssue = {
  key: "document" | "phone" | "fullName" | "companyName";
  label: string;
  message: string;
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const base = String(value).slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(base);
  if (!match) return "-";
  return `${match[3]}/${match[2]}/${match[1]}`;
};

const formatType = (value: string) =>
  value === "INDIVIDUAL" ? "Pessoa física" : "Pessoa jurídica";

const onlyDigits = (value?: string | null) => (value || "").replace(/\D/g, "");

const formatPhoneMask = (value?: string | null) => {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 3)} ${digits.slice(3, 7)}-${digits.slice(7)}`;
};

const toEditableForm = (clientData: ClientDetails): Partial<ClientDetails> => ({
  ...clientData,
  document: maskCpfCnpj(clientData.document || ""),
  phone: formatPhoneMask(clientData.phone),
  zipCode: clientData.zipCode || "",
});

const getClientValidationIssues = (
  form: Partial<ClientDetails>,
): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const typeCustomer = form.typeCustomer;
  const documentDigits = onlyDigits(form.document);
  const phoneDigits = onlyDigits(form.phone);
  const fullName = String(form.fullName || "").trim();
  const companyName = String(form.companyName || "").trim();

  if (!phoneDigits) {
    issues.push({
      key: "phone",
      label: "Telefone",
      message: "Telefone é obrigatório.",
    });
  }

  if (typeCustomer === "INDIVIDUAL") {
    if (!documentDigits) {
      issues.push({ key: "document", label: "CPF", message: "CPF é obrigatório." });
    } else if (documentDigits.length !== 11) {
      issues.push({
        key: "document",
        label: "CPF",
        message: "CPF deve conter 11 dígitos.",
      });
    }

    if (!fullName) {
      issues.push({
        key: "fullName",
        label: "Nome",
        message: "Nome completo é obrigatório para pessoa física.",
      });
    }
  }

  if (typeCustomer === "COMPANY") {
    if (!documentDigits) {
      issues.push({ key: "document", label: "CNPJ", message: "CNPJ é obrigatório." });
    } else if (documentDigits.length !== 14) {
      issues.push({
        key: "document",
        label: "CNPJ",
        message: "CNPJ deve conter 14 dígitos.",
      });
    }

    if (!companyName) {
      issues.push({
        key: "companyName",
        label: "Razão social",
        message: "Razão social é obrigatória para pessoa jurídica.",
      });
    }
  }

  return issues;
};

export default function CustomerDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [client, setClient] = useState<ClientDetails | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [zipLookupMessage, setZipLookupMessage] = useState("");
  const [form, setForm] = useState<Partial<ClientDetails>>({});
  const [professions, setProfessions] = useState<ProfessionOption[]>([]);
  const [isReceivablesModalOpen, setIsReceivablesModalOpen] = useState(false);
  const [isSalesModalOpen, setIsSalesModalOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError("");
        const [clientData, professionsData] = await Promise.all([
          getRequest(`/clients/${id}`),
          getRequest("/professions"),
        ]);
        setClient(clientData);
        setForm(toEditableForm(clientData));
        setProfessions(professionsData);
      } catch (err: unknown) {
        const maybeAxiosError = err as { response?: { status?: number } };
        if (maybeAxiosError.response?.status === 404) {
          setError("Cliente não encontrado.");
        } else {
          setError("Erro ao carregar detalhes do cliente.");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const setField = (field: keyof ClientDetails, value: unknown) => {
    setForm((prev) => ({ ...prev, [field]: value as never }));
  };

  const handleZipCodeChange = async (value: string) => {
    const digits = onlyDigits(value).slice(0, 8);
    setField("zipCode", digits);
    setZipLookupMessage("");

    if (digits.length !== 8) return;

    try {
      setZipLookupMessage("Buscando endereço pelo CEP...");
      const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await response.json();

      if (data.erro) {
        setZipLookupMessage("CEP não encontrado.");
        return;
      }

      setForm((prev) => ({
        ...prev,
        zipCode: digits,
        street: data.logradouro || prev.street || "",
        neighborhood: data.bairro || prev.neighborhood || "",
        complement: data.complemento || prev.complement || "",
        city: data.localidade || prev.city || "",
        state: data.uf || prev.state || "",
      }));
      setZipLookupMessage("Endereço preenchido automaticamente.");
    } catch {
      setZipLookupMessage("Não foi possível consultar o CEP.");
    }
  };

  const handleFieldChange = (key: string, value: unknown) => {
    if (key === "zipCode") {
      handleZipCodeChange(String(value || ""));
      return;
    }

    if (key === "phone") {
      setField("phone", formatPhoneMask(String(value || "")));
      return;
    }

    if (key === "document") {
      setField("document", maskCpfCnpj(String(value || "")));
      return;
    }

    if (key === "professionId") {
      const num = value === "" ? null : Number(value);
      setField("professionId", num);
      return;
    }

    setField(key as keyof ClientDetails, value);
  };

  const values = useMemo(
    () => ((isEditing ? form : client) as Record<string, unknown>) || {},
    [client, form, isEditing],
  );

  const professionsOptions = professions.map((item) => ({
    value: item.id,
    label: item.name,
  }));

  const validationIssues = useMemo(
    () => getClientValidationIssues(isEditing ? form : client || {}),
    [client, form, isEditing],
  );

  const invalidFieldKeys = useMemo(
    () => new Set(validationIssues.map((issue) => issue.key)),
    [validationIssues],
  );

  const cards = useMemo(() => {
    const isIndividual = (form.typeCustomer || client?.typeCustomer) === "INDIVIDUAL";
    const isCompany = (form.typeCustomer || client?.typeCustomer) === "COMPANY";

    const principal: CustomerFieldConfig[] = [
      {
        key: "typeCustomer",
        label: "Tipo",
        formatValue: (v) => formatType(String(v || "INDIVIDUAL")),
      },
      {
        key: "fullName",
        label: "Nome",
        editable: true,
        required: isIndividual,
        invalid: invalidFieldKeys.has("fullName"),
        inputClassName: "w-[85%]",
      },
      {
        key: "companyName",
        label: "Razão social",
        editable: true,
        required: isCompany,
        invalid: invalidFieldKeys.has("companyName"),
        inputClassName: "w-[85%]",
      },
      {
        key: "tradeName",
        label: "Nome fantasia",
        editable: true,
        inputClassName: "w-[85%]",
      },
    ];

    const docs: CustomerFieldConfig[] = [
      {
        key: "document",
        label: isIndividual ? "CPF" : "CNPJ",
        editable: true,
        required: true,
        invalid: invalidFieldKeys.has("document"),
        group: "document-rg",
        inputClassName: "w-full",
        formatValue: (v) => formatDocument(String(v || "")),
      },
      {
        key: "rg",
        label: "RG",
        editable: true,
        group: "document-rg",
        inputClassName: "w-full",
      },
      {
        key: "email",
        label: "Email",
        editable: true,
        inputClassName: "w-[85%]",
      },
      {
        key: "phone",
        label: "Telefone",
        editable: true,
        required: true,
        invalid: invalidFieldKeys.has("phone"),
        inputClassName: "max-w-[40%]",
        formatValue: (v) => formatPhoneMask(String(v || "")),
      },
      {
        key: "professionId",
        label: "Profissão",
        type: "select",
        editable: true,
        options: professionsOptions,
        formatValue: (_v, allValues) =>
          String(allValues.professionName || "-") || "-",
        inputClassName: "max-w-[41.5%]",
      },
    ];

    const endereco: CustomerFieldConfig[] = [
      {
        key: "zipCode",
        label: "CEP",
        editable: true,
        inputClassName: "max-w-[170px]",
      },
      { key: "street", label: "Rua", editable: true, group: "street-number", inputClassName: "flex-1" },
      {
        key: "number",
        label: "Nº",
        editable: true,
        group: "street-number",
        inputClassName: "max-w-[60px]",
      },
      {
        key: "complement",
        label: "Complemento",
        editable: true,
      },
      { key: "neighborhood", label: "Bairro", editable: true },
      {
        key: "city",
        label: "Cidade",
        editable: true,
        group: "city-state",
        inputClassName: "w-full",
      },
      {
        key: "state",
        label: "UF",
        editable: true,
        group: "city-state",
        inputClassName: "max-w-[110px]",
      },
    ];

    const situacao: CustomerFieldConfig[] = [
      { key: "active", label: "Ativo", editable: true, type: "checkbox" },
      { key: "blocked", label: "Bloqueado", editable: true, type: "checkbox" },
      {
        key: "createdAt",
        label: "Criado em",
        formatValue: (v) => formatDate(String(v || "")),
      },
      {
        key: "updatedAt",
        label: "Atualizado em",
        formatValue: (v) => formatDate(String(v || "")),
      },
      {
        key: "comment",
        label: "Observações",
        editable: true,
        inputClassName: "w-[85%] h-20",
      },
    ];

    return [
      { title: "Dados principais", fields: principal },
      { title: "Documentos e contato", fields: docs },
      { title: "Endereço", fields: endereco },
      { title: "Situação e observações", fields: situacao },
    ];
  }, [client?.typeCustomer, form.typeCustomer, invalidFieldKeys, professionsOptions]);

  const handleSave = async () => {
    if (!id) return;

    if (validationIssues.length > 0) {
      setSaveMessage(validationIssues[0].message);
      return;
    }

    try {
      setSaving(true);
      setSaveMessage("");

      const payload = {
        typeCustomer: form.typeCustomer,
        document: onlyDigits(form.document),
        rg: form.rg,
        fullName: form.fullName,
        birthDate: form.birthDate,
        companyName: form.companyName,
        tradeName: form.tradeName,
        phone: onlyDigits(form.phone),
        email: form.email,
        zipCode: onlyDigits(form.zipCode),
        street: form.street,
        number: form.number,
        complement: form.complement,
        neighborhood: form.neighborhood,
        city: form.city,
        state: typeof form.state === "string" ? form.state.toUpperCase().slice(0, 2) : form.state,
        active: form.active,
        blocked: form.blocked,
        professionId: form.professionId,
        comment: form.comment,
      };

      const updated = await updateRequest(`/clients/${id}`, payload as object);
      setClient(updated as ClientDetails);
      setForm(toEditableForm(updated as ClientDetails));
      setIsEditing(false);
      setSaveMessage("Cliente atualizado com sucesso.");
    } catch (err: unknown) {
      setSaveMessage(
        getUserFacingApiErrorMessage(err, "Não foi possível salvar as alterações."),
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mt-50 flex w-full items-center justify-center">
        <CircularProgress />
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="w-full min-h-full min-w-0 bg-white p-3 sm:p-5 md:bg-surface-low">
        <h1 className="pt-12 pb-6 text-6xl font-semibold text-primary md:text-4xl">Detalhe do Cliente</h1>
        <p className="mb-4 text-neutral-700">{error || "Cliente não encontrado."}</p>
        <Button variant="secondary" size="md" onClick={() => navigate("/clientes")}>Voltar para clientes</Button>
      </div>
    );
  }

  return (
    <div className="w-full min-h-full min-w-0 bg-white p-3 sm:p-5 md:bg-surface-low">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h1 className="pt-12 pb-6 text-6xl font-semibold text-primary md:text-4xl">Detalhe do Cliente</h1>
        <div className="hidden gap-2 md:flex">
          {isEditing ? (
            <>
              <Button
                variant="secondary"
                size="md"
                onClick={() => {
                  setForm(toEditableForm(client));
                  setIsEditing(false);
                  setZipLookupMessage("");
                  setSaveMessage("");
                }}
              >
                Cancelar
              </Button>
              <Button variant="primary" size="md" onClick={handleSave} disabled={saving}>
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" size="md" onClick={() => navigate("/clientes")}>Voltar</Button>
              <Button variant="secondary" size="md" onClick={() => setIsSalesModalOpen(true)}>Vendas do Cliente</Button>
              <Button variant="secondary" size="md" onClick={() => setIsReceivablesModalOpen(true)}>A Receber</Button>
              <Button variant="primary" size="md" onClick={() => setIsEditing(true)}>Editar</Button>
            </>
          )}
        </div>
      </div>

      {validationIssues.length > 0 && !isEditing && (
        <p className="mb-4 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Cadastro legado com pendências: {validationIssues.map((issue) => issue.label).join(", ")}.
        </p>
      )}
      {saveMessage && <p className="mb-4 text-sm text-neutral-700">{saveMessage}</p>}
      {isEditing && zipLookupMessage && (
        <p className="mb-4 text-xs text-neutral-700">{zipLookupMessage}</p>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {cards.map((card) => (
          <CustomerDetailsCard
            key={card.title}
            title={card.title}
            fields={card.fields}
            values={values}
            isEditing={isEditing}
            onFieldChange={handleFieldChange}
          />
        ))}
      </div>

      <CustomerSalesModal
        open={isSalesModalOpen}
        clientName={String(values.fullName || client.fullName || "Cliente")}
        onClose={() => setIsSalesModalOpen(false)}
      />

      <CustomerReceivablesModal
        open={isReceivablesModalOpen}
        clientName={String(values.fullName || client.fullName || "Cliente")}
        onClose={() => setIsReceivablesModalOpen(false)}
      />
    </div>
  );
}
