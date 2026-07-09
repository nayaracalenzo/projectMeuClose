import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/Button";
import CustomerFormFields, { type CustomerFormValues } from "../components/CustomerFormFields";
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

type NewCustomerForm = CustomerFormValues;

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

  const setField = (field: keyof NewCustomerForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleZipCodeChange = async (value: string) => {
    const digits = onlyDigits(value).slice(0, 8);
    setField("zipCode", maskCep(digits));

    if (digits.length !== 8) return;

    try {
      const address = await fetchAddressByZipCode(digits);
      if (!address) return;

      setForm((prev) => ({
        ...prev,
        zipCode: maskCep(digits),
        street: address.street || prev.street,
        neighborhood: address.neighborhood || prev.neighborhood,
        complement: address.complement || prev.complement,
        city: address.city || prev.city,
        state: address.state || prev.state,
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
      setMessage(getUserFacingApiErrorMessage(error, "Não foi possível salvar o cliente."));
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
          />

          {message && <p className="text-sm text-neutral-700">{message}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
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
