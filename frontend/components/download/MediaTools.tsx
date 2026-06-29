"use client";

import { useMemo, useState } from "react";
import {
  CloseOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  ScissorOutlined,
  SoundOutlined,
} from "@ant-design/icons";
import { Modal } from "antd";
import ActionButton from "@/components/ui/ActionButton";
import type { DownloadSegment, MediaType, VideoItem } from "@/lib/types";

interface MediaToolsProps {
  item: VideoItem;
  mediaType: MediaType;
  onSegmentsChange: (segments: DownloadSegment[]) => void;
}

interface SegmentDraft {
  title: string;
  start: string;
  end: string;
}

export default function MediaTools({ item, mediaType, onSegmentsChange }: MediaToolsProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [segmentsOpen, setSegmentsOpen] = useState(false);
  const [drafts, setDrafts] = useState<SegmentDraft[]>([]);
  const [error, setError] = useState("");
  const videoId = useMemo(() => getYouTubeId(item.url), [item.url]);

  const openSegmentEditor = () => {
    setDrafts(
      item.segments.length
        ? item.segments.map((segment) => ({
            title: segment.title || "",
            start: formatTimestamp(segment.start),
            end: formatTimestamp(segment.end),
          }))
        : [{ title: "", start: "00:00", end: item.duration ? formatTimestamp(item.duration) : "" }],
    );
    setError("");
    setSegmentsOpen(true);
  };

  const saveSegments = () => {
    const parsed = drafts.map((draft) => ({
      title: draft.title.trim(),
      start: parseTimestamp(draft.start),
      end: parseTimestamp(draft.end),
    }));

    if (parsed.some((segment) => segment.start === null || segment.end === null)) {
      setError("請使用 SS、MM:SS 或 HH:MM:SS 格式。");
      return;
    }

    const segments = parsed
      .map((segment) => ({
        title: segment.title,
        start: segment.start as number,
        end: segment.end as number,
      }))
      .sort((a, b) => a.start - b.start);

    if (segments.some((segment) => segment.start < 0 || segment.end <= segment.start)) {
      setError("每一段的結束時間必須大於開始時間。");
      return;
    }
    const duration = item.duration;
    if (duration && segments.some((segment) => segment.end > duration + 1)) {
      setError(`區段不可超過影片長度 ${item.duration_str}。`);
      return;
    }
    onSegmentsChange(segments);
    setSegmentsOpen(false);
  };

  return (
    <>
      <div className="media-tools" onClick={(event) => event.stopPropagation()}>
        <button
          aria-label={mediaType === "audio" ? `試聽 ${item.title}` : `預覽 ${item.title}`}
          className="icon-action"
          disabled={!videoId}
          title={mediaType === "audio" ? "試聽" : "預覽影片"}
          type="button"
          onClick={() => setPreviewOpen(true)}
        >
          {mediaType === "audio" ? <SoundOutlined /> : <PlayCircleOutlined />}
        </button>
        <button
          aria-label={`設定 ${item.title} 的下載區段`}
          className={`icon-action ${item.segments.length ? "active" : ""}`}
          title="設定下載區段"
          type="button"
          onClick={openSegmentEditor}
        >
          <ScissorOutlined />
        </button>
        {item.segments.length ? <span className="segment-count">{item.segments.length} 段</span> : null}
      </div>

      <Modal
        destroyOnHidden
        footer={null}
        open={previewOpen}
        title={mediaType === "audio" ? `試聽：${item.title}` : `預覽：${item.title}`}
        width={mediaType === "audio" ? 620 : 900}
        onCancel={() => setPreviewOpen(false)}
      >
        {videoId ? (
          <div className={`media-preview ${mediaType === "audio" ? "audio-preview" : ""}`}>
            <iframe
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
              title={item.title}
            />
          </div>
        ) : (
          <div className="status-pill status-error">無法辨識此 YouTube 網址。</div>
        )}
      </Modal>

      <Modal
        open={segmentsOpen}
        title={`下載區段：${item.title}`}
        width={820}
        okText="套用區段"
        cancelText="取消"
        onCancel={() => setSegmentsOpen(false)}
        onOk={saveSegments}
      >
        <div className="segment-editor">
          <div className="segment-help">留空區段代表下載完整內容；多個區段會輸出成多個檔案。</div>
          {drafts.map((draft, index) => (
            <div className="segment-row" key={index}>
              <span className="segment-index">{String(index + 1).padStart(2, "0")}</span>
              <input
                aria-label={`第 ${index + 1} 段檔名`}
                placeholder={`Segment ${index + 1}`}
                value={draft.title}
                onChange={(event) =>
                  setDrafts((current) =>
                    current.map((entry, draftIndex) =>
                      draftIndex === index ? { ...entry, title: event.target.value } : entry,
                    ),
                  )
                }
              />
              <input
                aria-label={`第 ${index + 1} 段開始時間`}
                placeholder="00:00"
                value={draft.start}
                onChange={(event) =>
                  setDrafts((current) =>
                    current.map((entry, draftIndex) =>
                      draftIndex === index ? { ...entry, start: event.target.value } : entry,
                    ),
                  )
                }
              />
              <span>至</span>
              <input
                aria-label={`第 ${index + 1} 段結束時間`}
                placeholder={item.duration_str || "05:00"}
                value={draft.end}
                onChange={(event) =>
                  setDrafts((current) =>
                    current.map((entry, draftIndex) =>
                      draftIndex === index ? { ...entry, end: event.target.value } : entry,
                    ),
                  )
                }
              />
              <button
                aria-label={`刪除第 ${index + 1} 段`}
                className="icon-action danger"
                title="刪除區段"
                type="button"
                onClick={() => setDrafts((current) => current.filter((_, draftIndex) => draftIndex !== index))}
              >
                <DeleteOutlined />
              </button>
            </div>
          ))}
          <div className="segment-actions">
            <ActionButton
              size="sm"
              onClick={() => setDrafts((current) => [...current, { title: "", start: "", end: "" }])}
            >
              <PlusOutlined />
              新增區段
            </ActionButton>
            {item.segments.length ? (
              <ActionButton
                size="sm"
                variant="danger"
                onClick={() => {
                  onSegmentsChange([]);
                  setSegmentsOpen(false);
                }}
              >
                <CloseOutlined />
                改為完整下載
              </ActionButton>
            ) : null}
          </div>
          {error ? <div className="status-pill status-error">{error}</div> : null}
        </div>
      </Modal>
    </>
  );
}

function getYouTubeId(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "youtu.be") return parsed.pathname.split("/").filter(Boolean)[0] || "";
    if (parsed.hostname.endsWith("youtube.com")) {
      if (parsed.pathname === "/watch") return parsed.searchParams.get("v") || "";
      const parts = parsed.pathname.split("/").filter(Boolean);
      if (["embed", "shorts", "live"].includes(parts[0])) return parts[1] || "";
    }
  } catch {
    return "";
  }
  return "";
}

function parseTimestamp(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(":").map(Number);
  if (parts.some((part) => !Number.isFinite(part) || part < 0)) return null;
  if (parts.length === 1) return parts[0];
  if (parts.length === 2 && parts[1] < 60) return parts[0] * 60 + parts[1];
  if (parts.length === 3 && parts[1] < 60 && parts[2] < 60) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return null;
}

function formatTimestamp(seconds: number) {
  const rounded = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const secs = rounded % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}
