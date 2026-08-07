import { CircularProgress } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "../components/Button";
import CustomerFormFields, {
  type CustomerFormValues,
} from "../components/CustomerFormFields";
import CustomerModal from "../components/CustomerModal";
import MeasurementsFields, {
  type MeasurementOption as MeasurementsFieldOption,
} from "../components/MeasurementsFields";
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
  measurements?: ClientMeasurement[];
  createdAt: string | null;
  updatedAt: string | null;
};

type ClientMeasurement = {
  measurementDefinitionId: number | null;
  key: string | null;
  label: string;
  value: number | null;
};

type MeasurementDefinition = {
  idMeasurementDefinition: number;
  key: string;
  label: string;
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

const toMeasurementValueMap = (measurements: ClientMeasurement[] = []) =>
  measurements.reduce<Record<string, string>>((acc, measurement) => {
    const key = String(measurement.key || "").trim();
    if (!key) return acc;

    acc[key] =
      measurement.value === null || measurement.value === undefined
        ? ""
        : String(measurement.value);
    return acc;
  }, {});

const toMeasurementOptions = (
  definitions: MeasurementDefinition[] = [],
): MeasurementsFieldOption[] =>
  definitions
    .map((definition) => {
      const key = String(definition.key || "").trim();
      const label = String(definition.label || "").trim();

      if (!key || !label) return null;

      return {
        value: key,
        label,
      };
    })
    .filter((item): item is MeasurementsFieldOption => Boolean(item));

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
  const [measurementDefinitions, setMeasurementDefinitions] = useState<MeasurementDefinition[]>([]);
  const [measurementValues, setMeasurementValues] = useState<Record<string, string>>({});
  const [measurementSaving, setMeasurementSaving] = useState(false);
  const [measurementModalOpen, setMeasurementModalOpen] = useState(false);
  const [measurementName, setMeasurementName] = useState("");
  const [measurementError, setMeasurementError] = useState("");
  const [notice, setNotice] = useState<NoticeState>(EMPTY_NOTICE);
  const [confirmationModal, setConfirmationModal] =
    useState<ConfirmationModalState>(EMPTY_CONFIRMATION_MODAL);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError("");
        const [clientData, professionsData, measurementDefinitionsData] = await Promise.all([
          getRequest(`/clients/${id}`),
          getRequest("/professions"),
          getRequest("/admin/measurement-definitions"),
        ]);
        setClient(clientData);
        setForm(toEditableForm(clientData));
        setMeasurementDefinitions(
          (Array.isArray(measurementDefinitionsData) ? measurementDefinitionsData : [])
            .map((item) => ({
              idMeasurementDefinition: Number(item?.idMeasurementDefinition || 0),
              key: String(item?.key || "").trim(),
              label: String(item?.label || "").trim(),
            }))
            .filter(
              (item) =>
                item.idMeasurementDefinition > 0 && Boolean(item.key) && Boolean(item.label),
            ),
        );
        setMeasurementValues(
          toMeasurementValueMap(
            Array.isArray(clientData.measurements) ? clientData.measurements : [],
          ),
        );
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
  const measurementOptions = useMemo(
    () => toMeasurementOptions(measurementDefinitions),
    [measurementDefinitions],
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

  const closeMeasurementModal = () => {
    setMeasurementModalOpen(false);
    setMeasurementName("");
    setMeasurementError("");
  };

  const handleCreateMeasurement = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    const normalizedName = measurementName.trim();

    if (!normalizedName) {
      setMeasurementError("Informe o nome da medida.");
      return;
    }

    try {
      setMeasurementSaving(true);
      setMeasurementError("");

      const created = (await postRequest("/admin/measurement-definitions", {
        label: normalizedName,
      })) as {
        idMeasurementDefinition?: number;
        key?: string | null;
        label?: string | null;
      };

      const key = String(created.key || "").trim();
      const label = String(created.label || normalizedName).trim();
      const measurementDefinitionId = Number(created.idMeasurementDefinition || 0);

      if (key && label && measurementDefinitionId) {
        setMeasurementDefinitions((prev) => [
          ...prev,
          {
            idMeasurementDefinition: measurementDefinitionId,
            key,
            label,
          },
        ]);
        setMeasurementValues((prev) => ({
          ...prev,
          [key]: prev[key] || "",
        }));
      }

      closeMeasurementModal();
      setNotice({
        open: true,
        tone: "success",
        title: "Medida cadastrada",
        message: "A nova medida foi adicionada com sucesso.",
      });
    } catch (err: unknown) {
      setMeasurementError(
        getUserFacingApiErrorMessage(
          err,
          "Nao foi possivel cadastrar a medida.",
        ),
      );
    } finally {
      setMeasurementSaving(false);
    }
  };

  const handleSaveMeasurements = async () => {
    if (!id) return;

    try {
      setMeasurementSaving(true);

      const updated = (await updateRequest(`/clients/${id}/measurements`, {
        measurements: measurementDefinitions.map((measurement) => ({
          measurementDefinitionId: measurement.idMeasurementDefinition,
          value: measurementValues[String(measurement.key || "").trim()] || null,
        })),
      })) as ClientDetails;

      setClient(updated);
      setMeasurementValues(
        toMeasurementValueMap(
          Array.isArray(updated.measurements) ? updated.measurements : [],
        ),
      );
      setNotice({
        open: true,
        tone: "success",
        title: "Medidas atualizadas",
        message: "As medidas da cliente foram salvas com sucesso.",
      });
    } catch (err: unknown) {
      setNotice({
        open: true,
        tone: "error",
        title: "Nao foi possivel salvar",
        message: getUserFacingApiErrorMessage(
          err,
          "Nao foi possivel salvar as medidas da cliente.",
        ),
      });
    } finally {
      setMeasurementSaving(false);
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

        <div className="mt-6 rounded-lg border border-[#a59797] bg-white p-4">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.08em] text-neutral-700">
                Medidas da cliente
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={() => void handleSaveMeasurements()}
                disabled={measurementSaving || !measurementOptions.length}
              >
                {measurementSaving ? "Salvando..." : "Salvar medidas"}
              </Button>
            </div>
          </div>

          <MeasurementsFields
            contextKey={`customer-${client.id}`}
            fieldClassName="h-10 w-full rounded border border-outline-variant/60 bg-white px-3 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-secondary/70"
            measurements={measurementValues}
            measurementOptions={measurementOptions}
            onCreateMeasurementRequest={() => setMeasurementModalOpen(true)}
            onUpdateMeasurement={(field, value) =>
              setMeasurementValues((prev) => ({
                ...prev,
                [field]: value,
              }))
            }
          />
        </div>

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
        open={measurementModalOpen}
        onClose={closeMeasurementModal}
        title="Nova medida"
        subtitle="Cadastre uma nova medida sem sair do cliente."
      >
        <div className="mx-auto max-w-xl">
          {measurementError ? (
            <div className="mb-4 rounded border border-[#c76767] bg-[#fdecec] px-3 py-2 text-sm text-[#7a1717]">
              {measurementError}
            </div>
          ) : null}

          <form className="space-y-4" onSubmit={handleCreateMeasurement}>
            <div>
              <label
                className="mb-1 block text-sm text-primary"
                htmlFor="measurement-name-create"
              >
                Nome da medida
              </label>
              <input
                id="measurement-name-create"
                value={measurementName}
                onChange={(event) => setMeasurementName(event.target.value)}
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
                onClick={closeMeasurementModal}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={measurementSaving}
              >
                {measurementSaving ? "Salvando..." : "Salvar medida"}
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
