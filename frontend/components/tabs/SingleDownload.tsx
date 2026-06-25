import DownloadSettingsCard from "@/components/download/DownloadSettingsCard";
import ProgressCard from "@/components/download/ProgressCard";
import UrlInput from "@/components/download/UrlInput";
import VideoInfo from "@/components/download/VideoInfo";
import type { DownloadSettings, JobPanel } from "@/components/home/types";
import type { DownloadItem, DownloadSegment, MediaType, VideoItem } from "@/lib/types";

interface SingleDownloadProps {
  defaultDir: string;
  error: string;
  info: VideoItem | null;
  job: JobPanel;
  loading: boolean;
  settings: DownloadSettings;
  url: string;
  onCancel: () => void;
  onFetch: () => void;
  onOpenFolder: (folder: string) => void;
  onRetryFailed: (items: DownloadItem[]) => void;
  onReset: () => void;
  onStart: () => void;
  onSegmentsChange: (segments: DownloadSegment[]) => void;
  onUrlChange: (url: string) => void;
  updateMediaType: (mediaType: MediaType) => void;
  updateSettings: (patch: Partial<DownloadSettings>) => void;
}

export default function SingleDownload({
  defaultDir,
  error,
  info,
  job,
  loading,
  onCancel,
  onFetch,
  onOpenFolder,
  onRetryFailed,
  onReset,
  onStart,
  onSegmentsChange,
  onUrlChange,
  settings,
  updateMediaType,
  updateSettings,
  url,
}: SingleDownloadProps) {
  return (
    <>
      <section className="card">
        <div className="card-title">單一影片網址</div>
        <UrlInput
          buttonLabel="查詢"
          loading={loading}
          placeholder="貼上 YouTube 影片網址"
          value={url}
          onChange={onUrlChange}
          onSubmit={onFetch}
        />
        {error ? <div className="status-pill status-error">{error}</div> : null}
        {info ? <VideoInfo item={info} mediaType={settings.mediaType} onSegmentsChange={onSegmentsChange} /> : null}
      </section>

      {info ? (
        <DownloadSettingsCard
          defaultDir={defaultDir}
          onReset={onReset}
          onStart={onStart}
          settings={settings}
          startLabel="下載此影片"
          updateMediaType={updateMediaType}
          updateSettings={updateSettings}
        />
      ) : null}

      <ProgressCard
        job={job}
        onCancel={onCancel}
        onOpenFolder={onOpenFolder}
        onRetryFailed={onRetryFailed}
      />
    </>
  );
}
