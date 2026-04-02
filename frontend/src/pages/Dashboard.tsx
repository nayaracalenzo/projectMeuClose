import { useEffect, useState } from "react";
import { getRequest } from "../services/request";

interface BirthdayClient {
  id: number;
  fullName: string;
  birthDate: string;
}

const upcomingFittings = [
  {
    customer: "Isabella Almeida",
    description: "Vestido de Seda - 1a Prova",
    time: "14:30",
    done: false,
  },
  {
    customer: "Mariana Costa",
    description: "Terno em Linho - Prova Final",
    time: "16:00",
    done: false,
  },
  {
    customer: "Camila Ferraz",
    description: "Blazer Estruturado - Entrega",
    time: "09:00",
    done: true,
  },
];

export default function Dashboard() {
  const [clients, setClients] = useState<BirthdayClient[]>([]);

  useEffect(() => {
    async function fetchBirthdays() {
      const data = await getRequest("/clients/birthdays/month");
      setClients(data);
    }

    fetchBirthdays();
  }, []);

  const monthName = new Date().toLocaleString("pt-BR", {
    month: "long",
  });

  const formattedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);

  return (
    <div className="rounded-2xl p-5">
      <h1 className="mb-5 font-editorial text-4xl font-extralight leading-none tracking-tight text-primary">
        Olá, Lia bem-vinda de volta!
      </h1>
      <div className="mb-8 grid min-h-0 w-full grid-rows-[12rem_minmax(0,1fr)] gap-4">
        <div className="grid h-30 w-full gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="flex h-full flex-col gap-3 bg-surface-low p-5 shadow-md">
            <h2 className="text-[1.1rem] font-semibold text-neutral-700">
              Pedidos Ativos
            </h2>
            <p className="font-editorial text-[2.5rem] leading-none text-primary">
              12
            </p>
          </div>

          <div className="flex h-full flex-col gap-3 bg-surface-low p-5 shadow-md">
            <h2 className=" text-[1.1rem] font-semibold text-neutral-700">
              Contas a Pagar
            </h2>
            <p className="font-editorial text-[2rem] leading-none text-primary">
              R$ 3.120
            </p>
          </div>
          <div className="flex h-full flex-col gap-3 border border-[#fee9ef] bg-surface-low p-5 shadow-md">
            <h2 className="mb-4 text-[1.1rem] font-semibold text-neutral-700">
              Aniversariantes de {formattedMonth}
            </h2>

            {clients.length === 0 ? (
              <p className="text-xs font-medium text-neutral-700">
                Nenhum aniversariante este mes.
              </p>
            ) : (
              <div className="flex flex-col gap-3 overflow-hidden">
                {clients.slice(0, 1).map((client) => {
                  const day = new Date(client.birthDate).getDate();

                  return (
                    <div
                      key={client.id}
                      className="flex items-center justify-between rounded-lg bg-background/90 px-4 py-3"
                    >
                      <span className="text-xs font-medium text-neutral-700">
                        {client.fullName}
                      </span>

                      <span className="text-xs font-medium text-neutral-700">
                        {day}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex h-full flex-col justify-between bg-surface-low p-5 shadow-md">
            <h1 className="mb-3 text-lg font-semibold text-gray-700">
              Ações Rápidas
            </h1>
            <div className="grid gap-2">
              <button className=" rounded bg-primary px-5 py-2 text-center text-white shadow transition">
                + Nova Venda
              </button>
              <button className="bg-white hover:cursor-pointer rounded border hover:bg-[#cf1736] hover:border-[#cf1736] border-gray-300 px-5 py-2 text-center text-black shadow transition">
                Novo Cliente
              </button>
            </div>
          </div>
        </div>

        <div className="min-h-0 bg-surface-low p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-editorial text-4xl font-semibold text-primary">
              Proximas Provas
            </h2>
            <button className="text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-700">
              Ver todas
            </button>
          </div>

          <div className="space-y-2">
            {upcomingFittings.map((fitting) => (
              <article
                key={`${fitting.customer}-${fitting.time}`}
                className={`flex items-start justify-between bg-surface-lowest px-4 py-4 ${
                  fitting.done ? "opacity-60" : ""
                }`}
              >
                <div className="border-l-2 border-secondary pl-4">
                  <h3 className="text-base font-semibold text-primary">
                    {fitting.customer}
                  </h3>
                  <p className="mt-1 text-sm text-neutral-700">
                    {fitting.description}
                  </p>
                </div>
                <div className="text-right">
                  <span className="inline-block bg-surface px-2 py-1 text-xs text-primary">
                    {fitting.time}
                  </span>
                  {fitting.done && (
                    <p className="mt-1 text-[10px] font-medium uppercase text-neutral-700">
                      Concluido
                    </p>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
