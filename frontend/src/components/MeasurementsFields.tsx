import { memo } from "react";

export type MeasurementOption = {
  value: string;
  label: string;
};

type MeasurementsFieldsProps = {
  contextKey: string | number;
  fieldClassName: string;
  measurements: Record<string, string>;
  measurementOptions: MeasurementOption[];
  onUpdateMeasurement: (field: string, value: string) => void;
  onCreateMeasurementRequest?: () => void;
  readOnly?: boolean;
};

function MeasurementsFieldsComponent({
  contextKey,
  fieldClassName,
  measurements,
  measurementOptions,
  onUpdateMeasurement,
  onCreateMeasurementRequest,
  readOnly = false,
}: MeasurementsFieldsProps) {
  return (
    <div className="mt-4 rounded border border-outline-variant/60 bg-white p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-primary">Medidas</p>
          <p className="text-xs text-neutral-600">
            Todas as medidas aparecem na tela e podem ser ajustadas rapidamente.
          </p>
        </div>

        {onCreateMeasurementRequest ? (
          <button
            type="button"
            onClick={onCreateMeasurementRequest}
            className="h-10 min-w-10 rounded border border-outline-variant/60 bg-white px-3 text-lg leading-none text-primary"
            aria-label="Cadastrar nova medida"
            title="Cadastrar nova medida"
          >
            +
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
        {measurementOptions.map((item) => (
          <div key={`${contextKey}-${item.value}`}>
            <label
              htmlFor={`measurement-${contextKey}-${item.value}`}
              className="mb-1 block whitespace-nowrap text-xs leading-tight text-primary"
            >
              {item.label} (cm)
            </label>
            <input
              id={`measurement-${contextKey}-${item.value}`}
              value={String(measurements[item.value] || "")}
              onChange={(event) => onUpdateMeasurement(item.value, event.target.value)}
              className={`${fieldClassName} h-8 px-2 text-xs`}
              inputMode="decimal"
              readOnly={readOnly}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

const MeasurementsFields = memo(MeasurementsFieldsComponent);

export default MeasurementsFields;
