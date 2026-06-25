import {
  FolderOpenOutlined,
  LinkOutlined,
  OrderedListOutlined,
  PlaySquareOutlined,
} from "@ant-design/icons";
import type { ComponentType } from "react";
import type { TabKey } from "@/components/home/types";

const tabs: Array<{
  key: TabKey;
  label: string;
  icon: ComponentType;
}> = [
  { key: "single", label: "單一網址", icon: LinkOutlined },
  { key: "multi", label: "多個網址", icon: OrderedListOutlined },
  { key: "playlist", label: "播放清單", icon: PlaySquareOutlined },
  { key: "import", label: "匯入檔案", icon: FolderOpenOutlined },
];

interface SidebarProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
}

export default function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="app-logo">YT</div>
        <span>YT Downloader</span>
      </div>

      <nav className="sidebar-nav" aria-label="下載模式">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              className={`sidebar-link ${activeTab === tab.key ? "active" : ""}`}
              key={tab.key}
              type="button"
              onClick={() => onTabChange(tab.key)}
            >
              <Icon />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="sidebar-foot">
        <span className="sidebar-foot-icon">+</span>
        <div>
          <strong>下載工作台</strong>
          <span>查詢、下載與失敗重試</span>
          <span className="app-version">v{process.env.NEXT_PUBLIC_APP_VERSION || "dev"}</span>
        </div>
      </div>
    </aside>
  );
}
