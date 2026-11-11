import { useEffect, useState } from "react";
import { getReferenceImageUrl } from "../services/request";

interface ReferenceImagePreviewProps {
  imageId: number;
  alt: string;
  className?: string;
}

export default function ReferenceImagePreview({
  imageId,
  alt,
  className = "h-full w-full object-cover",
}: ReferenceImagePreviewProps) {
  const [imageUrl, setImageUrl] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl = "";

    getReferenceImageUrl(imageId)
      .then((url) => {
        objectUrl = url;
        if (active) {
          setImageUrl(url);
          setFailed(false);
        }
      })
      .catch(() => {
        if (active) {
          setFailed(true);
        }
      });

    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [imageId]);

  if (failed) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-surface-low px-2 text-center text-xs text-neutral-600">
        Imagem indisponível
      </div>
    );
  }

  if (!imageUrl) {
    return <div className="h-full w-full animate-pulse bg-surface-low" />;
  }

  return <img src={imageUrl} alt={alt} className={className} />;
}
