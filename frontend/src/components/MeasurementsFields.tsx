import { memo } from "react";
import { Trash2 } from "lucide-react";
import { MenuItem, Select } from "@mui/material";

export type MeasurementOption = {
  value: string;
  label: string;
};

type MeasurementsFieldsProps = {
  productId: number;
  fieldClassName: string;
  selectedMeasurements: string[];
  measurements: object;
  measurementOptions: MeasurementOption[];
  onAddMeasurementField: (productId: number, field: string) => void;
  onRemoveMeasurementField: (productId: number, field: string) => void;
  onUpdateMeasurement: (productId: number, field: string, value: string) => void;
};

function MeasurementsFieldsComponent({
  productId,
  fieldClassName,
  selectedMeasurements,
  measurements,
  measurementOptions,
  onAddMeasurementField,
  onRemoveMeasurementField,
  onUpdateMeasurement,
}: MeasurementsFieldsProps) {
  return (
    <div className="mt-4 rounded border border-outline-variant/60 bg-white p-3">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-primary">Medidas</p>
      </div>

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-5">
        <label
          htmlFor={`measurement-select-${productId}`}
          className="mb-1 text-sm text-primary text-nowrap"
        >
          Escolher medida
        </label>
        <Select
          id={`measurement-select-${productId}`}
          displayEmpty
          value=""
          onChange={(e) => {
            const field = String(e.target.value);
            if (field) onAddMeasurementField(productId, field);
          }}
          MenuProps={{
            disableScrollLock: true,
            PaperProps: {
              sx: {
                maxHeight: 180,
                "& .MuiMenuItem-root": {
                  minHeight: 30,
                  fontSize: "0.85rem",
                  py: 0.5,
                },
              },
            },
          }}
          sx={{
            width: "100%",
            maxWidth: 320,
            height: 40,
            backgroundColor: "white",
            color: "#1A1A1A",
            borderRadius: "4px",
            border: "1px solid #b9adb091",
            fontSize: "0.9rem",
            "& .MuiSelect-select": {
              py: "8px",
            },
          }}
        >
          <MenuItem value="">Selecione...</MenuItem>
          {measurementOptions.map((item) => (
            <MenuItem key={item.value} value={item.value}>
              {item.label}
            </MenuItem>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {selectedMeasurements.map((field) => {
          const label =
            measurementOptions.find((item) => item.value === field)?.label ||
            field;

          return (
            <div key={`${productId}-${field}`}>
              <div className="mb-1 flex items-center justify-between">
                <label
                  htmlFor={`${field}-${productId}`}
                  className="block text-sm text-primary"
                >
                  {label} (cm)
                </label>
                <button
                  type="button"
                  onClick={() => onRemoveMeasurementField(productId, field)}
                  className="text-neutral-700 hover:text-primary"
                  aria-label={`Remover medida ${label}`}
                  title={`Remover medida ${label}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <input
                id={`${field}-${productId}`}
                value={String((measurements as Record<string, unknown>)[field] || "")}
                onChange={(e) =>
                  onUpdateMeasurement(productId, field, e.target.value)
                }
                className={fieldClassName}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

const MeasurementsFields = memo(MeasurementsFieldsComponent);

export default MeasurementsFields;
