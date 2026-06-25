import {
  DeleteOutlined,
  SafetyCertificateOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import type { ChangeEvent, RefObject } from "react";
import ActionButton from "@/components/ui/ActionButton";
import type { CookieStatus as CookieStatusData } from "@/lib/types";

interface CookieStatusProps {
  cookie: CookieStatusData | null;
  inputRef: RefObject<HTMLInputElement | null>;
  loading: boolean;
  onDelete: () => void;
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void;
}

export default function CookieStatus({
  cookie,
  inputRef,
  loading,
  onDelete,
  onUpload,
}: CookieStatusProps) {
  const statusClass = cookie?.exists ? "status-done" : "status-queued";
  const statusText = cookie?.exists
    ? `Cookie 已載入${cookie.mtime ? ` ${cookie.mtime}` : ""}`
    : "尚未載入 Cookie";

  return (
    <>
      <span className={`cookie-status ${statusClass}`}>
        <SafetyCertificateOutlined />
        {loading ? "Cookie 更新中" : statusText}
      </span>
      <ActionButton size="sm" onClick={() => inputRef.current?.click()}>
        <UploadOutlined />
        上傳 cookies.txt
      </ActionButton>
      {cookie?.exists ? (
        <ActionButton aria-label="刪除 Cookie" size="sm" variant="danger" onClick={onDelete}>
          <DeleteOutlined />
        </ActionButton>
      ) : null}
      <input ref={inputRef} hidden type="file" accept=".txt" onChange={onUpload} />
    </>
  );
}
