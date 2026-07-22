import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/Button";
import CustomerFormFields, {
  type CustomerFormValues,
} from "../components/CustomerFormFields";
import CustomerModal from "../components/CustomerModal";
import NoticeToast from "../components/NoticeToast";
import { getRequest, postRequest } from "../services/request";
import { getUserFacingApiErrorMessage } from "../utils/apiError";
import { maskPhone } from "../utils/maskPhone";
import { maskCpfCnpj } from "../utils/maskCpfCnpj";
import { maskCep } from "../utils/maskCep";
import { fetchAddressByZipCode } from "../utils/zipCodeLookup";

type ProfessionOption = {
  id: number;
  name: string;
};

type ValidationIssue = {
  key: "document" | "phone" | "fullName" | "companyName";
  label: string;
  message: string;
};

type NoticeState = {
  open: boolean;
  tone: "success" | "warning" | "error";
  title?: string;
  message: string;
};

type NewCustomerForm = CustomerFormValues;

const EMPTY_NOTICE: NoticeState = {
  open: false,
  tone: "warning",
  title: undefined,
  message: "",
};

const onlyDigits = (value: string) => value.replace(/\D/g, "");

const getCustomerValidationIssues = (
  form: NewCustomerForm,
): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const documentDigits = onlyDigits(form.document);

  if (form.typeCustomer === "INDIVIDUAL") {
    if (documentDigits && documentDigits.length !== 11) {
      issues.push({
        key: "document",
        label: "CPF",
        message: "CPF deve conter 11 digitos.",
      });
    }

    if (!form.fullName.trim()) {
      issues.push({
        key: "fullName",
        label: "Nome",
        message: "Nome completo e obrigatorio para pessoa fisica.",
      });
    }
  }

  if (form.typeCustomer === "COMPANY") {
    if (documentDigits && documentDigits.length !== 14) {
      issues.push({
        key: "document",
        label: "CNPJ",
        message: "CNPJ deve conter 14 digitos.",
      });
    }

    if (!form.companyName.trim()) {
      issues.push({
        key: "companyName",
        label: "Razao social",
        message: "Razao social e obrigatoria para pessoa juridica.",
      });
    }
  }

  return issues;
};

export default function NewCustomer() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [zipLookupMessage, setZipLookupMessage] = useState("");
  const [professionModalOpen, setProfessionModalOpen] = useState(false);
  const [professionName, setProfessionName] = useState("");
  const [professionError, setProfessionError] = useState("");
  const [professionSaving, setProfessionSaving] = useState(false);
  const [professions, setProfessions] = useState<ProfessionOption[]>([]);
  const [notice, setNotice] = useState<NoticeState>(EMPTY_NOTICE);
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
    void loadProfessions();
  }, []);

  const loadProfessions = async () => {
    try {
      const data = await getRequest("/professions");
      setProfessions(data);
    } catch {
      setProfessions([]);
    }
  };

  const setField = (field: keyof NewCustomerForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleZipCodeChange = async (value: string) => {
    const digits = onlyDigits(value).slice(0, 8);
    setField("zipCode", maskCep(digits));
    setZipLookupMessage("");

    if (digits.length !== 8) return;

    try {
      setZipLookupMessage("Buscando endereco pelo CEP...");
      const address = await fetchAddressByZipCode(digits);
      if (!address) {
        setZipLookupMessage("CEP nao encontrado.");
        return;
      }

      setForm((prev) => ({
        ...prev,
        zipCode: maskCep(digits),
        street: address.street || prev.street,
        neighborhood: address.neighborhood || prev.neighborhood,
        complement: address.complement || prev.complement,
        city: address.city || prev.city,
        state: address.state || prev.state,
      }));
      setZipLookupMessage("Endereco preenchido automaticamente.");
    } catch {
      setZipLookupMessage("Nao foi possivel consultar o CEP.");
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
    if (field === "zipCode") {
      void handleZipCodeChange(value);
      return;
    }
    if (field === "state") {
      setField("state", value.toUpperCase().slice(0, 2));
      return;
    }
    setField(field, value);
  };

  const closeProfessionModal = () => {
    setProfessionModalOpen(false);
    setProfessionName("");
    setProfessionError("");
    setProfessionSaving(false);
  };

  const handleCreateProfession = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    const normalizedName = professionName.trim().replace(/\s+/g, " ");

    if (!normalizedName) {
      setProfessionError("Informe o nome da profissao.");
      return;
    }

    try {
      setProfessionSaving(true);
      setProfessionError("");

      const created = (await postRequest("/professions", {
        name: normalizedName,
      })) as ProfessionOption;

      setProfessions((prev) =>
        [...prev, created].sort((left, right) =>
          left.name.localeCompare(right.name, "pt-BR"),
        ),
      );
      setField("professionId", String(created.id));
      closeProfessionModal();
    } catch (error: unknown) {
      setProfessionError(
        getUserFacingApiErrorMessage(
          error,
          "Nao foi possivel cadastrar a profissao.",
        ),
      );
    } finally {
      setProfessionSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationIssues = getCustomerValidationIssues(form);
    if (validationIssues.length > 0) {
      setNotice({
        open: true,
        tone: "warning",
        title: "Campos obrigatorios",
        message: validationIssues.map((issue) => issue.message).join(" "),
      });
      return;
    }

    try {
      setSaving(true);

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
      setNotice({
        open: true,
        tone: "error",
        title: "Nao foi possivel salvar",
        message: getUserFacingApiErrorMessage(
          error,
          "Nao foi possivel salvar o cliente.",
        ),
      });
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
          <CustomerFormFields
            form={form}
            professions={professions}
            onFieldChange={handleFieldChange}
            onTypeCustomerChange={(value) => setField("typeCustomer", value)}
            zipCodeHelperMessage={zipLookupMessage}
            onCreateProfessionRequest={() => setProfessionModalOpen(true)}
          />

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

      <CustomerModal
        open={professionModalOpen}
        onClose={closeProfessionModal}
        title="Nova profissao"
        subtitle="Cadastre uma profissao para continuar o atendimento."
      >
        <form onSubmit={handleCreateProfession} className="space-y-4">
          <input
            value={professionName}
            onChange={(event) => setProfessionName(event.target.value)}
            placeholder="Nome da profissao"
            className="h-11 w-full rounded-lg border border-[#a59797] bg-[#f9f7f6] px-3 text-sm text-[#2a2526] outline-none focus:ring-2 focus:ring-[#8a4d5dcf]"
          />
          {professionError ? (
            <p className="text-sm text-[#8f1515]">{professionError}</p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={closeProfessionModal}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={professionSaving}>
              {professionSaving ? "Salvando..." : "Salvar profissao"}
            </Button>
          </div>
        </form>
      </CustomerModal>

      <NoticeToast
        open={notice.open}
        tone={notice.tone}
        title={notice.title}
        message={notice.message}
        onClose={() => setNotice(EMPTY_NOTICE)}
      />
    </div>
  );
}
