export type ZipCodeAddress = {
  street: string;
  neighborhood: string;
  complement: string;
  city: string;
  state: string;
};

export async function fetchAddressByZipCode(zipCodeDigits: string): Promise<ZipCodeAddress | null> {
  const response = await fetch(`https://viacep.com.br/ws/${zipCodeDigits}/json/`);
  const data = await response.json();

  if (data.erro) {
    return null;
  }

  return {
    street: data.logradouro || "",
    neighborhood: data.bairro || "",
    complement: data.complemento || "",
    city: data.localidade || "",
    state: data.uf || "",
  };
}
