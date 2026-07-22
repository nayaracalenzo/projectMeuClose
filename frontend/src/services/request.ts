import axios from "axios";
import { getStoredToken } from "../utils/auth";

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

export const postRequest = async (url: string, body: object) => {
  const { data } = await API.post(url, body);
  return data;
};

export const updateRequest = async (url: string, body: object) => {
  const { data } = await API.put(url, body);
  return data;
};

export const deleteRequest = async (url: string, body: object) => {
  const { data } = await API.delete(url, { data: body });
  return data;
};

export const getUserInfo = async () => {
  const { data } = await API.get("signin/auth/user", {
    withCredentials: true,
  });

  return data;
};
