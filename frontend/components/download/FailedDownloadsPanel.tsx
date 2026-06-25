import {
  CloseOutlined,
  DeleteOutlined,
  RedoOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import ActionButton from "@/components/ui/ActionButton";
import type { FailedDownloadRecord } from "@/lib/store/failedDownloadStore";

interface FailedDownloadsPanelProps {
  records: FailedDownloadRecord[];
  onClear: () => void;
  onRemove: (id: string) => void;
  onRetry: (records: FailedDownloadRecord[]) => void;
}

const tabLabels: Record<FailedDownloadRecord["tab"], string> = {
  single: "單一網址",
  multi: "多個網址",
  playlist: "播放清單",
  import: "匯入檔案",
};

export default function FailedDownloadsPanel({
  onClear,
  onRemove,
  onRetry,
  records,
}: FailedDownloadsPanelProps) {
  if (!records.length) return null;

  return (
    <section className="history-panel">
      <div className="section-heading history-heading">
        <div>
          <span className="section-kicker">
            <WarningOutlined />
            失敗下載紀錄
          </span>
          <h2>可重新下載的項目</h2>
        </div>
        <div className="history-actions">
          <ActionButton size="sm" onClick={() => onRetry(records)}>
            <RedoOutlined />
            全部重試
          </ActionButton>
          <ActionButton size="sm" variant="danger" onClick={onClear}>
            <DeleteOutlined />
            清除清單
          </ActionButton>
        </div>
      </div>

      <div className="history-list">
        {records.map((record) => (
          <article className="history-row" key={record.id}>
            <div className="history-main">
              <strong>{record.title || record.url}</strong>
              <span>{record.message || "下載失敗"}</span>
            </div>
            <div className="history-meta">
              <span className="history-type">{tabLabels[record.tab]}</span>
              <span>{record.extension.toUpperCase()}</span>
              <time dateTime={record.failedAt}>
                {new Date(record.failedAt).toLocaleString("zh-TW")}
              </time>
            </div>
            <div className="history-row-actions">
              <button
                aria-label={`重試 ${record.title}`}
                className="icon-action"
                title="重新下載"
                type="button"
                onClick={() => onRetry([record])}
              >
                <RedoOutlined />
              </button>
              <button
                aria-label={`移除 ${record.title}`}
                className="icon-action danger"
                title="移除紀錄"
                type="button"
                onClick={() => onRemove(record.id)}
              >
                <CloseOutlined />
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
