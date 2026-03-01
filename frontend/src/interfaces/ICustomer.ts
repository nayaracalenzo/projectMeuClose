export interface ICustomer {
  id: number;
  typeCustomer: "INDIVIDUAL" | "COMPANY";
  document: string;
  fullName: string | null;
  companyName: string | null;
  phone: string;
  email: string | null;
  city: string | null;
  state: string | null;
  active: boolean;
  blocked: boolean;
}
