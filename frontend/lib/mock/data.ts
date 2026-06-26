import type { CookieStatus, JobStatus, VideoItem } from "@/lib/types";

export const mockPlaylistItems: VideoItem[] = Array.from({ length: 25 }, (_, i) => ({
  id: `mock_id_${String(i + 1).padStart(3, "0")}`,
  title: `第 ${i + 1} 首 Mock 影片`,
  orig_title: `第 ${i + 1} 首 Mock 视频`,
  was_converted: i % 3 === 0,
  custom_title: "",
  url: `https://www.youtube.com/watch?v=mock${String(i + 1).padStart(3, "0")}`,
  duration: 60 + i * 30,
  duration_str: `${Math.floor((60 + i * 30) / 60)}:${String((60 + i * 30) % 60).padStart(2, "0")}`,
  category: null,
  uploader: "Mock Channel",
  lang: "zh-TW",
  is_private: i === 5,
  segments: [],
  _checked: i !== 5 && i !== 10,
  _duplicate: i === 10,
}));

export const mockJobStatus: JobStatus = {
  status: "done",
  total: 4,
  completed: 3,
  failed: 1,
  current_index: 4,
  current_url: "https://www.youtube.com/watch?v=mock004",
  current_percent: 100,
  output_dir: "C:\\Users\\User\\Downloads\\Mock Playlist",
  log: [
    { url: "https://www.youtube.com/watch?v=mock001", title: "第 1 首", status: "success" },
    { url: "https://www.youtube.com/watch?v=mock002", title: "第 2 首", status: "success" },
    { url: "https://www.youtube.com/watch?v=mock003", title: "第 3 首", status: "success" },
    {
      url: "https://www.youtube.com/watch?v=mock004",
      title: "第 4 首",
      custom_title: "第 4 首",
      status: "error",
      message: "Mock download failed",
    },
  ],
  cancelled: false,
};

export const mockCookieStatus: CookieStatus = {
  exists: true,
  mtime: "2026/06/20 10:30",
  valid: true,
  message: "Cookie 可讀取且尚未過期。",
};
