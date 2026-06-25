import type { JobPanel } from "@/components/home/types";
import ActionButton from "@/components/ui/ActionButton";
import type { DownloadItem } from "@/lib/types";

interface ProgressCardProps {
  job: JobPanel;
  onCancel: () => void;
  onOpenFolder: (folder: string) => void;
  onRetryFailed: (items: DownloadItem[]) => void;
}

export default function ProgressCard({ job, onCancel, onOpenFolder, onRetryFailed }: ProgressCardProps) {
  if (!job.jobId && !job.status) return null;

  const status = job.status;
  const total = status?.total || 1;
  const overallPercent = status ? Math.round(((status.completed + status.failed) / total) * 100) : 0;
  const filePercent = status?.current_percent || 0;
  const statusText = status
    ? ({
        queued: "排隊中",
        running: "下載中",
        cancelling: "取消中",
        done: "完成",
        cancelled: "已取消",
        error: "錯誤",
      }[status.status] || status.status)
    : "準備中";
  const failedItems = (status?.log || [])
    .filter((entry) => entry.status === "error")
    .map((entry) => ({
      url: entry.url,
      custom_title: entry.custom_title || entry.title,
    }));
  const canRetry = status && ["done", "cancelled", "error"].includes(status.status);

  return (
    <section className="card">
      <div className="progress-header">
        <span className="progress-title">下載進度</span>
        <span className={`status-pill status-${status?.status || "queued"}`}>{statusText}</span>
      </div>
      <div className="progress-meta">
        整體 {overallPercent}% · 目前檔案 {filePercent.toFixed(1)}%
      </div>
      <div className="progress-bar-bg">
        <div
          className={`progress-bar-fill ${status?.status === "done" ? "done" : ""}`}
          style={{ width: `${overallPercent}%` }}
        />
      </div>
      {status?.current_url ? <div className="progress-url">{status.current_url}</div> : null}
      {status ? (
        <div className="progress-stats">
          <span className="stat-success">完成 {status.completed}</span>
          <span className="stat-fail">失敗 {status.failed}</span>
          <span>總數 {status.total}</span>
        </div>
      ) : null}
      <div className="action-bar">
        {status?.status === "queued" || status?.status === "running" ? (
          <ActionButton size="sm" variant="danger" onClick={onCancel}>
            取消下載
          </ActionButton>
        ) : null}
        {status?.status === "done" && status.output_dir ? (
          <ActionButton size="sm" onClick={() => onOpenFolder(status.output_dir)}>
            開啟資料夾
          </ActionButton>
        ) : null}
      </div>
      {status?.error ? <div className="status-pill status-error mt8">{status.error}</div> : null}
      {status?.log?.length ? (
        <div className="log-list">
          {status.log.slice(-10).map((entry, index) => (
            <div className="log-item" key={`${entry.url}-${index}`}>
              <span className={entry.status === "success" ? "ok" : "err"}>
                {entry.status === "success" ? "OK" : "ERR"}
              </span>
              <span className="log-url">{entry.title || entry.url}</span>
            </div>
          ))}
        </div>
      ) : null}
      {failedItems.length && canRetry ? (
        <div className="retry-panel">
          <div>
            <strong>{failedItems.length} 個項目下載失敗</strong>
            <div className="text-muted">可只重新送出失敗項目，不需重新查詢。</div>
          </div>
          <ActionButton variant="warn" onClick={() => onRetryFailed(failedItems)}>
            再次下載失敗項目
          </ActionButton>
        </div>
      ) : null}
    </section>
  );
}
