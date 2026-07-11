import { jsPDF } from "jspdf";

export interface PrintableOrderItem {
  name: string;
  quantity: number;
  fabric: string;
  color: string;
  size: string;
  notes?: string;
}

export interface PrintableOrder {
  id: number;
  customer: string;
  kind: string;
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

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);

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

const drawTableHeader = (doc: jsPDF, startY: number) => {
  doc.setFillColor(246, 243, 241);
  doc.rect(12, startY, 273, 10, "F");
  doc.setDrawColor(210, 205, 203);
  doc.rect(12, startY, 273, 10);
  doc.line(38, startY, 38, startY + 10);
  doc.line(114, startY, 114, startY + 10);
  doc.line(174, startY, 174, startY + 10);
  doc.line(252, startY, 252, startY + 10);
  doc.setTextColor(43, 36, 37);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Data prova", 16, startY + 6.5);
  doc.text("Cliente", 42, startY + 6.5);
  doc.text("Roupa", 118, startY + 6.5);
  doc.text("Detalhes", 178, startY + 6.5);
  doc.text("Valor", 282, startY + 6.5, { align: "right" });
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
      const details = [
        `Qtd: ${item.quantity}`,
        `Tecido: ${item.fabric}`,
        `Cor: ${item.color}`,
        `Tamanho: ${item.size}`,
        item.notes ? `Detalhes: ${item.notes}` : null,
      ]
        .filter(Boolean)
        .join(" | ");

      const dateLabel = index === 0 ? formatDate(order.date) : "";
      const customerLabel = index === 0 ? order.customer : "";
      const detailsLines = doc.splitTextToSize(details, 72);
      const clothingLines = doc.splitTextToSize(item.name, 52);
      const customerLines = doc.splitTextToSize(customerLabel, 68);
      const dateLines = doc.splitTextToSize(dateLabel, 18);
      const baseHeight = Math.max(
        dateLines.length,
        customerLines.length,
        clothingLines.length,
        detailsLines.length,
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
      doc.line(38, currentY - 4, 38, currentY - 4 + rowHeight);
      doc.line(114, currentY - 4, 114, currentY - 4 + rowHeight);
      doc.line(174, currentY - 4, 174, currentY - 4 + rowHeight);
      doc.line(252, currentY - 4, 252, currentY - 4 + rowHeight);

      const textStartY = currentY + 1.5;

      doc.setTextColor(43, 36, 37);
      doc.setFont("helvetica", index === 0 ? "bold" : "normal");
      doc.setFontSize(9.5);
      doc.text(dateLines, 16, textStartY);

      doc.setFont("helvetica", "normal");
      doc.text(customerLines, 42, textStartY);
      doc.text(clothingLines, 118, textStartY);
      doc.text(detailsLines, 178, textStartY);

      if (index === 0) {
        doc.setFont("helvetica", "bold");
        doc.text(formatCurrency(order.total), 282, textStartY, { align: "right" });
      }

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

  const safeWeekLabel = weekLabel.replace(/[\\/:?\s]+/g, "-");
  doc.save(`pedidos-periodo-${safeWeekLabel}.pdf`);
};
