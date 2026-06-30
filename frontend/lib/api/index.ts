import axios from "axios";

function resolveApiBaseUrl() {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (configuredBaseUrl) return configuredBaseUrl;

  if (typeof window !== "undefined") {
    const { hostname, port, protocol } = window.location;
    if ((hostname === "localhost" || hostname === "127.0.0.1") && port === "3001") {
      return `${protocol}//${hostname}:5000/api`;
    }
  }

  return "/api";
}

const api = axios.create({
  baseURL: resolveApiBaseUrl(),
  timeout: 30000,
});

export default api;
