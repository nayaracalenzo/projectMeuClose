import { memo } from "react";

type Column<T> = {
  key: keyof T;
  label: string;
  align?: "left" | "right" | "center";
};

type CustomerRecordsTableProps<T extends Record<string, unknown>> = {
  columns: Column<T>[];
  rows: T[];
  emptyMessage?: string;
};

function CustomerRecordsTableComponent<T extends Record<string, unknown>>({
  columns,
  rows,
  emptyMessage = "Nenhum registro cadastrado.",
}: CustomerRecordsTableProps<T>) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-y-2">
        <thead className="bg-[#dbd1d1] rounded-t-md">
          <tr className="text-left">
            {columns.map((column) => (
              <th
                key={String(column.key)}
                className={`px-3 pt-2 text-sm font-semibold text-primary ${
                  column.align === "right"
                    ? "text-right"
                    : column.align === "center"
                      ? "text-center"
                      : "text-left"
                }`}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr className="bg-surface-lowest">
              <td
                colSpan={columns.length}
                className="px-3 py-6 text-center text-sm text-neutral-700"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr
                key={`row-${index}`}
                className="bg-surface-lowest transition-colors hover:bg-surface"
              >
                {columns.map((column) => (
                  <td
                    key={`cell-${index}-${String(column.key)}`}
                    className={`px-3 py-2 text-sm text-neutral-700 ${
                      column.align === "right"
                        ? "text-right"
                        : column.align === "center"
                          ? "text-center"
                          : "text-left"
                    }`}
                  >
                    {String(row[column.key] ?? "-")}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

const CustomerRecordsTable = memo(
  CustomerRecordsTableComponent,
) as typeof CustomerRecordsTableComponent;

export default CustomerRecordsTable;
