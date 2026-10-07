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

const LABEL_COLUMN_END_X = 35;
const TABLE_END_X = 285;
const CUSTOMER_TEXT_X = LABEL_COLUMN_END_X + 3;
const CUSTOMER_TEXT_WIDTH = TABLE_END_X - CUSTOMER_TEXT_X - 4;
const DESCRIPTION_TEXT_X = LABEL_COLUMN_END_X + 3;
const DESCRIPTION_TEXT_WIDTH = TABLE_END_X - DESCRIPTION_TEXT_X - 6;
const PDF_RADIUS = 1.8;
const TYPE_TEXT_X = 15;
const TYPE_TEXT_WIDTH = LABEL_COLUMN_END_X - TYPE_TEXT_X - 3;

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

const drawCustomerRow = (
  doc: jsPDF,
  startY: number,
  label: string,
  value: string,
  valueLines: string[],
  fillColor: [number, number, number],
) => {
  const rowHeight = Math.max(7, valueLines.length * 4.5 + 2.5);
  doc.setFillColor(...fillColor);
  doc.roundedRect(12, startY, 273, rowHeight, PDF_RADIUS, PDF_RADIUS, "F");
  doc.setDrawColor(185, 173, 176);
  doc.roundedRect(12, startY, 273, rowHeight, PDF_RADIUS, PDF_RADIUS);
  doc.setFillColor(...fillColor);
  doc.rect(12, startY + rowHeight - PDF_RADIUS, 273, PDF_RADIUS, "F");
  doc.setDrawColor(185, 173, 176);
  doc.line(12, startY + rowHeight, 285, startY + rowHeight);
  doc.line(12, startY + rowHeight - PDF_RADIUS, 12, startY + rowHeight);
  doc.line(285, startY + rowHeight - PDF_RADIUS, 285, startY + rowHeight);
  doc.line(LABEL_COLUMN_END_X, startY, LABEL_COLUMN_END_X, startY + rowHeight);
  doc.setTextColor(20, 20, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.2);
  doc.text(label, 15, startY + 5.2);
  doc.setFont("helvetica", "normal");
  doc.text(valueLines.length ? valueLines : [value || "-"], CUSTOMER_TEXT_X + 1, startY + 5.2);
  return rowHeight;
};

const parseMeasurementCells = (value?: string) => {
  const normalized = String(value || "").trim();

  if (!normalized) {
    return [];
  }

  return normalized
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.replace(/:\s*/g, " ").trim());
};

const drawMeasurementsRows = (doc: jsPDF, startY: number, measurements: string[]) => {
  const chunks: string[][] = [];
  const availableWidth = TABLE_END_X - LABEL_COLUMN_END_X;
  const measurementWidths = measurements.map((measurement) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.2);
    return doc.getTextWidth(measurement) + 10;
  });
  let currentChunk: string[] = [];
  let currentChunkWidth = 0;

  measurements.forEach((measurement, index) => {
    const measurementWidth = measurementWidths[index];

    if (
      currentChunk.length &&
      currentChunkWidth + measurementWidth > availableWidth
    ) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentChunkWidth = 0;
    }

    currentChunk.push(measurement);
    currentChunkWidth += measurementWidth;
  });

  if (currentChunk.length) {
    chunks.push(currentChunk);
  }

  if (!chunks.length) {
    chunks.push([]);
  }

  let currentY = startY;

  chunks.forEach((chunk, chunkIndex) => {
    const rowHeight = 7;
    doc.setFillColor(242, 231, 233);
    doc.rect(12, currentY, 273, rowHeight, "F");
    doc.setDrawColor(185, 173, 176);
    doc.rect(12, currentY, 273, rowHeight);
    doc.line(LABEL_COLUMN_END_X, currentY, LABEL_COLUMN_END_X, currentY + rowHeight);
    doc.setTextColor(20, 20, 20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.2);
    if (chunkIndex === 0) {
      doc.text("Medidas", 15, currentY + 4.8);
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.2);
    const desiredWidths = chunk.map((measurement) => doc.getTextWidth(measurement) + 10);
    const remainingWidth = Math.max(
      0,
      availableWidth - desiredWidths.reduce((sum, width) => sum + width, 0),
    );
    const cellWidths = desiredWidths.map(
      (width) => width + remainingWidth / Math.max(1, desiredWidths.length),
    );
    let cellX = LABEL_COLUMN_END_X;

    chunk.forEach((measurement, index) => {
      const cellWidth = cellWidths[index];
      const x = cellX;
      doc.line(x, currentY, x, currentY + rowHeight);
      doc.setFont("helvetica", "normal");
      doc.text(measurement, x + cellWidth / 2, currentY + 4.8, {
        align: "center",
      });
      cellX += cellWidth;
    });

    currentY += rowHeight;
  });

  return currentY - startY;
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
  doc.setFontSize(9.5);
  doc.text(`Periodo da prova: ${weekLabel}`, logoDataUrl ? 38 : 14, 28);

  const summaryStartX = 220;
  const summaryGap = 38;
  doc.setTextColor(102, 87, 88);
  doc.setFontSize(8.5);
  doc.text("Pedidos", summaryStartX, 15, { align: "center" });
  doc.text("Pecas", summaryStartX + summaryGap, 15, { align: "center" });
  doc.setTextColor(43, 36, 37);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(String(totalOrders), summaryStartX, 24, { align: "center" });
  doc.text(String(totalItems), summaryStartX + summaryGap, 24, { align: "center" });

  doc.setDrawColor(210, 205, 203);
  doc.line(10, 36, 285, 36);
};

interface PrintableCustomerGroup {
  customer: string;
  measurements: string;
  items: Array<{ order: PrintableOrder; item: PrintableOrderItem }>;
}

const groupOrdersByCustomer = (orders: PrintableOrder[]) => {
  const groups = new Map<string, PrintableCustomerGroup>();

  orders.forEach((order) => {
    const customer = String(order.customer || "Sem cliente").trim() || "Sem cliente";
    const key = customer.toLocaleLowerCase("pt-BR");
    const existing = groups.get(key) || {
      customer,
      measurements: "",
      items: [],
    };

    order.items.forEach((item) => {
      if (!existing.measurements && item.measurements) {
        existing.measurements = item.measurements;
      }
      existing.items.push({ order, item });
    });

    groups.set(key, existing);
  });

  return Array.from(groups.values());
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
  let currentY = 40;
  const customerGroups = groupOrdersByCustomer(orders);

  customerGroups.forEach((group) => {
    const customerLines = doc.splitTextToSize(group.customer, CUSTOMER_TEXT_WIDTH);
    const measurements = parseMeasurementCells(group.measurements);
    const measurementRowsHeight = measurements.length
      ? Math.ceil(measurements.length / 4) * 7
      : 0;
    const groupHeaderHeight = 7 + measurementRowsHeight;

    if (currentY + groupHeaderHeight > 192 && currentY > 40) {
      doc.addPage();
      drawPageHeader(doc, logoDataUrl, weekLabel, orders.length, totalItems);
      currentY = 40;
    }

    currentY += drawCustomerRow(
      doc,
      currentY,
      "Cliente",
      group.customer,
      customerLines,
      [198, 198, 198],
    );
    if (measurements.length) {
      currentY += drawMeasurementsRows(doc, currentY, measurements);
    }

    group.items.forEach(({ order, item }, index) => {
      const details = [
        `Qtd: ${item.quantity}`,
        `Tecido: ${item.fabric}`,
        `Cor: ${item.color}`,
        `Tamanho: ${item.size}`,
        item.notes ? `Detalhes: ${item.notes}` : null,
      ]
        .filter(Boolean)
        .join(" | ");

      const productionTypeLabel = order.productionType;
      const mergedDescription = [item.name, details].filter(Boolean).join(" | ");
      const mergedDescriptionLines = doc.splitTextToSize(
        mergedDescription,
        DESCRIPTION_TEXT_WIDTH,
      );
      const typeLines = productionTypeLabel ? [productionTypeLabel] : [];
      const dateLines = [formatDate(order.date)];
      const typeHeight = typeLines.length * 4.5 + dateLines.length * 3.8 + 4;
      const descriptionHeight = Math.max(2, mergedDescriptionLines.length) * 4 + 4;
      const rowHeight = Math.max(8, typeHeight, descriptionHeight);

      if (currentY + rowHeight > 192) {
        doc.addPage();
        drawPageHeader(doc, logoDataUrl, weekLabel, orders.length, totalItems);
        currentY = 40;
      }

      doc.setFillColor(index % 2 === 0 ? 252 : 248, index % 2 === 0 ? 248 : 244, index % 2 === 0 ? 249 : 246);
      doc.rect(12, currentY, 273, rowHeight, "F");
      doc.setDrawColor(185, 173, 176);
      doc.rect(12, currentY, 273, rowHeight);
      doc.line(LABEL_COLUMN_END_X, currentY, LABEL_COLUMN_END_X, currentY + rowHeight);
      doc.setTextColor(20, 20, 20);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.2);
      typeLines.forEach((line, lineIndex) => {
        drawSingleLineWithAutoFontSize(
          doc,
          line,
          TYPE_TEXT_X,
          currentY + 4.8 + lineIndex * 4.3,
          TYPE_TEXT_WIDTH,
          8.2,
          6.4,
        );
      });
      dateLines.forEach((line, lineIndex) => {
        drawSingleLineWithAutoFontSize(
          doc,
          line,
          TYPE_TEXT_X,
          currentY + 4.8 + typeLines.length * 4.3 + lineIndex * 4.3,
          TYPE_TEXT_WIDTH,
          8.2,
          6.4,
        );
      });
      doc.setFont("helvetica", "normal");
      doc.text(mergedDescriptionLines, DESCRIPTION_TEXT_X, currentY + 5);
      doc.setFontSize(9.5);

      currentY += rowHeight;
    });

    currentY += 2;
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
