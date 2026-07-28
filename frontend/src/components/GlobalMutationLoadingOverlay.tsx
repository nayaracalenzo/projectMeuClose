import { CircularProgress } from "@mui/material";

type GlobalMutationLoadingOverlayProps = {
  open: boolean;
};

export default function GlobalMutationLoadingOverlay({
  open,
}: GlobalMutationLoadingOverlayProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#f4f1ef]/70 backdrop-blur-[2px]">
      <CircularProgress size={34} />
    </div>
  );
}
