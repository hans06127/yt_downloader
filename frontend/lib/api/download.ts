import type { FetchInfoResult, JobStatus, StartDownloadPayload, StreamMessage } from "@/lib/types";
import api from "./index";

export const fetchInfo = (url: string) =>
  api.post<FetchInfoResult>("/fetch-info", { url }).then((r) => r.data);

export const convertTitles = (titles: string[]) =>
  api.post<{ converted: string[] }>("/convert-titles", { titles }).then((r) => r.data);

export const parseImport = (file: File) => {
  const form = new FormData();
  form.append("file", file);
  return api.post<{ urls: string[]; error?: string }>("/parse-import", form).then((r) => r.data);
};

export const startDownload = (payload: StartDownloadPayload) =>
  api.post<{ job_id: string }>("/start-download", payload).then((r) => r.data);

export const getJobStatus = (jobId: string) =>
  api.get<JobStatus>(`/job-status/${jobId}`).then((r) => r.data);

export const cancelJob = (jobId: string) =>
  api.post(`/cancel-job/${jobId}`).then((r) => r.data);

export const cancelAllJobs = () =>
  api.post<{ ok: boolean; jobs: number; terminated: number }>("/cancel-all-jobs").then((r) => r.data);

export const openFolder = (folder: string) =>
  api.post("/open-folder", { folder }).then((r) => r.data);

export const getDefaultDir = () =>
  api.get<{ path: string }>("/default-dir").then((r) => r.data);

export const fetchPlaylistStream = async (
  url: string,
  onChunk: (msg: StreamMessage) => void,
) => {
  const response = await fetch("/api/fetch-playlist-stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const event of events) {
      const line = event.trim();
      if (!line.startsWith("data: ")) continue;

      try {
        onChunk(JSON.parse(line.slice(6).trim()));
      } catch {
        // Ignore malformed stream chunks.
      }
    }
  }
};
