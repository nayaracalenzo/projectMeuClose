import { Bell, Home, Plus, Users } from "lucide-react";

const metrics = [
  { label: "Pedidos Ativos", value: "12" },
  { label: "Receita (Mes)", value: "R$ 15.4k" },
  { label: "Provas Pendentes", value: "5" },
  { label: "Concluidos", value: "28" },
];

const fittings = [
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

export default function NewDashboard() {
  return (
    <div className="mx-auto min-h-screen w-full max-w-3xl bg-background pb-28 antialiased">
      <header className="sticky top-0 z-10 flex items-center justify-between bg-background/90 px-6 pb-6 pt-12 backdrop-blur-md">
        <div>
          <h1 className="font-editorial text-5xl font-semibold leading-none tracking-tight text-primary">
            Bom dia, Carolina
          </h1>
          <p className="mt-2 text-xs font-medium uppercase tracking-[0.2em] text-neutral-700">
            Visao Geral • 24 Out
          </p>
        </div>
        <button
          type="button"
          className="relative flex h-11 w-11 items-center justify-center rounded-xs bg-surface-low text-primary transition-colors hover:bg-surface"
          aria-label="Notificacoes"
        >
          <Bell size={18} strokeWidth={2} />
          <span className="absolute right-2 top-2 h-2 w-2 bg-secondary" />
        </button>
      </header>

      <main className="space-y-12 px-6 py-8">
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {metrics.map((metric) => (
            <article
              key={metric.label}
              className="flex h-28 flex-col justify-between bg-surface-low p-5"
            >
              <p className="text-xs font-medium text-neutral-700">
                {metric.label}
              </p>
              <p className="font-editorial text-5xl leading-none text-primary">
                {metric.value}
              </p>
            </article>
          ))}
        </section>

        <section>
          <div className="mb-6 flex items-end justify-between">
            <h2 className="font-editorial text-4xl font-semibold text-primary">
              Proximas Provas
            </h2>
            <button
              type="button"
              className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-700 transition-colors hover:text-primary"
            >
              Ver todas
            </button>
          </div>
          <div className="space-y-4">
            {fittings.map((fitting) => (
              <article
                key={`${fitting.customer}-${fitting.time}`}
                className={`flex items-start justify-between bg-surface-lowest px-5 py-4 shadow-(--ambient-shadow) ${
                  fitting.done ? "opacity-60" : ""
                }`}
              >
                <div className="border-l-2 border-secondary pl-4">
                  <h3 className="text-xl font-medium text-primary">
                    {fitting.customer}
                  </h3>
                  <p className="mt-1 text-lg text-neutral-700">
                    {fitting.description}
                  </p>
                </div>
                <div className="text-right">
                  <span className="inline-flex bg-surface px-3 py-1 text-sm font-medium text-primary">
                    {fitting.time}
                  </span>
                  {fitting.done && (
                    <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-700">
                      Concluido
                    </p>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-outline-variant/30 bg-surface-lowest px-4 pb-6 pt-3">
        <ul className="mx-auto flex w-full max-w-3xl items-center justify-around">
          <li>
            <button
              type="button"
              className="flex flex-col items-center gap-1 text-primary"
            >
              <Home size={20} />
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em]">
                Inicio
              </span>
            </button>
          </li>
          <li>
            <button
              type="button"
              className="flex flex-col items-center gap-1 text-neutral-700 transition-colors hover:text-primary"
            >
              <Users size={20} />
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em]">
                Clientes
              </span>
            </button>
          </li>
          <li>
            <button
              type="button"
              className="flex flex-col items-center gap-1 text-neutral-700 transition-colors hover:text-primary"
            >
              <Plus size={20} />
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em]">
                Novo
              </span>
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}
