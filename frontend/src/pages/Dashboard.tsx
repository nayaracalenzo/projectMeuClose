import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/Button";
import { getRequest } from "../services/request";

interface BirthdayClient {
  id: number;
  fullName: string;
  birthDate: string;
  source: "customer" | "employee";
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
  const navigate = useNavigate();

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
  const monthlySalesSummary = "R$ 0,00";
  const getBirthDay = (birthDate?: string) => {
    const base = String(birthDate || "").slice(0, 10);
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(base);
    if (!match) return "-";
    return String(Number(match[3]));
  };

  return (
    <div className="rounded-2xl p-5">
      <h1 className="mb-5 font-editorial text-4xl font-extralight leading-none tracking-tight text-primary">
        Olá, Lia. Bem-vinda de volta!
      </h1>
      <div className="mb-8 grid min-h-0 w-full grid-rows-[12rem_minmax(0,1fr)] gap-4">
        <div className="grid h-30 w-full gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="flex h-full flex-col gap-3 bg-surface-low p-5 shadow-md">
            <h2 className="text-[1.1rem] font-semibold text-neutral-700">
              Pedidos Pendentes
            </h2>
            <p className="font-editorial text-[2.5rem] leading-none text-primary">2</p>
          </div>

          <div className="flex h-full flex-col gap-3 bg-surface-low p-5 shadow-md">
            <h2 className="text-[1.1rem] font-semibold text-neutral-700">
              Contas a Pagar
            </h2>
            <p className="font-editorial text-[2rem] leading-none text-primary">
              R$ 3.120
            </p>
          </div>

          <div className="flex h-full flex-col gap-3 bg-surface-low p-5 shadow-md">
            <h2 className="text-[1.1rem] font-semibold text-neutral-700">
              Vendas de {formattedMonth}
            </h2>
            <p className="font-editorial text-[2.5rem] leading-none text-primary">
              {monthlySalesSummary}
            </p>
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-500">
              Resumo mensal
            </p>
          </div>

          <div className="flex h-full flex-col justify-between bg-surface-low p-5 shadow-md">
            <h1 className="mb-3 text-lg font-semibold text-gray-700">Ações Rápidas</h1>
            <div className="grid gap-2">
              <Button
                variant="primary"
                size="md"
                className="px-5"
                onClick={() => navigate("/nova-venda")}
              >
                + Nova Venda
              </Button>
              <button className="rounded border border-gray-300 bg-white px-5 py-2 text-center text-black shadow transition hover:cursor-pointer">
                Novo Cliente
              </button>
            </div>
          </div>
        </div>

        <div className="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.85fr)]">
          <div className="min-h-0 bg-surface-low p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-editorial text-4xl font-semibold text-primary">
                Próximas Provas
              </h2>
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
                        Concluído
                      </p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>

          <aside className="min-h-0 border border-[#fee9ef] bg-surface-low p-5 shadow-md">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="font-editorial text-3xl font-semibold text-primary">
                Aniversariantes de {formattedMonth}
              </h2>
              <span className="rounded-full bg-background px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-600">
                {clients.length}
              </span>
            </div>

            {clients.length === 0 ? (
              <p className="text-sm font-medium text-neutral-700">
                Nenhum aniversariante este mês.
              </p>
            ) : (
              <div className="flex max-h-[26rem] flex-col gap-3 overflow-auto pr-1">
                {clients.map((client) => {
                  const day = getBirthDay(client.birthDate);

                  return (
                    <div
                      key={`${client.source}-${client.id}`}
                      className="flex items-center justify-between rounded-lg bg-background/90 px-4 py-3"
                    >
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-neutral-800">
                          {client.fullName}
                        </span>
                        <span className="text-[10px] uppercase tracking-[0.12em] text-neutral-500">
                          {client.source === "customer" ? "Cliente" : "Colaborador"}
                        </span>
                      </div>

                      <span className="font-editorial text-2xl leading-none text-primary">
                        {day}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
