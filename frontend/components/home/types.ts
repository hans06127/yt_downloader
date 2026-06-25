import type { FilterState, JobStatus, MediaType, OutputExt } from "@/lib/types";

export type TabKey = "single" | "multi" | "playlist" | "import";
export type ListTabKey = Exclude<TabKey, "single">;

export interface DownloadSettings {
  mediaType: MediaType;
  extension: OutputExt;
  outputDir: string;
}

export interface JobPanel {
  jobId: string | null;
  status: JobStatus | null;
}

export interface LoadProgress {
  loaded: number;
  total: number;
}

export const initialSettings: Record<TabKey, DownloadSettings> = {
  single: { mediaType: "video", extension: "mp4", outputDir: "" },
  multi: { mediaType: "video", extension: "mp4", outputDir: "" },
  playlist: { mediaType: "video", extension: "mp4", outputDir: "" },
  import: { mediaType: "video", extension: "mp4", outputDir: "" },
};

export const initialFilters: Record<ListTabKey, FilterState> = {
  multi: { minDuration: null, maxDuration: null, lang: "", category: "" },
  playlist: { minDuration: null, maxDuration: null, lang: "", category: "" },
  import: { minDuration: null, maxDuration: null, lang: "", category: "" },
};

export const initialJobs: Record<TabKey, JobPanel> = {
  single: { jobId: null, status: null },
  multi: { jobId: null, status: null },
  playlist: { jobId: null, status: null },
  import: { jobId: null, status: null },
};
