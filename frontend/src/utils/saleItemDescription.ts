type SaleItemDescriptionFields = {
  description?: string | null;
  measurementsSummary?: string | null;
  details?: string | null;
};

export function formatSaleItemDescription(item: SaleItemDescriptionFields) {
  return [
    item.description,
    item.measurementsSummary ? `Medidas: ${item.measurementsSummary}` : null,
    item.details ? `Detalhes: ${item.details}` : null,
  ]
    .filter(Boolean)
    .join(" | ");
}
