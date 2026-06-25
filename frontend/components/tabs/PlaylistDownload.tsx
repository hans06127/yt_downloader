import DownloadSettingsCard from "@/components/download/DownloadSettingsCard";
import ProgressCard from "@/components/download/ProgressCard";
import UrlInput from "@/components/download/UrlInput";
import VideoList from "@/components/download/VideoList";
import type { DownloadSettings, JobPanel, LoadProgress } from "@/components/home/types";
import type {
  DownloadItem,
  DownloadSegment,
  FilterState,
  MediaType,
  PlaylistMeta,
  VideoItem,
} from "@/lib/types";

interface PlaylistDownloadProps {
  categories: string[];
  defaultDir: string;
  error: string;
  filter: FilterState;
  items: VideoItem[];
  job: JobPanel;
  loading: boolean;
  loadProgress: LoadProgress;
  meta: PlaylistMeta | null;
  settings: DownloadSettings;
  url: string;
  onCancel: () => void;
  onClearFilter: () => void;
  onFetch: () => void;
  onOpenFolder: (folder: string) => void;
  onRetryFailed: (items: DownloadItem[]) => void;
  onReset: () => void;
  onSelectAll: (checked: boolean) => void;
  onSegmentsChange: (index: number, segments: DownloadSegment[]) => void;
  onStart: () => void;
  onTitleChange: (index: number, title: string) => void;
  onToggle: (index: number) => void;
  onUrlChange: (url: string) => void;
  updateFilter: (patch: Partial<FilterState>) => void;
  updateMediaType: (mediaType: MediaType) => void;
  updateSettings: (patch: Partial<DownloadSettings>) => void;
}

export default function PlaylistDownload({
  categories,
  defaultDir,
  error,
  filter,
  items,
  job,
  loading,
  loadProgress,
  meta,
  onCancel,
  onClearFilter,
  onFetch,
  onOpenFolder,
  onRetryFailed,
  onReset,
  onSelectAll,
  onSegmentsChange,
  onStart,
  onTitleChange,
  onToggle,
  onUrlChange,
  settings,
  updateFilter,
  updateMediaType,
  updateSettings,
  url,
}: PlaylistDownloadProps) {
  const percent = loadProgress.total ? Math.round((loadProgress.loaded / loadProgress.total) * 100) : 0;

  return (
    <>
      <section className="card">
        <div className="card-title">播放清單網址</div>
        <UrlInput
          buttonLabel="載入清單"
          loading={loading}
          placeholder="貼上 YouTube 播放清單網址"
          value={url}
          onChange={onUrlChange}
          onSubmit={onFetch}
        />
        {meta ? (
          <div className="info-panel">
            <div className="info-title">{meta.title}</div>
            <div className="info-meta">
              <span className="info-badge playlist">{meta.total} 部影片</span>
              {meta.uploader ? <span className="info-badge">{meta.uploader}</span> : null}
            </div>
          </div>
        ) : null}
        {loading ? (
          <div className="mt8">
            <div className="progress-meta">
              已載入 {loadProgress.loaded} / {loadProgress.total || "?"}
            </div>
            <div className="progress-bar-bg">
              <div className="progress-bar-fill" style={{ width: `${percent}%` }} />
            </div>
          </div>
        ) : null}
        {error ? <div className="status-pill status-error mt8">{error}</div> : null}
      </section>

      {items.length ? (
        <>
          <VideoList
            categories={categories}
            filter={filter}
            items={items}
            mediaType={settings.mediaType}
            onClearFilter={onClearFilter}
            onSelectAll={onSelectAll}
            onSegmentsChange={onSegmentsChange}
            onTitleChange={onTitleChange}
            onToggle={onToggle}
            showCategoryFilter
            updateFilter={updateFilter}
          />
          <DownloadSettingsCard
            defaultDir={defaultDir}
            onReset={onReset}
            onStart={onStart}
            settings={settings}
            startLabel="下載已選項目"
            updateMediaType={updateMediaType}
            updateSettings={updateSettings}
          />
        </>
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
