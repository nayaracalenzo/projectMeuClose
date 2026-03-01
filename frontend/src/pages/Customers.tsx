import { useEffect, useState } from "react";
import Table from "../components/Table.tsx";
import { getRequest } from "../services/request.ts";
import type { ICustomer } from "../interfaces/ICustomer.ts";
import {
  CircularProgress,
  FormControl,
  MenuItem,
  Select,
} from "@mui/material";
import { formatDocument } from "../utils/formatDocument.ts";
import { formatContact } from "../utils/formatContact.ts";

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ativo");

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        setLoading(true);
        const data = await getRequest("/clients");
        console.log(data);
        const customer = data.map((customer: ICustomer) => ({
          id: Number(customer.id),
          "Nome do Cliente": customer.fullName ?? "",
          "CPF/CNPJ": formatDocument(customer.document) ,
          Contato:formatContact(customer.phone),
          Ativo: customer.active,
        }));
        setCustomers(customer);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchCustomers();
  }, []);

  const filteredCustomers = customers.filter((customer: any) => {
    const searchLower = search.toLowerCase();

    const matchSearch =
      customer["Nome do Cliente"].toLowerCase().includes(searchLower) ||
      customer["CPF/CNPJ"].toLowerCase().includes(searchLower);

    const matchStatus =
      statusFilter === "todos"
        ? true
        : statusFilter === "ativo"
          ? customer.Ativo === true
          : statusFilter === "inativo"
            ? customer.Ativo === false
            : customer.Bloqueado === "bloqueado";

    return matchSearch && matchStatus;
  });
  const catchIdFromTable = (e: number) => {
    if (selectedId === e) {
      setSelectedId(0);
    } else {
      setSelectedId(e);
      console.log(e);
    }
  };

  return (
    <>
      {loading ? (
        <div className="flex justify-center items-center w-full mt-50">
          <CircularProgress />
        </div>
      ) : (
        <div className="bg-white border border-[#fee9ef] rounded-xl p-5 w-full shadow-xl">
          <div className=" mb-5">
            <div className="flex justify-between gap-4 mb-5">
              <h1 className="font-semibold text-[#2f2e2e] text-3xl">
                Clientes
              </h1>
              <div className="flex gap-2">
                <button className="font-semibold px-4 h-10 rounded-md bg-[#fd074a] text-white ">
                  + Novo Cliente
                </button>
                <button
                  disabled={!selectedId}
                  className={`font-semibold px-4 h-10 rounded-md flex gap-2 items-center 
                  ${
                    selectedId
                      ? "text-[#fd074a] bg-white shadow-md border border-[#f8d4df]"
                      : "text-gray-400 bg-gray-100 cursor-not-allowed"
                  }`}
                >
                Mostrar Detalhes
                </button>
              </div>
            </div>
            <div className="flex flex-col md:flex-row gap-3 w-full">
              <input
                type="text"
                placeholder="Buscar por nome ou CPF/CNPJ..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 h-11 px-4 rounded-lg border border-[#f8d4df] 
                focus:outline-none focus:ring-2 focus:ring-[#fd074a]"
              />
              <FormControl size="medium">
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  sx={{
                    padding: 2,
                    height: 44,
                    borderRadius: 2,

                    "& .MuiOutlinedInput-notchedOutline": {
                      borderColor: "#f8d4df",
                    },
                  }}
                >
                  <MenuItem value="ativo">Clientes Ativos</MenuItem>
                  <MenuItem value="inativo">Clientes Inativos</MenuItem>
                  <MenuItem value="todos">Todos</MenuItem>
                </Select>
              </FormControl>
            </div>
          </div>
          <Table
            hideIdColumn
            values={filteredCustomers}
            catchIdFromTable={catchIdFromTable}
          />
        </div>
      )}
    </>
  );
}
