import { CircularProgress } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "../components/Button";
import CustomerFormFields, {
  type CustomerFormValues,
} from "../components/CustomerFormFields";
import CustomerModal from "../components/CustomerModal";
import NoticeToast from "../components/NoticeToast";
import CustomerSalesModal from "../components/CustomerSalesModal";
import { getRequest, postRequest, updateRequest } from "../services/request";
import { getUserFacingApiErrorMessage } from "../utils/apiError";
import {
  formatBirthDateFromApi,
  maskBirthDate,
  toBirthDateApiValue,
} from "../utils/birthDate";
import { maskCep } from "../utils/maskCep";
import { maskCpfCnpj } from "../utils/maskCpfCnpj";
import { fetchAddressByZipCode } from "../utils/zipCodeLookup";

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

type NoticeState = {
  open: boolean;
  tone: "success" | "warning" | "error";
  title?: string;
  message: string;
};

type ConfirmationModalState =
  | { open: false; type: null; destination?: undefined }
  | { open: true; type: "deactivate"; destination?: undefined }
  | { open: true; type: "delete"; destination?: undefined }
  | { open: true; type: "leave"; destination: string };

const EMPTY_NOTICE: NoticeState = {
  open: false,
  tone: "warning",
  title: undefined,
  message: "",
};

const EMPTY_CONFIRMATION_MODAL: ConfirmationModalState = {
  open: false,
  type: null,
};

const onlyDigits = (value?: string | null) => (value || "").replace(/\D/g, "");

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const base = String(value).slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(base);
  if (!match) return "-";
  return `${match[3]}/${match[2]}/${match[1]}`;
};

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
  birthDate: formatBirthDateFromApi(clientData.birthDate),
  phone: formatPhoneMask(clientData.phone),
  zipCode: maskCep(clientData.zipCode || ""),
});

const toSharedFormValues = (
  form: Partial<ClientDetails>,
): CustomerFormValues => ({
  typeCustomer: (form.typeCustomer ||
    "INDIVIDUAL") as CustomerFormValues["typeCustomer"],
  document: String(form.document || ""),
  fullName: String(form.fullName || ""),
  birthDate: String(form.birthDate || ""),
  companyName: String(form.companyName || ""),
  tradeName: String(form.tradeName || ""),
  phone: String(form.phone || ""),
  email: String(form.email || ""),
  zipCode: String(form.zipCode || ""),
  street: String(form.street || ""),
  number: String(form.number || ""),
  complement: String(form.complement || ""),
  neighborhood: String(form.neighborhood || ""),
  city: String(form.city || ""),
  state: String(form.state || ""),
  professionId:
    form.professionId === null || form.professionId === undefined
      ? ""
      : String(form.professionId),
  comment: String(form.comment || ""),
});

const serializeEditableState = (form: Partial<ClientDetails>) =>
  JSON.stringify({
    ...toSharedFormValues(form),
    active: Boolean(form.active),
    blocked: Boolean(form.blocked),
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
      issues.push({
        key: "document",
        label: "CPF",
        message: "CPF é obrigatório.",
      });
    } else if (documentDigits.length !== 11) {
      issues.push({
        key: "document",
        label: "CPF",
        message: "CPF deve conter 11 digitos.",
      });
    }

    if (!fullName) {
      issues.push({
        key: "fullName",
        label: "Nome",
        message: "Nome completo é obrigatório para pessoa fisica.",
      });
    }
  }

  if (typeCustomer === "COMPANY") {
    if (!documentDigits) {
      issues.push({
        key: "document",
        label: "CNPJ",
        message: "CNPJ é obrigatório.",
      });
    } else if (documentDigits.length !== 14) {
      issues.push({
        key: "document",
        label: "CNPJ",
        message: "CNPJ deve conter 14 digitos.",
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

const getOptionalClientValidationIssues = (
  form: Partial<ClientDetails>,
): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const typeCustomer = form.typeCustomer;
  const documentDigits = onlyDigits(form.document);
  const fullName = String(form.fullName || "").trim();
  const companyName = String(form.companyName || "").trim();

  if (typeCustomer === "INDIVIDUAL") {
    if (documentDigits && documentDigits.length !== 11) {
      issues.push({
        key: "document",
        label: "CPF",
        message: "CPF deve conter 11 digitos.",
      });
    }

    if (!fullName) {
      issues.push({
        key: "fullName",
        label: "Nome",
        message: "Nome completo e obrigatorio para pessoa fisica.",
      });
    }
  }

  if (typeCustomer === "COMPANY") {
    if (documentDigits && documentDigits.length !== 14) {
      issues.push({
        key: "document",
        label: "CNPJ",
        message: "CNPJ deve conter 14 digitos.",
      });
    }

    if (!companyName) {
      issues.push({
        key: "companyName",
        label: "Razao social",
        message: "Razao social e obrigatoria para pessoa juridica.",
      });
    }
  }

  return issues;
};

void getClientValidationIssues;

export default function CustomerDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [client, setClient] = useState<ClientDetails | null>(null);
  const [saving, setSaving] = useState(false);
  const [zipLookupMessage, setZipLookupMessage] = useState("");
  const [professionModalOpen, setProfessionModalOpen] = useState(false);
  const [professionName, setProfessionName] = useState("");
  const [professionError, setProfessionError] = useState("");
  const [professionSaving, setProfessionSaving] = useState(false);
  const [form, setForm] = useState<Partial<ClientDetails>>({});
  const [professions, setProfessions] = useState<ProfessionOption[]>([]);
  const [isSalesModalOpen, setIsSalesModalOpen] = useState(false);
  const [notice, setNotice] = useState<NoticeState>(EMPTY_NOTICE);
  const [confirmationModal, setConfirmationModal] =
    useState<ConfirmationModalState>(EMPTY_CONFIRMATION_MODAL);

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

  const originalForm = useMemo(
    () => (client ? serializeEditableState(toEditableForm(client)) : ""),
    [client],
  );
  const currentForm = useMemo(() => serializeEditableState(form), [form]);
  const hasUnsavedChanges = Boolean(client) && originalForm !== currentForm;

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;

      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const setField = (field: keyof ClientDetails, value: unknown) => {
    setForm((prev) => ({ ...prev, [field]: value as never }));
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
        setZipLookupMessage("CEP não encontrado.");
        return;
      }

      setForm((prev) => ({
        ...prev,
        zipCode: maskCep(digits),
        street: address.street || prev.street || "",
        neighborhood: address.neighborhood || prev.neighborhood || "",
        complement: address.complement || prev.complement || "",
        city: address.city || prev.city || "",
        state: address.state || prev.state || "",
      }));
      setZipLookupMessage("Endereco preenchido automaticamente.");
    } catch {
      setZipLookupMessage("Nao foi possivel consultar o CEP.");
    }
  };

  const handleFieldChange = (key: string, value: unknown) => {
    if (key === "zipCode") {
      void handleZipCodeChange(String(value || ""));
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

    if (key === "birthDate") {
      setField("birthDate", maskBirthDate(String(value || "")));
      return;
    }

    if (key === "professionId") {
      const num = value === "" ? null : Number(value);
      setField("professionId", num);
      return;
    }

    if (key === "state") {
      setField(
        "state",
        String(value || "")
          .toUpperCase()
          .slice(0, 2),
      );
      return;
    }

    setField(key as keyof ClientDetails, value);
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
      setProfessionError("Informe o nome da profissão.");
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
      setField("professionId", Number(created.id));
      closeProfessionModal();
    } catch (err: unknown) {
      setProfessionError(
        getUserFacingApiErrorMessage(
          err,
          "Nao foi possivel cadastrar a profissão.",
        ),
      );
    } finally {
      setProfessionSaving(false);
    }
  };

  const handleActiveChange = (value: boolean) => {
    if (value) {
      setForm((prev) => ({
        ...prev,
        active: true,
      }));
      return;
    }

    setConfirmationModal({
      open: true,
      type: "deactivate",
    });
  };

  const handleDeleteRequest = () => {
    setConfirmationModal({
      open: true,
      type: "delete",
    });
  };

  const validationIssues = useMemo(
    () => getOptionalClientValidationIssues(form),
    [form],
  );

  const buildPayload = (overrides: Partial<ClientDetails> = {}) => ({
    typeCustomer: overrides.typeCustomer ?? form.typeCustomer,
    document: onlyDigits(String(overrides.document ?? form.document ?? "")),
    rg: null,
    fullName: overrides.fullName ?? form.fullName,
    birthDate: toBirthDateApiValue(
      String(overrides.birthDate ?? form.birthDate ?? ""),
    ),
    companyName: overrides.companyName ?? form.companyName,
    tradeName: overrides.tradeName ?? form.tradeName,
    phone: onlyDigits(String(overrides.phone ?? form.phone ?? "")),
    email: overrides.email ?? form.email,
    zipCode: onlyDigits(String(overrides.zipCode ?? form.zipCode ?? "")),
    street: overrides.street ?? form.street,
    number: overrides.number ?? form.number,
    complement: overrides.complement ?? form.complement,
    neighborhood: overrides.neighborhood ?? form.neighborhood,
    city: overrides.city ?? form.city,
    state:
      typeof (overrides.state ?? form.state) === "string"
        ? String(overrides.state ?? form.state ?? "")
            .toUpperCase()
            .slice(0, 2)
        : (overrides.state ?? form.state),
    active: overrides.active ?? form.active,
    blocked: overrides.blocked ?? form.blocked,
    professionId: overrides.professionId ?? form.professionId,
    comment: overrides.comment ?? form.comment,
  });

  const handleSave = async () => {
    if (!id) return true;

    if (validationIssues.length > 0) {
      setNotice({
        open: true,
        tone: "warning",
        title: "Campos obrigatórios",
        message: validationIssues.map((issue) => issue.message).join(" "),
      });
      return false;
    }

    try {
      setSaving(true);

      const updated = await updateRequest(`/clients/${id}`, buildPayload());
      setClient(updated as ClientDetails);
      setForm(toEditableForm(updated as ClientDetails));
      setNotice({
        open: true,
        tone: "success",
        title: "Cliente atualizado",
        message: "Cliente atualizado com sucesso.",
      });
      return true;
    } catch (err: unknown) {
      setNotice({
        open: true,
        tone: "error",
        title: "Nao foi possivel salvar",
        message: getUserFacingApiErrorMessage(
          err,
          "Nao foi possivel salvar as alteracoes.",
        ),
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSoftDelete = async () => {
    if (!id) return;

    try {
      setSaving(true);
      await updateRequest(
        `/clients/${id}`,
        buildPayload({ active: false, blocked: true }),
      );
      setNotice({
        open: true,
        tone: "success",
        title: "Cliente excluido",
        message:
          "O cliente foi removido da listagem e mantido no banco como excluido.",
      });
      navigate("/clientes");
    } catch (err: unknown) {
      setNotice({
        open: true,
        tone: "error",
        title: "Nao foi possivel excluir",
        message: getUserFacingApiErrorMessage(
          err,
          "Nao foi possivel excluir o cliente agora. Tente novamente.",
        ),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleLeavePage = async (destination: string) => {
    if (!hasUnsavedChanges) {
      navigate(destination);
      return;
    }

    setConfirmationModal({
      open: true,
      type: "leave",
      destination,
    });
  };

  const closeConfirmationModal = () => {
    setConfirmationModal(EMPTY_CONFIRMATION_MODAL);
  };

  const handleConfirmation = async () => {
    if (confirmationModal.type === "deactivate") {
      setForm((prev) => ({
        ...prev,
        active: false,
      }));
      closeConfirmationModal();
      return;
    }

    if (confirmationModal.type === "delete") {
      closeConfirmationModal();
      await handleSoftDelete();
      return;
    }

    if (confirmationModal.type === "leave" && confirmationModal.destination) {
      const destination = confirmationModal.destination;
      closeConfirmationModal();
      const saved = await handleSave();
      if (!saved) return;
      navigate(destination);
    }
  };

  const handleDiscardChanges = () => {
    if (confirmationModal.type !== "leave" || !confirmationModal.destination) {
      closeConfirmationModal();
      return;
    }

    const destination = confirmationModal.destination;
    closeConfirmationModal();
    navigate(destination);
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
        <h1 className="pt-8 pb-4 text-4xl font-semibold text-primary md:text-[2rem]">
          Detalhe do Cliente
        </h1>
        <p className="mb-4 text-neutral-700">
          {error || "Cliente não encontrado."}
        </p>
        <Button
          variant="secondary"
          size="md"
          onClick={() => navigate("/clientes")}
        >
          Voltar para clientes
        </Button>
      </div>
    );
  }

  const displayForm = toSharedFormValues(form);

  return (
    <div className="w-full min-h-full min-w-0 bg-white p-3 sm:p-5 md:bg-surface-low">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h1 className="pt-8 pb-4 text-4xl font-semibold text-primary md:text-[2rem]">
          Detalhe do Cliente
        </h1>
        <div className="hidden gap-2 md:flex">
          <Button
            variant="secondary"
            size="md"
            onClick={() => void handleLeavePage("/clientes")}
          >
            Voltar
          </Button>
          <Button
            variant="secondary"
            size="md"
            onClick={() => setIsSalesModalOpen(true)}
          >
            Vendas do Cliente
          </Button>
          <Button
            variant="secondary"
            size="md"
            onClick={() =>
              navigate(
                `/a-receber?search=${encodeURIComponent(
                  String(client.fullName || client.companyName || "Cliente").trim(),
                )}`,
              )
            }
          >
            A Receber
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={() => void handleSave()}
            disabled={saving || !hasUnsavedChanges}
          >
            {saving ? "Salvando..." : "Salvar"}
          </Button>
          <Button
            variant="danger"
            size="md"
            onClick={handleDeleteRequest}
            disabled={saving}
          >
            Excluir cliente
          </Button>
        </div>
      </div>
      <div className="bg-surface-lowest p-6 shadow-sm">
        <CustomerFormFields
          form={displayForm}
          professions={professions}
          onFieldChange={(field, value) => handleFieldChange(field, value)}
          onTypeCustomerChange={(value) => setField("typeCustomer", value)}
          zipCodeHelperMessage={zipLookupMessage}
          onCreateProfessionRequest={() => setProfessionModalOpen(true)}
          readOnly={false}
          showStatusFields
          active={Boolean(form.active)}
          onActiveChange={handleActiveChange}
        />

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-[#a59797] bg-[#f9f7f6] px-3 py-2">
            <p className="text-sm text-primary">Criado em</p>
            <p className="font-medium text-[#2a2526]">
              {formatDate(client.createdAt)}
            </p>
          </div>
          <div className="rounded-lg border border-[#a59797] bg-[#f9f7f6] px-3 py-2">
            <p className="text-sm text-primary">Atualizado em</p>
            <p className="font-medium text-[#2a2526]">
              {formatDate(client.updatedAt)}
            </p>
          </div>
        </div>
      </div>

      <CustomerSalesModal
        open={isSalesModalOpen}
        clientId={client.id}
        clientName={String(client.fullName || client.companyName || "Cliente")}
        onClose={() => setIsSalesModalOpen(false)}
      />

      <CustomerModal
        open={professionModalOpen}
        onClose={closeProfessionModal}
        title="Nova profissão"
        subtitle="Cadastre uma nova profissão sem sair do cliente."
      >
        <div className="mx-auto max-w-xl">
          {professionError ? (
            <div className="mb-4 rounded border border-[#c76767] bg-[#fdecec] px-3 py-2 text-sm text-[#7a1717]">
              {professionError}
            </div>
          ) : null}

          <form className="space-y-4" onSubmit={handleCreateProfession}>
            <div>
              <label
                className="mb-1 block text-sm text-primary"
                htmlFor="profession-name-edit"
              >
                Nome da profissão
              </label>
              <input
                id="profession-name-edit"
                value={professionName}
                onChange={(event) => setProfessionName(event.target.value)}
                className="h-10 w-full rounded-lg border border-[#a59797] bg-[#f9f7f6] px-3 text-[#2a2526] uppercase shadow-xs transition duration-200 focus:outline-none focus:ring-2 focus:ring-[#8a4d5dcf]"
                autoFocus
                required
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={closeProfessionModal}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={professionSaving}
              >
                {professionSaving ? "Salvando..." : "Salvar profissão"}
              </Button>
            </div>
          </form>
        </div>
      </CustomerModal>

      <CustomerModal
        open={confirmationModal.open}
        title={
          confirmationModal.type === "delete"
            ? "Excluir cliente"
            : confirmationModal.type === "deactivate"
              ? "Desativar cliente"
              : "Salvar alteracoes antes de sair?"
        }
        subtitle={
          confirmationModal.type === "deactivate"
            ? "A desativação impede novas compras para este cliente."
            : ""
        }
        onClose={closeConfirmationModal}
      >
        {confirmationModal.type === "delete" ? (
          <div className="space-y-5">
            <p className="text-sm text-neutral-700">
              Tem certeza que deseja excluir este cliente? Caso ele tenha
              débitos, estes também serão excluidos.
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="secondary"
                size="md"
                onClick={closeConfirmationModal}
              >
                Cancelar
              </Button>
              <Button
                variant="danger"
                size="md"
                onClick={() => void handleConfirmation()}
              >
                Confirmar exclusão
              </Button>
            </div>
          </div>
        ) : confirmationModal.type === "deactivate" ? (
          <div className="space-y-5">
            <p className="text-sm text-neutral-700">
              Confirme se deseja desativar este cliente. Ele não poderá realizar
              novas compras enquanto estiver inativo.
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="secondary"
                size="md"
                onClick={closeConfirmationModal}
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={() => void handleConfirmation()}
              >
                Confirmar desativação
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <p className="text-sm text-neutral-700">
              Se continuar, podemos salvar suas alteracoes antes de voltar para
              a listagem.
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="secondary"
                size="md"
                onClick={handleDiscardChanges}
              >
                Sair sem salvar
              </Button>
              <Button
                variant="secondary"
                size="md"
                onClick={closeConfirmationModal}
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={() => void handleConfirmation()}
              >
                Salvar e sair
              </Button>
            </div>
          </div>
        )}
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
