import axios from "axios";
import { getStoredToken } from "../utils/auth";

const MUTATION_BLOCK_MESSAGE = "Aguarde a operacao atual terminar.";
const MUTATION_ERROR_NAME = "MutationInProgressError";

let activeMutationCount = 0;
const mutationListeners = new Set<() => void>();

function emitMutationLoadingChange() {
  mutationListeners.forEach((listener) => listener());
}

function beginMutation() {
  activeMutationCount += 1;
  emitMutationLoadingChange();
}

function endMutation() {
  activeMutationCount = Math.max(0, activeMutationCount - 1);
  emitMutationLoadingChange();
}

function createMutationInProgressError() {
  const error = new Error(MUTATION_BLOCK_MESSAGE);
  error.name = MUTATION_ERROR_NAME;
  return error;
}

async function runGuardedMutation<T>(executor: () => Promise<T>) {
  if (activeMutationCount > 0) {
    throw createMutationInProgressError();
  }

  beginMutation();

  try {
    return await executor();
  } finally {
    endMutation();
  }
}

export const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000",
});

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

export const getRequest = async (url: string) => {
  const { data } = await API.get(url);
  return data;
};

export const subscribeToMutationLoading = (listener: () => void) => {
  mutationListeners.add(listener);

  return () => {
    mutationListeners.delete(listener);
  };
};

export const getMutationLoadingSnapshot = () => activeMutationCount > 0;

export const postRequest = async (url: string, body: object) => {
  return runGuardedMutation(async () => {
    const { data } = await API.post(url, body);
    return data;
  });
};

export const updateRequest = async (url: string, body: object) => {
  return runGuardedMutation(async () => {
    const { data } = await API.put(url, body);
    return data;
  });
};

export const deleteRequest = async (url: string, body: object) => {
  return runGuardedMutation(async () => {
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
