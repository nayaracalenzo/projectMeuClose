import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/Button";
import { getRequest, postRequest } from "../services/request";
import { maskPhone } from "../utils/maskPhone";
import { maskCpfCnpj } from "../utils/maskCpfCnpj";
import { maskCep } from "../utils/maskCep";

type ProfessionOption = {
  id: number;
  name: string;
};

type NewCustomerForm = {
  typeCustomer: "INDIVIDUAL" | "COMPANY";
  document: string;
  rg: string;
  fullName: string;
  birthDate: string;
  companyName: string;
  tradeName: string;
  phone: string;
  email: string;
  zipCode: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  professionId: string;
  comment: string;
};

type FieldConfig = {
  key: keyof NewCustomerForm;
  label: string;
  type?: "text" | "date" | "select";
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  section?: "main" | "address";
};

const onlyDigits = (value: string) => value.replace(/\D/g, "");

const getCustomerValidationMessage = (form: NewCustomerForm) => {
  const documentDigits = onlyDigits(form.document);
  const phoneDigits = onlyDigits(form.phone);

  if (!form.typeCustomer) {
    return "Tipo e obrigatorio.";
  }

  if (!phoneDigits) {
    return "Telefone e obrigatorio.";
  }

  if (form.typeCustomer === "INDIVIDUAL") {
    if (!documentDigits) return "CPF e obrigatorio.";
    if (documentDigits.length !== 11) return "CPF deve conter 11 digitos.";
    if (!form.fullName.trim()) return "Nome completo e obrigatorio para pessoa fisica.";
  }

  if (form.typeCustomer === "COMPANY") {
    if (!documentDigits) return "CNPJ e obrigatorio.";
    if (documentDigits.length !== 14) return "CNPJ deve conter 14 digitos.";
    if (!form.companyName.trim()) return "Razão social é obrigatória para pessoa jurídica.";
  }

  return null;
};

export default function NewCustomer() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [professions, setProfessions] = useState<ProfessionOption[]>([]);
  const [form, setForm] = useState<NewCustomerForm>({
    typeCustomer: "INDIVIDUAL",
    document: "",
    rg: "",
    fullName: "",
    birthDate: "",
    companyName: "",
    tradeName: "",
    phone: "",
    email: "",
    zipCode: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    professionId: "",
    comment: "",
  });

  useEffect(() => {
    const fetchProfessions = async () => {
      try {
        const data = await getRequest("/professions");
        setProfessions(data);
      } catch {
        setProfessions([]);
      }
    };

    fetchProfessions();
  }, []);

  const baseClass =
    "h-10 w-full rounded-lg border border-[#a59797] bg-[#f9f7f6] px-3 text-[#2a2526] shadow-xs transition duration-200 focus:outline-none focus:ring-2 focus:ring-[#8a4d5dcf]";

  const professionOptions = useMemo(
    () => professions.map((item) => ({ value: String(item.id), label: item.name })),
    [professions],
  );

  const fields: FieldConfig[] = useMemo(
    () => [
      { key: "typeCustomer", label: "Tipo", required: true, type: "select", section: "main", options: [
        { value: "INDIVIDUAL", label: "Pessoa física" },
        { value: "COMPANY", label: "Pessoa jurídica" },
      ] },
      { key: "document", label: form.typeCustomer === "INDIVIDUAL" ? "CPF" : "CNPJ", required: true, section: "main" },
      { key: "fullName", label: "Nome Completo", required: form.typeCustomer === "INDIVIDUAL", section: "main" },
      { key: "rg", label: "RG", section: "main" },
      { key: "companyName", label: "Razão social", required: form.typeCustomer === "COMPANY", section: "main" },
      { key: "tradeName", label: "Nome fantasia", section: "main" },
      { key: "phone", label: "Telefone", required: true, section: "main" },
      { key: "email", label: "Email", section: "main" },
      { key: "professionId", label: "Profissão", type: "select", section: "main", options: [{ value: "", label: "Selecione..." }, ...professionOptions] },

      { key: "zipCode", label: "CEP", section: "address" },
      { key: "street", label: "Rua", section: "address" },
      { key: "number", label: "Número", section: "address" },
      { key: "complement", label: "Complemento", section: "address" },
      { key: "neighborhood", label: "Bairro", section: "address" },
      { key: "city", label: "Cidade", section: "address" },
      { key: "state", label: "UF", section: "address" },
    ],
    [form.typeCustomer, professionOptions],
  );

  const mainFields = fields.filter((field) => {
    if (field.section !== "main") return false;
    if (form.typeCustomer === "INDIVIDUAL" && (field.key === "companyName" || field.key === "tradeName")) {
      return false;
    }
    return true;
  });
  const addressFields = fields.filter((field) => field.section === "address");

  const setField = (field: keyof NewCustomerForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleZipCodeChange = async (value: string) => {
    const digits = onlyDigits(value).slice(0, 8);
    setField("zipCode", maskCep(digits));

    if (digits.length !== 8) return;

    try {
      const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await response.json();
      if (data.erro) return;

      setForm((prev) => ({
        ...prev,
        zipCode: maskCep(digits),
        street: data.logradouro || prev.street,
        neighborhood: data.bairro || prev.neighborhood,
        complement: data.complemento || prev.complement,
        city: data.localidade || prev.city,
        state: data.uf || prev.state,
      }));
    } catch {
      // noop
    }
  };

  const handleFieldChange = (field: keyof NewCustomerForm, value: string) => {
    if (field === "phone") {
      setField("phone", maskPhone(value));
      return;
    }
    if (field === "document") {
      setField("document", maskCpfCnpj(value));
      return;
    }
    if (field === "rg") {
      setField("rg", (value));
      return;
    }
    if (field === "zipCode") {
      handleZipCodeChange(value);
      return;
    }
    if (field === "state") {
      setField("state", value.toUpperCase().slice(0, 2));
      return;
    }
    setField(field, value);
  };

  const renderField = (field: FieldConfig) => {
    const label = `${field.label}${field.required ? " *" : ""}`;

    if (field.type === "select") {
      return (
        <div key={field.key}>
          <label className="mb-1 block text-sm text-primary">{label}</label>
          <select
            value={form[field.key]}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            className={baseClass}
          >
            {(field.options || []).map((option) => (
              <option key={`${field.key}-${option.value}`} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      );
    }

    return (
      <div key={field.key}>
        <label className="mb-1 block text-sm text-primary">{label}</label>
        <input
          type={field.type === "date" ? "date" : "text"}
          value={form[field.key]}
          onChange={(e) => handleFieldChange(field.key, e.target.value)}
          className={baseClass}
        />
      </div>
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationMessage = getCustomerValidationMessage(form);
    if (validationMessage) {
      setMessage(validationMessage);
      return;
    }

    try {
      setSaving(true);
      setMessage("");

      await postRequest("/clients", {
        typeCustomer: form.typeCustomer,
        document: onlyDigits(form.document),
        rg: form.rg || null,
        fullName: form.fullName || null,
        birthDate: form.birthDate || null,
        companyName: form.companyName || null,
        tradeName: form.tradeName || null,
        phone: onlyDigits(form.phone),
        email: form.email || null,
        zipCode: onlyDigits(form.zipCode),
        street: form.street || null,
        number: form.number || null,
        complement: form.complement || null,
        neighborhood: form.neighborhood || null,
        city: form.city || null,
        state: form.state || null,
        professionId: form.professionId ? Number(form.professionId) : null,
        comment: form.comment || null,
      });

      navigate("/clientes");
    } catch (error: unknown) {
      const maybeAxiosError = error as {
        response?: { data?: { message?: string } };
      };
      setMessage(
        maybeAxiosError.response?.data?.message || "Não foi possível salvar o cliente.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full min-w-0 bg-white p-3 sm:p-5 md:bg-white/80">
      <div className=" bg-surface-lowest p-6 shadow-sm">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-4xl font-semibold text-primary">Novo Cliente</h1>
          <Button variant="secondary" onClick={() => navigate(-1)}>
            Voltar
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {mainFields.map(renderField)}
          </div>

          <div className="rounded border border-outline-variant/40 bg-surface-lowest p-4">
            <h2 className="mb-3 font-editorial text-2xl text-primary">
              Endereço
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {addressFields.map(renderField)}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm text-primary">
              Observações
            </label>
            <textarea
              value={form.comment}
              onChange={(e) => setField("comment", e.target.value)}
              className="min-h-24 w-full rounded-lg border border-[#a59797] bg-[#f9f7f6] px-3 py-2 text-[#2a2526] shadow-xs transition duration-200 focus:outline-none focus:ring-2 focus:ring-[#8a4d5dcf]"
            />
          </div>

          {message && <p className="text-sm text-neutral-700">{message}</p>}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate(-1)}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? "Salvando..." : "Salvar cliente"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
