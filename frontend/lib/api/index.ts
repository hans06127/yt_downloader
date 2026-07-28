import axios from "axios";

const API_PATH = "/api";

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

export default api;
