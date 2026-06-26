import { useEffect } from "react";
import { AlertTriangle, CheckCircle2, CircleX, X } from "lucide-react";

type NoticeTone = "success" | "warning" | "error";

interface NoticeToastProps {
  open: boolean;
  tone: NoticeTone;
  title?: string;
  message: string;
  onClose: () => void;
  autoHideMs?: number;
}

const toneStyles: Record<NoticeTone, string> = {
  success:
    "border-[#74a47a] bg-[#edf8ee] text-[#1e4d2b] shadow-[0_18px_40px_rgba(30,77,43,0.18)]",
  warning:
    "border-[#c6a33a] bg-[#fff8df] text-[#6d5600] shadow-[0_18px_40px_rgba(109,86,0,0.18)]",
  error:
    "border-[#c76767] bg-[#fdecec] text-[#7a1717] shadow-[0_18px_40px_rgba(122,23,23,0.18)]",
};

const toneIcons = {
  success: CheckCircle2,
  warning: AlertTriangle,
  error: CircleX,
};

export default function NoticeToast({
  open,
  tone,
  title,
  message,
  onClose,
  autoHideMs = 5000,
}: NoticeToastProps) {
  useEffect(() => {
    if (!open) return;

    const timeoutId = window.setTimeout(() => {
      onClose();
    }, autoHideMs);

    return () => window.clearTimeout(timeoutId);
  }, [autoHideMs, onClose, open]);

  if (!open) return null;

  const Icon = toneIcons[tone];

  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] justify-end">
      <div
        role="alert"
        aria-live="polite"
        className={`pointer-events-auto w-full rounded-xl border px-4 py-3 backdrop-blur-sm ${toneStyles[tone]}`}
      >
        <div className="flex items-start gap-3">
          <Icon size={20} className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            {title && <p className="text-sm font-semibold">{title}</p>}
            <p className="text-sm leading-5">{message}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar aviso"
            className="shrink-0 rounded-md border border-black/10 bg-white/35 p-1 text-current transition hover:bg-white/55"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
