import type { ReactNode } from "react";
import Sidebar from "@/components/layout/Sidebar";
import type { TabKey } from "@/components/home/types";

const pageMeta: Record<TabKey, { title: string; description: string }> = {
  single: {
    title: "單一網址下載",
    description: "貼上 YouTube 影片網址，查詢後開始下載",
  },
  multi: {
    title: "多個網址下載",
    description: "一次整理並下載多個 YouTube 網址",
  },
  playlist: {
    title: "播放清單下載",
    description: "載入播放清單，篩選需要的影片",
  },
  import: {
    title: "匯入檔案下載",
    description: "從 TXT 或 Excel 匯入網址清單",
  },
};

interface AppShellProps {
  activeTab: TabKey;
  children: ReactNode;
  headerActions: ReactNode;
  onTabChange: (tab: TabKey) => void;
}

export default function AppShell({ activeTab, children, headerActions, onTabChange }: AppShellProps) {
  const meta = pageMeta[activeTab];

  return (
    <div className="app-shell">
      <Sidebar activeTab={activeTab} onTabChange={onTabChange} />

      <div className="app-main">
        <header className="topbar">
          <div className="mobile-brand">
            <div className="app-logo">YT</div>
            <span>YT Downloader</span>
          </div>
          <div className="header-right">{headerActions}</div>
        </header>

        <main className="workspace">
          <header className="page-heading">
            <h1>{meta.title}</h1>
            <p>{meta.description}</p>
          </header>
          <div className="workspace-content">{children}</div>
        </main>
      </div>
    </div>
  );
}
