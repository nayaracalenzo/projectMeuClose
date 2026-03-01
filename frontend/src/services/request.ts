import axios from "axios";

export const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000",
});

API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      // Remove any surrounding quotes just in case
      config.headers.Authorization = token.replace(/^"|"$/g, "");
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export const getRequest = async (url: string) => {
  const { data } = await API.get(url);

  return data;
};

export const postRequest = async (url: string, body: object) => {
  await API.post(url, body);
  return body;
};

export const updateRequest = async (url: string, body: object) => {
  await API.put(url, body);
  return body;
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

