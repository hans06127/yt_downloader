import type { CookieStatus } from "@/lib/types";
import api from "./index";

export const getCookieStatus = () =>
  api.get<CookieStatus>("/cookie-status").then((r) => r.data);

export const uploadCookie = (file: File) => {
  const form = new FormData();
  form.append("file", file);
  return api.post<{ ok?: boolean; error?: string }>("/upload-cookie", form).then((r) => r.data);
};

export const deleteCookie = () =>
  api.post("/delete-cookie").then((r) => r.data);
