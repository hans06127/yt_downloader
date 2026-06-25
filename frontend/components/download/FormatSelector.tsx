import type { MediaType, OutputExt } from "@/lib/types";

const videoExts: OutputExt[] = ["mp4", "webm", "mkv", "avi", "mov"];
const audioExts: OutputExt[] = ["mp3", "m4a", "aac", "flac", "wav", "ogg", "opus"];

interface FormatSelectorProps {
  mediaType: MediaType;
  extension: OutputExt;
  onMediaTypeChange: (mediaType: MediaType) => void;
  onExtensionChange: (extension: OutputExt) => void;
}

export default function FormatSelector({
  extension,
  mediaType,
  onExtensionChange,
  onMediaTypeChange,
}: FormatSelectorProps) {
  const extOptions = mediaType === "audio" ? audioExts : videoExts;

  return (
    <div className="format-row mb8">
      <label>類型</label>
      <select value={mediaType} onChange={(event) => onMediaTypeChange(event.target.value as MediaType)}>
        <option value="video">影片</option>
        <option value="audio">音檔</option>
      </select>
      <label>格式</label>
      <select value={extension} onChange={(event) => onExtensionChange(event.target.value as OutputExt)}>
        {extOptions.map((ext) => (
          <option key={ext} value={ext}>
            {ext.toUpperCase()}
          </option>
        ))}
      </select>
    </div>
  );
}
