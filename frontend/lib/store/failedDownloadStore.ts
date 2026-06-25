import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { DownloadSegment, MediaType, OutputExt } from "@/lib/types";

export type FailedDownloadTab = "single" | "multi" | "playlist" | "import";

export interface FailedDownloadRecord {
  id: string;
  jobId: string;
  tab: FailedDownloadTab;
  url: string;
  title: string;
  customTitle: string;
  message: string;
  segments: DownloadSegment[];
  mediaType: MediaType;
  extension: OutputExt;
  outputDir: string;
  failedAt: string;
}

interface FailedDownloadStore {
  records: FailedDownloadRecord[];
  addRecords: (records: FailedDownloadRecord[]) => void;
  removeRecord: (id: string) => void;
  clearRecords: () => void;
}

export const FAILED_DOWNLOAD_STORAGE_KEY = "yt-downloader-failed-downloads";

export const useFailedDownloadStore = create<FailedDownloadStore>()(
  persist(
    (set) => ({
      records: [],
      addRecords: (records) =>
        set((state) => {
          const byId = new Map(state.records.map((record) => [record.id, record]));
          records.forEach((record) => byId.set(record.id, record));
          return {
            records: Array.from(byId.values()).sort((a, b) =>
              b.failedAt.localeCompare(a.failedAt),
            ),
          };
        }),
      removeRecord: (id) =>
        set((state) => ({
          records: state.records.filter((record) => record.id !== id),
        })),
      clearRecords: () => {
        set({ records: [] });
        if (typeof window !== "undefined") {
          window.localStorage.removeItem(FAILED_DOWNLOAD_STORAGE_KEY);
        }
      },
    }),
    {
      name: FAILED_DOWNLOAD_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ records: state.records }),
      skipHydration: true,
    },
  ),
);
