import { UploadOutlined, WarningOutlined } from "@ant-design/icons";
import { Modal } from "antd";
import ActionButton from "@/components/ui/ActionButton";

interface CookieAlertPopupProps {
  open: boolean;
  title: string;
  message: string;
  loading?: boolean;
  onClose: () => void;
  onUploadClick: () => void;
}

export default function CookieAlertPopup({
  loading = false,
  message,
  onClose,
  onUploadClick,
  open,
  title,
}: CookieAlertPopupProps) {
  return (
    <Modal
      centered
      footer={null}
      open={open}
      title={
        <span className="cookie-alert-title">
          <WarningOutlined />
          {title}
        </span>
      }
      onCancel={onClose}
    >
      <p className="cookie-alert-message">{message}</p>
      <div className="cookie-alert-actions">
        <ActionButton onClick={onUploadClick} disabled={loading}>
          <UploadOutlined />
          上傳新的 cookies.txt
        </ActionButton>
        <ActionButton onClick={onClose}>
          稍後處理
        </ActionButton>
      </div>
    </Modal>
  );
}
