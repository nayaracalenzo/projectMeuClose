import { jsPDF } from "jspdf";

export interface PrintableOrderItem {
  name: string;
  quantity: number;
  fabric: string;
  color: string;
  size: string;
  seamstress?: string;
  notes?: string;
  measurements?: string;
}

export interface PrintableOrder {
  id: number;
  customer: string;
  kind: string;
  productionType: string;
  date: string;
  status: string;
  total: number;
  items: PrintableOrderItem[];
}

interface WeeklyPdfParams {
  orders: PrintableOrder[];
  logoUrl?: string;
  weekLabel: string;
}

const formatDate = (value: string) => {
  const raw = String(value || "").trim();
  if (!raw) return "-";

  const normalized = raw.includes("T") ? raw : `${raw}T00:00:00`;
  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    return raw;
  }

  return new Intl.DateTimeFormat("pt-BR").format(date);
};

const loadImageAsDataUrl = async (imageUrl: string) => {
  const response = await fetch(imageUrl);
  const blob = await response.blob();

  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Falha ao carregar a logo para o PDF."));
    reader.readAsDataURL(blob);
  });
};

const TYPE_COLUMN_END_X = 50;
const CUSTOMER_COLUMN_END_X = 136;
const SEAMSTRESS_COLUMN_END_X = 180;
const TABLE_END_X = 285;
const CUSTOMER_TEXT_X = TYPE_COLUMN_END_X + 4.8;
const CUSTOMER_TEXT_WIDTH = CUSTOMER_COLUMN_END_X - CUSTOMER_TEXT_X - 4;
const SEAMSTRESS_TEXT_X = CUSTOMER_COLUMN_END_X + 4.8;
const SEAMSTRESS_TEXT_WIDTH = SEAMSTRESS_COLUMN_END_X - SEAMSTRESS_TEXT_X - 4;
const DESCRIPTION_TEXT_X = SEAMSTRESS_COLUMN_END_X + 4.8;
const DESCRIPTION_TEXT_WIDTH = TABLE_END_X - DESCRIPTION_TEXT_X - 6;

const drawSingleLineWithAutoFontSize = (
  doc: jsPDF,
  value: string,
  x: number,
  y: number,
  maxWidth: number,
  preferredFontSize = 9.5,
  minFontSize = 7,
) => {
  const normalized = String(value || "").trim() || "-";
  let fontSize = preferredFontSize;

  doc.setFontSize(fontSize);

  while (fontSize > minFontSize && doc.getTextWidth(normalized) > maxWidth) {
    fontSize -= 0.2;
    doc.setFontSize(fontSize);
  }

  doc.text(normalized, x, y);
  doc.setFontSize(preferredFontSize);
};

const drawTableHeader = (doc: jsPDF, startY: number) => {
  doc.setFillColor(246, 243, 241);
  doc.rect(12, startY, 273, 10, "F");
  doc.setDrawColor(210, 205, 203);
  doc.rect(12, startY, 273, 10);
  doc.line(TYPE_COLUMN_END_X, startY, TYPE_COLUMN_END_X, startY + 10);
  doc.line(CUSTOMER_COLUMN_END_X, startY, CUSTOMER_COLUMN_END_X, startY + 10);
  doc.line(SEAMSTRESS_COLUMN_END_X, startY, SEAMSTRESS_COLUMN_END_X, startY + 10);
  doc.setTextColor(43, 36, 37);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Tipo / prova", 16, startY + 6.5);
  doc.text("Cliente", TYPE_COLUMN_END_X + 4, startY + 6.5);
  doc.text("Costureira", CUSTOMER_COLUMN_END_X + 4, startY + 6.5);
  doc.text("Descricao", SEAMSTRESS_COLUMN_END_X + 4, startY + 6.5);
};

const drawPageHeader = (
  doc: jsPDF,
  logoDataUrl: string | null,
  weekLabel: string,
  totalOrders: number,
  totalItems: number,
) => {
  if (logoDataUrl) {
    doc.addImage(logoDataUrl, "PNG", 14, 10, 18, 22);
  }
  doc.setTextColor(22, 19, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(21);
  doc.text("Meu Close", logoDataUrl ? 38 : 14, 19);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.text("Pedidos por periodo", logoDataUrl ? 38 : 14, 26);
  doc.setFontSize(9.5);
  doc.text(`Periodo da prova: ${weekLabel}`, logoDataUrl ? 38 : 14, 32);
  doc.text("Impressao em A4 horizontal", logoDataUrl ? 38 : 14, 37);

  doc.setDrawColor(210, 205, 203);
  doc.line(12, 44, 285, 44);

  doc.setTextColor(102, 87, 88);
  doc.setFontSize(9);
  doc.text("Pedidos", 14, 52);
  doc.text("Pecas", 56, 52);

  doc.setTextColor(43, 36, 37);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(String(totalOrders), 14, 59);
  doc.text(String(totalItems), 56, 59);
};

export const downloadWeeklyOrdersPdf = async ({
  orders,
  logoUrl,
  weekLabel,
}: WeeklyPdfParams) => {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const logoDataUrl = logoUrl ? await loadImageAsDataUrl(logoUrl) : null;
  const totalItems = orders.reduce(
    (acc, order) => acc + order.items.reduce((itemsAcc, item) => itemsAcc + item.quantity, 0),
    0,
  );

  drawPageHeader(doc, logoDataUrl, weekLabel, orders.length, totalItems);
  drawTableHeader(doc, 66);

  let currentY = 79;

  orders.forEach((order) => {
    order.items.forEach((item, index) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.2);

      const details = [
        `Qtd: ${item.quantity}`,
        `Tecido: ${item.fabric}`,
        `Cor: ${item.color}`,
        `Tamanho: ${item.size}`,
        item.notes ? `Detalhes: ${item.notes}` : null,
        item.measurements ? `Medidas: ${item.measurements}` : null,
      ]
        .filter(Boolean)
        .join(" | ");

      const productionTypeLabel = index === 0 ? order.productionType : "";
      const dateLabel = index === 0 ? formatDate(order.date) : "";
      const customerLabel = index === 0 ? order.customer : "";
      const seamstressLabel = item.seamstress || "-";
      const mergedDescription = [item.name, details].filter(Boolean).join(" | ");
      const mergedDescriptionLines = doc.splitTextToSize(
        mergedDescription,
        DESCRIPTION_TEXT_WIDTH,
      );
      const seamstressLines = doc.splitTextToSize(seamstressLabel, SEAMSTRESS_TEXT_WIDTH);
      const customerLines = customerLabel
        ? doc.splitTextToSize(customerLabel, CUSTOMER_TEXT_WIDTH)
        : [];
      const typeLines = productionTypeLabel ? [productionTypeLabel] : [];
      const dateLines = dateLabel ? [dateLabel] : [];
      const baseHeight = Math.max(
        typeLines.length + dateLines.length,
        customerLines.length,
        seamstressLines.length,
        mergedDescriptionLines.length,
        1,
      );
      const rowHeight = Math.max(14, baseHeight * 5.2);

      if (currentY + rowHeight > 192) {
        doc.addPage();
        drawPageHeader(doc, logoDataUrl, weekLabel, orders.length, totalItems);
        drawTableHeader(doc, 66);
        currentY = 79;
      }

      doc.setDrawColor(227, 218, 214);
      doc.rect(12, currentY - 4, 273, rowHeight);
      doc.line(TYPE_COLUMN_END_X, currentY - 4, TYPE_COLUMN_END_X, currentY - 4 + rowHeight);
      doc.line(CUSTOMER_COLUMN_END_X, currentY - 4, CUSTOMER_COLUMN_END_X, currentY - 4 + rowHeight);
      doc.line(SEAMSTRESS_COLUMN_END_X, currentY - 4, SEAMSTRESS_COLUMN_END_X, currentY - 4 + rowHeight);

      const textStartY = currentY + 2.5;

      doc.setTextColor(43, 36, 37);
      doc.setFont("helvetica", index === 0 ? "bold" : "normal");
      if (typeLines.length) {
        drawSingleLineWithAutoFontSize(
          doc,
          typeLines[0],
          16.8,
          textStartY,
          TYPE_COLUMN_END_X - 18,
          9.2,
          6.4,
        );
      }
      if (dateLines.length) {
        doc.text(dateLines, 16.8, textStartY + (typeLines.length ? 5.4 : 0));
      }

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.2);
      if (customerLines.length) {
        doc.text(customerLines, CUSTOMER_TEXT_X, textStartY);
      }
      doc.text(seamstressLines, SEAMSTRESS_TEXT_X, textStartY);
      doc.text(mergedDescriptionLines, DESCRIPTION_TEXT_X, textStartY);
      doc.setFontSize(9.5);

      currentY += rowHeight + 2;
    });
  });

  const totalPages = doc.getNumberOfPages();

  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(230, 224, 221);
    doc.line(12, 200, 285, 200);
    doc.setTextColor(120, 110, 109);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text("MeuClose | Relatorio de pedidos por periodo", 12, 205);
    doc.text(`Pagina ${page} de ${totalPages}`, 285, 205, { align: "right" });
  }

  const safeWeekLabel = weekLabel.replace(/[\\/:?\s]+/g, "-").toLowerCase();
  doc.save(`pedidos-periodo-${safeWeekLabel}.pdf`);
};
