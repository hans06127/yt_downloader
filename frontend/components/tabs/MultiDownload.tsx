import DownloadSettingsCard from "@/components/download/DownloadSettingsCard";
import ProgressCard from "@/components/download/ProgressCard";
import VideoList from "@/components/download/VideoList";
import type { DownloadSettings, JobPanel } from "@/components/home/types";
import ActionButton from "@/components/ui/ActionButton";
import type { DownloadItem, DownloadSegment, FilterState, MediaType, VideoItem } from "@/lib/types";

interface MultiDownloadProps {
  defaultDir: string;
  filter: FilterState;
  items: VideoItem[];
  job: JobPanel;
  loading: boolean;
  settings: DownloadSettings;
  text: string;
  onCancel: () => void;
  onClearFilter: () => void;
  onFetch: () => void;
  onOpenFolder: (folder: string) => void;
  onRetryFailed: (items: DownloadItem[]) => void;
  onReset: () => void;
  onSelectAll: (checked: boolean) => void;
  onSegmentsChange: (index: number, segments: DownloadSegment[]) => void;
  onStart: () => void;
  onTextChange: (text: string) => void;
  onTitleChange: (index: number, title: string) => void;
  onToggle: (index: number) => void;
  updateFilter: (patch: Partial<FilterState>) => void;
  updateMediaType: (mediaType: MediaType) => void;
  updateSettings: (patch: Partial<DownloadSettings>) => void;
}

export default function MultiDownload({
  defaultDir,
  filter,
  items,
  job,
  loading,
  onCancel,
  onClearFilter,
  onFetch,
  onOpenFolder,
  onRetryFailed,
  onReset,
  onSelectAll,
  onSegmentsChange,
  onStart,
  onTextChange,
  onTitleChange,
  onToggle,
  settings,
  text,
  updateFilter,
  updateMediaType,
  updateSettings,
}: MultiDownloadProps) {
  return (
    <>
      <section className="card">
        <div className="card-title">多個網址，每行一個，或使用分號分隔</div>
        <textarea
          placeholder={"https://www.youtube.com/watch?v=...\nhttps://www.youtube.com/watch?v=..."}
          value={text}
          onChange={(event) => onTextChange(event.target.value)}
        />
        <div className="action-bar">
          <ActionButton disabled={loading} variant="primary" onClick={onFetch}>
            {loading ? <span className="spinner" /> : null}
            查詢全部資訊
          </ActionButton>
          <ActionButton variant="ghost" onClick={onReset}>重置</ActionButton>
        </div>
      </section>

      {items.length ? (
        <>
          <VideoList
            filter={filter}
            items={items}
            mediaType={settings.mediaType}
            onClearFilter={onClearFilter}
            onSelectAll={onSelectAll}
            onSegmentsChange={onSegmentsChange}
            onTitleChange={onTitleChange}
            onToggle={onToggle}
            updateFilter={updateFilter}
          />
          <DownloadSettingsCard
            defaultDir={defaultDir}
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
