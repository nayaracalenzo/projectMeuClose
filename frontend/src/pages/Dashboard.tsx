import { useEffect, useState } from "react";
import { getRequest } from "../services/request";

export default function Dashboard() {
  
  interface BirthdayClient {
    id: number;
    fullName: string;
    birthDate: string;
  }
   const [clients, setClients] = useState<BirthdayClient[]>([]);

   useEffect(() => {
     async function fetchBirthdays() {
       const data = await getRequest("/clients/birthdays/month");
       console.log(data)
       setClients(data);
     }

     fetchBirthdays();
   }, []);

     const monthName = new Date().toLocaleString("pt-BR", {
       month: "long",
     });

     const formattedMonth =
       monthName.charAt(0).toUpperCase() + monthName.slice(1);

  return (
    <div className="p-5 rounded-2xl ">
      <h1 className="font-semibold text-xl mb-5">
        Olá, Lia bem-vinda de volta!
      </h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="flex gap-5 justify-between col-span-3">
          <div className="bg-white p-6 rounded-xl shadow flex-1">
            <h2 className="text-lg font-semibold text-gray-700">
              Contas a Receber
            </h2>
            <p className="text-2xl font-bold text-green-600 mt-2">
              R$ 8.450,00
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow flex-1">
            <h2 className="text-lg font-semibold text-gray-700">
              Contas a Pagar
            </h2>
            <p className="text-2xl font-bold text-red-600 mt-2">R$ 3.120,00</p>
          </div>
          <div className="bg-white border border-[#fee9ef] rounded-xl p-5 shadow-md w-full max-w-md">
            {/* Título */}
            <h2 className="text-xl font-semibold text-[#2f2e2e] mb-4">
              🎉 Aniversariantes de {formattedMonth}
            </h2>

            {clients.length === 0 ? (
              <p className="text-gray-500">Nenhum aniversariante este mês.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {clients.map((client) => {
                  const day = new Date(client.birthDate).getDate();

                  return (
                    <div
                      key={client.id}
                      className="flex justify-between items-center 
                           bg-[#fff6f9] px-4 py-3 rounded-lg"
                    >
                      <span className="font-medium text-[#2f2e2e]">
                        {client.fullName}
                      </span>

                      <span className="text-[#fd074a] font-bold text-lg">
                        {day}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow">
          <h1 className="text-lg font-semibold text-gray-700 mb-3">
            Ações Rápidas
          </h1>
          <div className="grid gap-2">
            <button className="bg-[#fd074a] text-white text-start rounded shadow py-2 px-5 transition w-full ">
              + Nova Venda
            </button>
            <button className="border border-[#fd074a] text-black text-start rounded shadow py-2 px-5 transition w-full">
              Novo Cliente
            </button>
          </div>
        </div>
      </div>

      {/* Pedidos em aberto */}
      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Últimos Pedidos</h2>

        <table className="w-full text-left">
          <thead>
            <tr className="border-b text-gray-500 text-sm">
              <th className="py-2">Pedido</th>
              <th>Cliente</th>
              <th>Status</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b">
              <td className="py-2">1023</td>
              <td>Maria Silva</td>
              <td className="text-yellow-600 font-medium">Em aberto</td>
              <td>R$ 450,00</td>
            </tr>

            <tr className="border-b">
              <td className="py-2">1024</td>
              <td>João Santos</td>
              <td className="text-yellow-600 font-medium">Em aberto</td>
              <td>R$ 780,00</td>
            </tr>

            <tr>
              <td className="py-2">1025</td>
              <td>Ana Costa</td>
              <td className="text-yellow-600 font-medium">Em aberto</td>
              <td>R$ 1.200,00</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
