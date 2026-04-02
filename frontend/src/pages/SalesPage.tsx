import { CircularProgress } from "@mui/material";
import { useState } from "react";
import { Link } from "react-router-dom";

export default function SalesPage() {
  const [loading, setLoading] = useState(false);
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
              <h1 className="font-semibold text-[#2f2e2e] text-3xl">Vendas</h1>
              <div className="font-semibold px-4 h-10 rounded-md bg-[#fd074a] text-white flex items-center">
              <Link to={"/venda"} >
                + Nova Venda/Orçamento
              </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
