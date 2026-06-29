export type MediaType = "video" | "audio";
export type VideoExt = "mp4" | "webm" | "mkv" | "avi" | "mov";
export type AudioExt = "mp3" | "m4a" | "aac" | "flac" | "wav" | "ogg" | "opus";
export type OutputExt = VideoExt | AudioExt;
export type Lang = "zh-TW" | "zh-CN" | "other";

export interface DownloadSegment {
  start: number;
  end: number;
  title?: string;
}

export interface VideoItem {
  id: string;
  title: string;
  orig_title: string;
  was_converted: boolean;
  custom_title: string;
  url: string;
  duration: number | null;
  duration_str: string;
  category: string | null;
  uploader: string;
  lang: Lang;
  is_private: boolean;
  segments: DownloadSegment[];
  _checked: boolean;
  _duplicate: boolean;
}

export interface PlaylistMeta {
  title: string;
  uploader: string;
  total: number;
}

export interface DownloadItem {
  url: string;
  custom_title: string;
  segments?: DownloadSegment[];
}

export interface StartDownloadPayload {
  items: DownloadItem[];
  media_type: MediaType;
  extension: OutputExt;
  output_dir: string;
  title_hint: string;
}

export interface JobStatus {
  status: "queued" | "running" | "cancelling" | "done" | "cancelled" | "error";
  total: number;
  completed: number;
  failed: number;
  current_index: number;
  current_url: string;
  current_percent: number;
  output_dir: string;
  log: Array<{
    url: string;
    title: string;
    custom_title?: string;
    segments?: DownloadSegment[];
    status: "success" | "error";
    message?: string;
  }>;
  cancelled: boolean;
  error?: string;
}

export interface CookieStatus {
  exists: boolean;
  mtime: string | null;
  valid: boolean | null;
  message: string;
}

export interface FetchInfoResult {
  type: "video" | "playlist";
  title: string;
  orig_title?: string;
  was_converted?: boolean;
  url?: string;
  duration?: number;
  duration_str?: string;
  category?: string;
  uploader?: string;
  lang?: Lang;
  is_private?: boolean;
  count?: number;
  items?: VideoItem[];
  error?: string;
}

export type StreamMessage =
  | { type: "header"; title: string; uploader: string; total: number }
  | { type: "meta"; title: string; uploader: string; total: number; warning?: string }
  | { type: "chunk"; items: VideoItem[]; loaded: number; total: number }
  | { type: "done"; total: number }
  | { type: "error"; message: string }
  | { error: string };

export interface FilterState {
  minDuration: number | null;
  maxDuration: number | null;
  lang: Lang | "";
  category: string;
}
