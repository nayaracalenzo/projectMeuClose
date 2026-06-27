import { useNavigate } from "react-router-dom";
import { Printer } from "lucide-react";
import { Button } from "../components/Button";

export default function Orders() {
  const navigate = useNavigate();

  return (
    <div className="w-full min-h-full min-w-0 bg-white p-3 sm:p-5 md:bg-surface-low">
      <div className="mb-5 flex justify-center gap-4 md:justify-between">
        <div>
          <h1 className="pb-2 pt-12 text-6xl font-semibold text-primary md:text-4xl">
            Pedidos
          </h1>
          <p className="text-sm text-neutral-700">
            Listagem em integração com dados reais.
          </p>
        </div>
        <div className="hidden gap-2 md:flex">
          <Button
            variant="primary"
            size="md"
            className="px-5"
            onClick={() => navigate("/nova-venda")}
          >
            + Novo Pedido
          </Button>
          <Button variant="secondary" size="md" className="px-5" disabled>
            <span className="flex items-center gap-2">
              <Printer size={16} />
              PDF da semana
            </span>
          </Button>
        </div>
      </div>

      <div className="mb-4 flex md:hidden">
        <Button variant="secondary" size="md" className="w-full" disabled>
          <span className="flex items-center justify-center gap-2">
            <Printer size={16} />
            Gerar PDF da semana
          </span>
        </Button>
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="mt-2 w-full border-separate border-spacing-y-2">
          <thead>
            <tr className="text-left">
              <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">Pedido</th>
              <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">Cliente</th>
              <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">Tipo</th>
              <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">Data</th>
              <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">Status</th>
              <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary text-right">
                Valor
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td
                colSpan={6}
                className="bg-surface-lowest px-4 py-6 text-center text-sm text-neutral-700"
              >
                Nenhum pedido cadastrado
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
