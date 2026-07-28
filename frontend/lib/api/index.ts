import axios from "axios";

const API_PATH = "/api";
const CLIENT_ID_KEY = "yt-downloader-client-id";

export function resolveClientId() {
  if (typeof window === "undefined") return null;
  const existing = window.localStorage.getItem(CLIENT_ID_KEY);
  if (existing) return existing;

  const generated =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(CLIENT_ID_KEY, generated);
  return generated;
}

function normalizeApiBaseUrl(value: string) {
  const normalized = value.trim().replace(/\/+$/, "");
  if (!normalized) return API_PATH;
  return normalized.endsWith(API_PATH) ? normalized : `${normalized}${API_PATH}`;
}

export function resolveApiBaseUrl() {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (configuredBaseUrl?.trim()) return normalizeApiBaseUrl(configuredBaseUrl);

  if (typeof window !== "undefined") {
    const { hostname, port, protocol } = window.location;
    if ((hostname === "localhost" || hostname === "127.0.0.1") && port === "3001") {
      return `${protocol}//${hostname}:5000${API_PATH}`;
    }
  }

  return API_PATH;
}

export function resolveApiUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${resolveApiBaseUrl()}${normalizedPath}`;
}

const api = axios.create({
  baseURL: resolveApiBaseUrl(),
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const clientId = resolveClientId();
  if (clientId) config.headers.set("X-Client-Id", clientId);
  return config;
});

export default api;
