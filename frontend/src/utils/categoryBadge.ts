export const getCategoryBadgeClassName = (category?: string) => {
  const normalized = String(category || "").trim().toUpperCase();

  if (normalized === "VENDA" || normalized === "REC. VENDA") {
    return "bg-[#E8F6EC] text-[#1F6A3A]";
  }

  if (normalized === "RECEBIMENTO") {
    return "bg-[#E7F7F8] text-[#16646A]";
  }

  if (normalized === "PAGAMENTO") {
    return "bg-[#FDECEC] text-[#9F1D1D]";
  }

  if (
    normalized === "TRANSFERENCIA" ||
    normalized === "TRANSFERENCIAS ENTRE CAIXA E BANCO"
  ) {
    return "bg-[#E8F1FF] text-[#1E4FA3]";
  }

  return "bg-surface text-neutral-700";
};
