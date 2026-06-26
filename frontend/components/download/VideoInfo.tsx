import MediaTools from "@/components/download/MediaTools";
import type { DownloadSegment, MediaType, VideoItem } from "@/lib/types";

export default function VideoInfo({
  item,
  mediaType,
  onSegmentsChange,
  onTitleBlur,
  onTitleChange,
}: {
  item: VideoItem;
  mediaType: MediaType;
  onSegmentsChange: (segments: DownloadSegment[]) => void;
  onTitleBlur?: () => void;
  onTitleChange?: (title: string) => void;
}) {
  return (
    <div className="info-panel">
      <div className="info-title-row">
        <div className="single-title-editor">
          <label htmlFor="single-custom-title">下載標題</label>
          <input
            id="single-custom-title"
            className={`title-input ${item.was_converted ? "title-converted" : ""}`}
            value={item.custom_title || item.title}
            onBlur={onTitleBlur}
            onChange={(event) => onTitleChange?.(event.target.value)}
          />
        </div>
        <MediaTools item={item} mediaType={mediaType} onSegmentsChange={onSegmentsChange} />
      </div>
      {item.was_converted ? <div className="dir-hint mt8">原標題：{item.orig_title}</div> : null}
      <div className="info-meta">
        <span className="info-badge">{item.duration_str}</span>
        {item.uploader ? <span className="info-badge">{item.uploader}</span> : null}
        {item.category ? <span className="info-badge">{item.category}</span> : null}
      </div>
    </div>
  );
}
