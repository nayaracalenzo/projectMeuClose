import { CircularProgress } from "@mui/material";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/Button";

export default function SalesPage() {
  const [loading] = useState(false);
  const navigate = useNavigate();
  const [selectedId] = useState<number | null>(null);
  return (
    <>
      {loading ? (
        <div className="flex justify-center items-center w-full mt-50">
          <CircularProgress />
        </div>
      ) : (
        <div className="w-full min-w-0 bg-white md:bg-surface-low p-3 sm:p-5">
          <div>
            <div className="mb-5 flex md:justify-between justify-center gap-4">
              <h1 className="pt-12 pb-6 text-6xl md:text-4xl font-semibold text-primary">
                Vendas
              </h1>
              <div className="hidden md:flex gap-2">
                <Button
                  variant="primary"
                  size="md"
                  className="px-5"
                  onClick={() => navigate("/nova-venda")}
                >
                  + Nova Venda
                </Button>
                <Button
                  variant="secondary"
                  disabled={!selectedId}
                  size="md"
                  className="px-5"
                  onClick={() => selectedId && navigate(`/venda/${selectedId}`)}
                >
                  Mostrar Detalhes
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
