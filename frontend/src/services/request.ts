import axios from "axios";
import { getStoredToken } from "../utils/auth";

export const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000",
});

type MutationLoadingListener = () => void;

const MUTATION_IN_PROGRESS_MESSAGE = "Aguarde a operacao atual terminar.";

let activeMutationCount = 0;
const mutationLoadingListeners = new Set<MutationLoadingListener>();

function emitMutationLoadingChange() {
  mutationLoadingListeners.forEach((listener) => listener());
}

function beginMutation() {
  activeMutationCount += 1;
  emitMutationLoadingChange();
}

function finishMutation() {
  activeMutationCount = Math.max(0, activeMutationCount - 1);
  emitMutationLoadingChange();
}

function createDuplicateMutationError() {
  const error = new Error(MUTATION_IN_PROGRESS_MESSAGE);
  error.name = "MutationInProgressError";
  return error;
}

async function runMutationRequest<T>(callback: () => Promise<T>) {
  if (activeMutationCount > 0) {
    throw createDuplicateMutationError();
  }

  beginMutation();

  try {
    return await callback();
  } finally {
    finishMutation();
  }
}

API.interceptors.request.use(
  (config) => {
    const normalizedToken = getStoredToken();

    if (normalizedToken) {
      config.headers.Authorization = normalizedToken.startsWith("Bearer ")
        ? normalizedToken
        : `Bearer ${normalizedToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

export const subscribeToMutationLoading = (listener: MutationLoadingListener) => {
  mutationLoadingListeners.add(listener);

  return () => {
    mutationLoadingListeners.delete(listener);
  };
};

export const getMutationLoadingSnapshot = () => activeMutationCount > 0;

export const getRequest = async (url: string) => {
  const { data } = await API.get(url);
  return data;
};

export const postRequest = async (url: string, body: object) => {
  return runMutationRequest(async () => {
    const { data } = await API.post(url, body);
    return data;
  });
};

export interface UploadedReferenceImage {
  id: number;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}

const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      const separatorIndex = dataUrl.indexOf(",");

      if (separatorIndex < 0) {
        reject(new Error("Não foi possível converter a imagem para Base64."));
        return;
      }

      resolve(dataUrl.slice(separatorIndex + 1));
    };
    reader.onerror = () =>
      reject(new Error("Não foi possível ler a imagem selecionada."));
    reader.readAsDataURL(file);
  });

export const uploadReferenceImageRequest = async (file: File) => {
  return runMutationRequest(async () => {
    const imageBase64 = await fileToBase64(file);
    const { data } = await API.post<UploadedReferenceImage>(
      "/sales/reference-images",
      {
        imageBase64,
        mimeType: file.type,
        originalName: file.name,
      },
    );
    return data;
  });
};

export const getReferenceImageUrl = async (imageId: number) => {
  const { data } = await API.get<Blob>(`/sales/reference-images/${imageId}`, {
    responseType: "blob",
  });
  return URL.createObjectURL(data);
};

export const updateRequest = async (url: string, body: object) => {
  return runMutationRequest(async () => {
    const { data } = await API.put(url, body);
    return data;
  });
};

export const deleteRequest = async (url: string, body: object) => {
  return runMutationRequest(async () => {
    const { data } = await API.delete(url, { data: body });
    return data;
  });
};

export const getUserInfo = async () => {
  const { data } = await API.get("signin/auth/user", {
    withCredentials: true,
  });

  return data;
};
