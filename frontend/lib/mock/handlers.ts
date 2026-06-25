import { http, HttpResponse } from "msw";
import { mockCookieStatus, mockJobStatus, mockPlaylistItems } from "./data";

const BASE = "/api";

export const handlers = [
  http.get(`${BASE}/cookie-status`, () => HttpResponse.json(mockCookieStatus)),
  http.post(`${BASE}/upload-cookie`, () => HttpResponse.json({ ok: true })),
  http.post(`${BASE}/delete-cookie`, () => HttpResponse.json({ ok: true })),
  http.get(`${BASE}/default-dir`, () => HttpResponse.json({ path: "C:\\Users\\User\\Downloads" })),

  http.post(`${BASE}/fetch-info`, () =>
    HttpResponse.json({
      type: "video",
      title: "示範影片（繁體）",
      orig_title: "示范视频（简体）",
      was_converted: true,
      url: "https://www.youtube.com/watch?v=mock001",
      duration: 245,
      duration_str: "4:05",
      uploader: "Mock Channel",
      lang: "zh-TW",
      is_private: false,
    }),
  ),

  http.post(`${BASE}/convert-titles`, async ({ request }) => {
    const body = (await request.json()) as { titles: string[] };
    return HttpResponse.json({ converted: body.titles.map((t) => `${t}（繁）`) });
  }),

  http.post(`${BASE}/parse-import`, () =>
    HttpResponse.json({
      urls: Array.from(
        { length: 5 },
        (_, i) => `https://www.youtube.com/watch?v=mock${String(i + 1).padStart(3, "0")}`,
      ),
    }),
  ),

  http.post(`${BASE}/fetch-playlist-stream`, () => {
    const lines: string[] = [
      `data: ${JSON.stringify({ type: "header", title: "載入中...", uploader: "", total: 0 })}\n\n`,
      `data: ${JSON.stringify({ type: "meta", title: "Mock 播放清單", uploader: "Mock Channel", total: mockPlaylistItems.length })}\n\n`,
      `data: ${JSON.stringify({ type: "chunk", items: mockPlaylistItems, loaded: mockPlaylistItems.length, total: mockPlaylistItems.length })}\n\n`,
      `data: ${JSON.stringify({ type: "done", total: mockPlaylistItems.length })}\n\n`,
    ];

    return new HttpResponse(lines.join(""), {
      headers: { "Content-Type": "text/event-stream" },
    });
  }),

  http.post(`${BASE}/start-download`, () => HttpResponse.json({ job_id: "mock-job-id-12345" })),
  http.get(`${BASE}/job-status/:jobId`, () => HttpResponse.json(mockJobStatus)),
  http.post(`${BASE}/cancel-job/:jobId`, () => HttpResponse.json({ ok: true })),
  http.post(`${BASE}/cancel-all-jobs`, () => HttpResponse.json({ ok: true, jobs: 1, terminated: 1 })),
  http.post(`${BASE}/open-folder`, () => HttpResponse.json({ ok: true })),
];
