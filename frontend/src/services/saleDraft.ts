import { API } from "./request";
import { getStoredToken } from "../utils/auth";

export type SaleDraftResponse<TPayload = Record<string, unknown>> = {
  id: number;
  status: string;
  payload: TPayload;
  lastClientSavedAt: string | null;
  lastServerSavedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
} | null;

export async function getSaleDraftRequest<TPayload = Record<string, unknown>>() {
  const { data } = await API.get<SaleDraftResponse<TPayload>>("/sales/draft");
  return data;
}

export async function upsertSaleDraftRequest(
  body: {
    payload: Record<string, unknown>;
    lastClientSavedAt: string;
  },
) {
  const { data } = await API.put("/sales/draft", body);
  return data;
}

export async function deleteSaleDraftRequest() {
  const { data } = await API.delete("/sales/draft");
  return data;
}

export function persistSaleDraftKeepalive(body: {
  payload: Record<string, unknown>;
  lastClientSavedAt: string;
}) {
  const token = getStoredToken();

  if (!token) {
    return Promise.resolve(false);
  }

  return fetch(`${API.defaults.baseURL || ""}/sales/draft`, {
    method: "PUT",
    keepalive: true,
    headers: {
      "Content-Type": "application/json",
      Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
    .then((response) => response.ok)
    .catch(() => false);
}
