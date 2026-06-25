import {
  type ChangeEvent,
  type DragEvent,
  type RefObject,
} from "react";
import DownloadSettingsCard from "@/components/download/DownloadSettingsCard";
import ProgressCard from "@/components/download/ProgressCard";
import VideoList from "@/components/download/VideoList";
import type { DownloadSettings, JobPanel } from "@/components/home/types";
import ActionButton from "@/components/ui/ActionButton";
import type { DownloadItem, DownloadSegment, FilterState, MediaType, VideoItem } from "@/lib/types";

interface ImportDownloadProps {
  defaultDir: string;
  dragOver: boolean;
  filter: FilterState;
  importInputRef: RefObject<HTMLInputElement | null>;
  items: VideoItem[];
  job: JobPanel;
  loading: boolean;
  message: string;
  settings: DownloadSettings;
  onCancel: () => void;
  onClearFilter: () => void;
  onDropFile: (file: File) => void;
  onFetchInfo: () => void;
  onOpenFolder: (folder: string) => void;
  onRetryFailed: (items: DownloadItem[]) => void;
  onReset: () => void;
  onSelectAll: (checked: boolean) => void;
  onSegmentsChange: (index: number, segments: DownloadSegment[]) => void;
  onStart: () => void;
  onTitleChange: (index: number, title: string) => void;
  onToggle: (index: number) => void;
  setDragOver: (dragOver: boolean) => void;
  updateFilter: (patch: Partial<FilterState>) => void;
  updateMediaType: (mediaType: MediaType) => void;
  updateSettings: (patch: Partial<DownloadSettings>) => void;
}

export default function ImportDownload({
  defaultDir,
  dragOver,
  filter,
  importInputRef,
  items,
  job,
  loading,
  message,
  onCancel,
  onClearFilter,
  onDropFile,
  onFetchInfo,
  onOpenFolder,
  onRetryFailed,
  onReset,
  onSelectAll,
  onSegmentsChange,
  onStart,
  onTitleChange,
  onToggle,
  setDragOver,
  settings,
  updateFilter,
  updateMediaType,
  updateSettings,
}: ImportDownloadProps) {
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onDropFile(file);
    event.target.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) onDropFile(file);
  };

  return (
    <>
      <section className="card">
        <div className="card-title">匯入 TXT / Excel 檔案</div>
        <div
          className={`drop-zone ${dragOver ? "drag-over" : ""}`}
          onClick={() => importInputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          role="button"
          tabIndex={0}
        >
          <div className="icon">FILE</div>
          <div>點擊或拖曳檔案到此處</div>
          <div className="text-muted mt8">.txt 每行一個網址，或 .xlsx 自動掃描 YouTube 連結</div>
        </div>
        <input ref={importInputRef} hidden type="file" accept=".txt,.xlsx,.xls" onChange={handleFileChange} />
        {message ? <div className="status-pill status-running mt8">{message}</div> : null}
      </section>

      {items.length ? (
        <>
          <VideoList
            extraFilterAction={
              <ActionButton disabled={loading} size="sm" onClick={onFetchInfo}>
                {loading ? <span className="spinner" /> : null}
                查詢影片資訊
              </ActionButton>
            }
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
