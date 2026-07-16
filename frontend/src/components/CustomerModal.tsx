import { memo, type ReactNode } from "react";
import { X } from "lucide-react";

type CustomerModalProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  size?: "sm" | "md" | "lg";
};

const modalWidthClassName = {
  sm: "max-w-xl",
  md: "max-w-3xl",
  lg: "max-w-5xl",
};

function CustomerModalComponent({
  open,
  title,
  subtitle,
  onClose,
  children,
  size = "lg",
}: CustomerModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className={`max-h-[90vh] w-full overflow-hidden rounded bg-white shadow-(--ambient-shadow) ${modalWidthClassName[size]}`}
      >
        <div className="flex items-start justify-between  bg-outline-variant/20  px-5 py-4">
          <div>
            <h3 className="text-lg font-medium text-primary">{title}</h3>
            {subtitle ? (
              <p className="text-sm text-neutral-700 mt-1">{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal"
            className="rounded  p-2 text-primary hover:bg-surface"
          >
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[calc(90vh-84px)] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

const CustomerModal = memo(CustomerModalComponent);

export default CustomerModal;
