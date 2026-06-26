import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { App as AntdApp } from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import FailedDownloadsPanel from "@/components/download/FailedDownloadsPanel";
import {
  initialFilters,
  initialJobs,
  initialSettings,
  type DownloadSettings,
  type JobPanel,
  type ListTabKey,
  type LoadProgress,
  type TabKey,
} from "@/components/home/types";
import AppShell from "@/components/layout/AppShell";
import CookieAlertPopup from "@/components/layout/CookieAlertPopup";
import CookieStatus from "@/components/layout/CookieStatus";
import ImportDownload from "@/components/tabs/ImportDownload";
import MultiDownload from "@/components/tabs/MultiDownload";
import PlaylistDownload from "@/components/tabs/PlaylistDownload";
import SingleDownload from "@/components/tabs/SingleDownload";
import ActionButton from "@/components/ui/ActionButton";
import {
  cancelAllJobs as cancelAllJobsApi,
  cancelJob as cancelJobApi,
  convertTitles,
  fetchInfo as fetchInfoApi,
  fetchPlaylistStream,
  getDefaultDir,
  getJobStatus,
  openFolder as openFolderApi,
  parseImport as parseImportApi,
  startDownload,
} from "@/lib/api/download";
import {
  deleteCookie as deleteCookieApi,
  getCookieStatus,
  uploadCookie as uploadCookieApi,
} from "@/lib/api/cookie";
import {
  downloadTitle,
  errorMessage,
  makeRawUrlItem,
  markDuplicates,
  normalizeFetchResult,
  normalizeItem,
  parseUrls,
  selectedItems,
} from "@/lib/download/items";
import {
  useFailedDownloadStore,
  type FailedDownloadRecord,
} from "@/lib/store/failedDownloadStore";
import type {
  DownloadItem,
  DownloadSegment,
  FilterState,
  JobStatus,
  MediaType,
  PlaylistMeta,
  VideoItem,
} from "@/lib/types";

const tabLabels: Record<TabKey, string> = {
  single: "單一網址",
  multi: "多個網址",
  playlist: "播放清單",
  import: "匯入檔案",
};

interface JobConsoleState {
  status?: JobStatus["status"];
  currentIndex?: number;
  currentUrl?: string;
  logLength: number;
}

function logInfo(event: string, details?: unknown) {
  console.info(`[YT Downloader] ${event}`, details ?? "");
}

function logError(event: string, details?: unknown) {
  console.error(`[YT Downloader] ${event}`, details ?? "");
}

function isCookieIssueMessage(message: string) {
  return /cookie|cookies|登入|驗證|過期|not a bot|sign in/i.test(message);
}

export default function HomePage() {
  const { message: messageApi, modal } = AntdApp.useApp();
  const queryClient = useQueryClient();
  const failedRecords = useFailedDownloadStore((state) => state.records);
  const clearFailedRecords = useFailedDownloadStore((state) => state.clearRecords);
  const removeFailedRecord = useFailedDownloadStore((state) => state.removeRecord);
  const [activeTab, setActiveTab] = useState<TabKey>("single");
  const [settings, setSettings] = useState<Record<TabKey, DownloadSettings>>(initialSettings);
  const [filters, setFilters] = useState<Record<ListTabKey, FilterState>>(initialFilters);
  const [jobs, setJobs] = useState<Record<TabKey, JobPanel>>(initialJobs);

  const [singleUrl, setSingleUrl] = useState("");
  const [singleInfo, setSingleInfo] = useState<VideoItem | null>(null);
  const [singleLoading, setSingleLoading] = useState(false);
  const [singleError, setSingleError] = useState("");
  const [cookieAlert, setCookieAlert] = useState<{ title: string; message: string } | null>(null);

  const [multiText, setMultiText] = useState("");
  const [multiItems, setMultiItems] = useState<VideoItem[]>([]);
  const [multiLoading, setMultiLoading] = useState(false);

  const [playlistUrl, setPlaylistUrl] = useState("");
  const [playlistMeta, setPlaylistMeta] = useState<PlaylistMeta | null>(null);
  const [playlistItems, setPlaylistItems] = useState<VideoItem[]>([]);
  const [playlistLoading, setPlaylistLoading] = useState(false);
  const [playlistLoadProgress, setPlaylistLoadProgress] = useState<LoadProgress>({ loaded: 0, total: 0 });
  const [playlistError, setPlaylistError] = useState("");

  const [importItems, setImportItems] = useState<VideoItem[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const cookieInputRef = useRef<HTMLInputElement | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const intervalsRef = useRef<Partial<Record<TabKey, number>>>({});
  const jobConsoleRef = useRef<Partial<Record<TabKey, JobConsoleState>>>({});

  const cookieQuery = useQuery({
    queryKey: ["cookie-status"],
    queryFn: getCookieStatus,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    staleTime: 0,
  });
  const defaultDirQuery = useQuery({
    queryKey: ["default-dir"],
    queryFn: getDefaultDir,
  });
  const uploadCookieMutation = useMutation({ mutationFn: uploadCookieApi });
  const deleteCookieMutation = useMutation({ mutationFn: deleteCookieApi });
  const cookie = cookieQuery.data ?? null;
  const defaultDir = defaultDirQuery.data?.path ?? "";
  const cookieLoading =
    cookieQuery.isFetching || uploadCookieMutation.isPending || deleteCookieMutation.isPending;

  const showCookieAlert = (message: string, title = "Cookie 需要更新") => {
    setCookieAlert({ title, message });
  };

  const maybeShowCookieAlert = (message: string) => {
    if (isCookieIssueMessage(message)) {
      showCookieAlert(message);
    }
  };

  useEffect(() => {
    void useFailedDownloadStore.persist.rehydrate();
  }, []);

  useEffect(() => {
    if (cookie?.exists && cookie.valid === false) {
      showCookieAlert(cookie.message || "cookies.txt 無效或已過期，請重新匯出並上傳。");
    }
  }, [cookie?.exists, cookie?.message, cookie?.valid]);

  useEffect(
    () => () => {
      Object.values(intervalsRef.current).forEach((id) => {
        if (id) window.clearInterval(id);
      });
    },
    [],
  );

  const updateSettings = (tab: TabKey, patch: Partial<DownloadSettings>) => {
    setSettings((prev) => ({ ...prev, [tab]: { ...prev[tab], ...patch } }));
  };

  const updateMediaType = (tab: TabKey, mediaType: MediaType) => {
    setSettings((prev) => ({
      ...prev,
      [tab]: {
        ...prev[tab],
        mediaType,
        extension: mediaType === "audio" ? "mp3" : "mp4",
      },
    }));
  };

  const updateFilter = (tab: ListTabKey, patch: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, [tab]: { ...prev[tab], ...patch } }));
  };

  const resetFilter = (tab: ListTabKey) => {
    setFilters((prev) => ({ ...prev, [tab]: initialFilters[tab] }));
  };

  const resetQueryResults = (tab: TabKey) => {
    stopPolling(tab);
    setJobs((prev) => ({ ...prev, [tab]: { jobId: null, status: null } }));
    delete jobConsoleRef.current[tab];
    setSettings((prev) => ({
      ...prev,
      [tab]: { ...initialSettings[tab] },
    }));

    if (tab === "single") {
      setSingleInfo(null);
      setSingleError("");
    }
    if (tab === "multi") {
      setMultiItems([]);
      resetFilter("multi");
    }
    if (tab === "playlist") {
      setPlaylistItems([]);
      setPlaylistMeta(null);
      setPlaylistError("");
      setPlaylistLoadProgress({ loaded: 0, total: 0 });
      resetFilter("playlist");
    }
    if (tab === "import") {
      setImportItems([]);
      resetFilter("import");
    }
  };

  const stopPolling = (tab: TabKey) => {
    const interval = intervalsRef.current[tab];
    if (interval) {
      window.clearInterval(interval);
      delete intervalsRef.current[tab];
    }
  };

  const startPolling = (
    tab: TabKey,
    jobId: string,
    jobSettings: DownloadSettings,
  ) => {
      stopPolling(tab);
      setJobs((prev) => ({ ...prev, [tab]: { jobId, status: null } }));
      jobConsoleRef.current[tab] = { status: "queued", logLength: 0 };
      logInfo(`下載已送出 [${tabLabels[tab]}]`, { jobId });

      const tick = async () => {
        try {
          const status = await getJobStatus(jobId);
          setJobs((prev) => ({ ...prev, [tab]: { jobId, status } }));
          const previous = jobConsoleRef.current[tab] ?? { logLength: 0 };

          if (
            status.current_index &&
            (status.current_index !== previous.currentIndex || status.current_url !== previous.currentUrl)
          ) {
            logInfo(`下載中 [${tabLabels[tab]}] ${status.current_index}/${status.total}`, {
              url: status.current_url,
              percent: status.current_percent,
            });
          }

          status.log.slice(previous.logLength).forEach((entry) => {
            if (entry.status === "success") {
              logInfo(`下載完成 [${tabLabels[tab]}]`, entry);
            } else {
              if (entry.message) maybeShowCookieAlert(entry.message);
              logError(`下載失敗 [${tabLabels[tab]}]`, entry);
            }
          });

          if (status.status !== previous.status) {
            if (status.status === "done" && status.failed === 0) {
              logInfo(`工作全部完成 [${tabLabels[tab]}]`, status);
            } else if (status.status === "done" || status.status === "error") {
              logError(`工作完成但有失敗 [${tabLabels[tab]}]`, status);
            } else if (status.status === "cancelled") {
              console.warn(`[YT Downloader] 工作已取消 [${tabLabels[tab]}]`, status);
            }
          }

          if (
            ["done", "cancelled", "error"].includes(status.status) &&
            status.log.some((entry) => entry.status === "error")
          ) {
            useFailedDownloadStore.getState().addRecords(
              status.log.flatMap((entry, index) =>
                entry.status === "error"
                  ? [
                      {
                        id: `${jobId}:${index}:${entry.url}`,
                        jobId,
                        tab,
                        url: entry.url,
                        title: entry.title || entry.url,
                  customTitle: entry.custom_title || entry.title || "",
                  message: entry.message || "下載失敗",
                  segments: entry.segments || [],
                        mediaType: jobSettings.mediaType,
                        extension: jobSettings.extension,
                        outputDir: status.output_dir || jobSettings.outputDir,
                        failedAt: new Date().toISOString(),
                      },
                    ]
                  : [],
              ),
            );
          }

          jobConsoleRef.current[tab] = {
            status: status.status,
            currentIndex: status.current_index,
            currentUrl: status.current_url,
            logLength: status.log.length,
          };

          if (["done", "cancelled", "error"].includes(status.status)) {
            stopPolling(tab);
          }
        } catch (error) {
          logError(`取得下載狀態失敗 [${tabLabels[tab]}]`, error);
          stopPolling(tab);
        }
      };

      void tick();
      intervalsRef.current[tab] = window.setInterval(tick, 1000);
  };

  const handleCookieUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const result = await uploadCookieMutation.mutateAsync(file);
      if (result.error) {
        messageApi.error(result.error);
      } else {
        messageApi.success("Cookie 已更新");
        setCookieAlert(null);
      }
      await queryClient.invalidateQueries({ queryKey: ["cookie-status"] });
    } catch (error) {
      messageApi.error(errorMessage(error));
    } finally {
      event.target.value = "";
    }
  };

  const handleCookieDelete = () => {
    modal.confirm({
      title: "刪除 Cookie",
      content: "確定要刪除 cookies.txt？",
      okText: "刪除",
      okButtonProps: { danger: true },
      cancelText: "取消",
      onOk: async () => {
        try {
          await deleteCookieMutation.mutateAsync();
          await queryClient.invalidateQueries({ queryKey: ["cookie-status"] });
          messageApi.success("Cookie 已刪除");
        } catch (error) {
          messageApi.error(errorMessage(error));
        }
      },
    });
  };

  const fetchSingleInfo = async () => {
    const url = singleUrl.trim();
    if (!url) return;

    resetQueryResults("single");
    setSingleLoading(true);
    logInfo("開始查詢單一影片", { url });

    try {
      const info = await fetchInfoApi(url);
      if (!info) {
        setSingleError("查詢失敗：後端沒有回傳影片資訊");
        logError("單一影片查詢失敗", { url, error: "empty response" });
        return;
      }
      if (info.error) {
        setSingleError(info.error);
        maybeShowCookieAlert(info.error);
        logError("單一影片查詢失敗", { url, error: info.error });
        return;
      }

      if (info.type === "playlist") {
        setSingleError("這是播放清單網址，請改用播放清單分頁。");
        logError("單一影片查詢收到播放清單", { url });
        return;
      }

      setSingleInfo(normalizeFetchResult(info, url));
      logInfo("單一影片查詢成功", info);
    } catch (error) {
      const message = errorMessage(error);
      setSingleError(message);
      maybeShowCookieAlert(message);
      logError("單一影片查詢失敗", { url, error: message });
    } finally {
      setSingleLoading(false);
    }
  };

  const startSingleDownload = async () => {
    const url = singleUrl.trim();
    if (!url || !singleInfo) return;

    try {
      const tabSettings = settings.single;
      const title = downloadTitle(singleInfo) || "download";
      logInfo("準備下載單一影片", { url, title, settings: tabSettings });
      const result = await startDownload({
        items: [{ url, custom_title: title, segments: singleInfo.segments }],
        media_type: tabSettings.mediaType,
        extension: tabSettings.extension,
        output_dir: tabSettings.outputDir.trim(),
        title_hint: title,
      });

      startPolling("single", result.job_id, tabSettings);
    } catch (error) {
      const message = errorMessage(error);
      logError("單一影片下載送出失敗", { url, error: message });
      maybeShowCookieAlert(message);
      messageApi.error(message);
    }
  };

  const fetchMultiInfo = async () => {
    const urls = parseUrls(multiText);
    if (!urls.length) return;

    resetQueryResults("multi");
    setMultiLoading(true);
    const items: VideoItem[] = [];
    logInfo("開始查詢多個網址", { total: urls.length, urls });

    try {
      for (const url of urls) {
        try {
          const info = await fetchInfoApi(url);
          if (!info) {
            logError("網址查詢失敗", { url, error: "empty response" });
            continue;
          }
          if (info.error) {
            maybeShowCookieAlert(info.error);
            logError("網址查詢失敗", { url, error: info.error });
            continue;
          }

          if (info.type === "playlist") {
            items.push(...(info.items || []).map((item) => normalizeItem({ ...item, _checked: true })));
          } else {
            items.push(normalizeFetchResult(info, url));
          }
          logInfo("網址查詢成功", { url, type: info.type, title: info.title });
        } catch (error) {
          const message = errorMessage(error);
          maybeShowCookieAlert(message);
          logError("網址查詢失敗", { url, error: message });
        }
      }

      setMultiItems(markDuplicates(items));
      logInfo("多個網址查詢完成", { requested: urls.length, loaded: items.length });
    } catch (error) {
      const message = errorMessage(error);
      maybeShowCookieAlert(message);
      logError("多個網址查詢失敗", message);
      messageApi.error(message);
    } finally {
      setMultiLoading(false);
    }
  };

  const fetchPlaylistInfo = async () => {
    const url = playlistUrl.trim();
    if (!url) return;

    resetQueryResults("playlist");
    setPlaylistLoading(true);
    logInfo("開始查詢播放清單", { url });

    try {
      await fetchPlaylistStream(url, (msg) => {
        if ("error" in msg) {
          setPlaylistError(msg.error);
          maybeShowCookieAlert(msg.error);
          logError("播放清單查詢失敗", { url, error: msg.error });
          return;
        }

        if (msg.type === "header") {
          setPlaylistMeta({ title: msg.title, uploader: msg.uploader, total: msg.total });
        }

        if (msg.type === "meta") {
          setPlaylistMeta({ title: msg.title, uploader: msg.uploader, total: msg.total });
          if (msg.warning) setPlaylistError(msg.warning);
          logInfo("播放清單資訊取得成功", msg);
        }

        if (msg.type === "chunk") {
          const nextItems = (msg.items || []).map((item) => normalizeItem({ ...item, _checked: !item.is_private }));
          setPlaylistItems((prev) => markDuplicates([...prev, ...nextItems]));
          setPlaylistLoadProgress({ loaded: msg.loaded, total: msg.total });
          logInfo("播放清單載入中", { loaded: msg.loaded, total: msg.total });
        }

        if (msg.type === "done") {
          setPlaylistLoadProgress((prev) => ({ loaded: msg.total, total: prev.total || msg.total }));
          logInfo("播放清單查詢完成", { total: msg.total });
        }

        if (msg.type === "error") {
          setPlaylistError(msg.message);
          maybeShowCookieAlert(msg.message);
          logError("播放清單查詢失敗", { url, error: msg.message });
        }
      });
    } catch (error) {
      const message = errorMessage(error);
      setPlaylistError(message);
      maybeShowCookieAlert(message);
      logError("播放清單查詢失敗", { url, error: message });
    } finally {
      setPlaylistLoading(false);
    }
  };

  const processImportFile = async (file: File) => {
    resetQueryResults("import");
    setImportLoading(true);
    setImportMessage("");
    logInfo("開始解析匯入檔案", { name: file.name, size: file.size });

    try {
      const result = await parseImportApi(file);
      if (result.error) {
        setImportMessage(result.error);
        logError("匯入檔案解析失敗", { name: file.name, error: result.error });
        return;
      }

      const items = (result.urls || []).map(makeRawUrlItem);
      setImportItems(markDuplicates(items));
      setImportMessage(`已解析 ${items.length} 個網址，請查詢影片資訊。`);
      logInfo("匯入檔案解析成功", { name: file.name, total: items.length });
    } catch (error) {
      const message = errorMessage(error);
      setImportMessage(message);
      logError("匯入檔案解析失敗", { name: file.name, error: message });
    } finally {
      setImportLoading(false);
    }
  };

  const fetchImportInfo = async () => {
    if (!importItems.length) return;

    const sourceItems = [...importItems];
    resetQueryResults("import");
    setImportLoading(true);
    const nextItems: VideoItem[] = [];
    logInfo("開始查詢匯入影片", { total: sourceItems.length });

    try {
      for (const item of sourceItems) {
        try {
          const info = await fetchInfoApi(item.url);
          if (!info) {
            nextItems.push(item);
            logError("匯入影片查詢失敗", { url: item.url, error: "empty response" });
            continue;
          }
          if (info.error) {
            nextItems.push(item);
            maybeShowCookieAlert(info.error);
            logError("匯入影片查詢失敗", { url: item.url, error: info.error });
          } else if (info.type === "playlist") {
            nextItems.push(...(info.items || []).map((entry) => normalizeItem({ ...entry, _checked: true })));
            logInfo("匯入播放清單查詢成功", { url: item.url, total: info.items?.length || 0 });
          } else {
            nextItems.push(normalizeFetchResult(info, item.url));
            logInfo("匯入影片查詢成功", { url: item.url, title: info.title });
          }
        } catch (error) {
          nextItems.push(item);
          const message = errorMessage(error);
          maybeShowCookieAlert(message);
          logError("匯入影片查詢失敗", { url: item.url, error: message });
        }
      }

      setImportItems(markDuplicates(nextItems));
      setImportMessage(`已載入 ${nextItems.length} 筆影片資訊。`);
      logInfo("匯入影片查詢完成", { total: nextItems.length });
    } catch (error) {
      const message = errorMessage(error);
      setImportMessage(message);
      maybeShowCookieAlert(message);
      logError("匯入影片查詢失敗", message);
    } finally {
      setImportLoading(false);
    }
  };

  const startListDownload = async (tab: ListTabKey, items: VideoItem[], fallbackHint: string) => {
    const chosen = selectedItems(items);
    if (!chosen.length) {
      messageApi.warning("請至少選擇一個影片");
      return;
    }

    try {
      const tabSettings = settings[tab];
      const hint = fallbackHint || downloadTitle(chosen[0]) || "downloads";
      logInfo(`準備下載 [${tabLabels[tab]}]`, {
        total: chosen.length,
        settings: tabSettings,
        items: chosen.map((item) => ({ url: item.url, title: downloadTitle(item) || item.title })),
      });
      const result = await startDownload({
        items: chosen.map((item) => ({
          url: item.url,
          custom_title: downloadTitle(item) || item.title,
          segments: item.segments,
        })),
        media_type: tabSettings.mediaType,
        extension: tabSettings.extension,
        output_dir: tabSettings.outputDir.trim(),
        title_hint: hint,
      });

      startPolling(tab, result.job_id, tabSettings);
    } catch (error) {
      const message = errorMessage(error);
      logError(`下載送出失敗 [${tabLabels[tab]}]`, message);
      maybeShowCookieAlert(message);
      messageApi.error(message);
    }
  };

  const retryFailedDownloads = async (tab: TabKey, items: DownloadItem[]) => {
    if (!items.length) return;

    try {
      const tabSettings = settings[tab];
      const previousOutputDir = jobs[tab].status?.output_dir || tabSettings.outputDir.trim();
      logInfo(`重新下載失敗項目 [${tabLabels[tab]}]`, { items, outputDir: previousOutputDir });
      const result = await startDownload({
        items,
        media_type: tabSettings.mediaType,
        extension: tabSettings.extension,
        output_dir: previousOutputDir,
        title_hint: "retry-failed",
      });
      startPolling(tab, result.job_id, tabSettings);
    } catch (error) {
      const message = errorMessage(error);
      logError(`重新下載送出失敗 [${tabLabels[tab]}]`, message);
      maybeShowCookieAlert(message);
      messageApi.error(message);
    }
  };

  const retryStoredFailures = async (records: FailedDownloadRecord[]) => {
    const groups = new Map<string, FailedDownloadRecord[]>();
    records.forEach((record) => {
      const key = [
        record.tab,
        record.mediaType,
        record.extension,
        record.outputDir,
      ].join("|");
      groups.set(key, [...(groups.get(key) || []), record]);
    });

    for (const group of groups.values()) {
      const first = group[0];
      const retrySettings: DownloadSettings = {
        mediaType: first.mediaType,
        extension: first.extension,
        outputDir: first.outputDir,
      };

      try {
        const result = await startDownload({
          items: group.map((record) => ({
            url: record.url,
            custom_title: record.customTitle || record.title,
            segments: record.segments,
          })),
          media_type: retrySettings.mediaType,
          extension: retrySettings.extension,
          output_dir: retrySettings.outputDir,
          title_hint: "retry-failed",
        });
        group.forEach((record) => removeFailedRecord(record.id));
        startPolling(first.tab, result.job_id, retrySettings);
      } catch (error) {
        const message = errorMessage(error);
        logError(`持久化失敗項目重試送出失敗 [${tabLabels[first.tab]}]`, message);
        maybeShowCookieAlert(message);
        messageApi.error(message);
      }
    }
  };

  const confirmClearFailedRecords = () => {
    modal.confirm({
      title: "清除失敗下載紀錄",
      content: "這會同步移除 store 與 localStorage 中的全部失敗紀錄。",
      okText: "清除",
      okButtonProps: { danger: true },
      cancelText: "取消",
      onOk: clearFailedRecords,
    });
  };

  const resetTabState = (tab: TabKey) => {
    stopPolling(tab);
    setJobs((prev) => ({ ...prev, [tab]: { jobId: null, status: null } }));

    if (tab === "single") {
      setSingleUrl("");
      setSingleInfo(null);
      setSingleError("");
    }

    if (tab === "multi") {
      setMultiText("");
      setMultiItems([]);
      resetFilter("multi");
    }

    if (tab === "playlist") {
      setPlaylistUrl("");
      setPlaylistItems([]);
      setPlaylistMeta(null);
      setPlaylistError("");
      setPlaylistLoadProgress({ loaded: 0, total: 0 });
      resetFilter("playlist");
    }

    if (tab === "import") {
      setImportItems([]);
      setImportMessage("");
      resetFilter("import");
    }
  };

  const resetTab = (tab: TabKey) => {
    modal.confirm({
      title: "重置頁面",
      content: "確定要清除此下載模式的所有資料？",
      okText: "重置",
      cancelText: "取消",
      onOk: () => resetTabState(tab),
    });
  };

  const updateListItem = (tab: ListTabKey, updater: (items: VideoItem[]) => VideoItem[]) => {
    if (tab === "multi") setMultiItems((items) => updater(items));
    if (tab === "playlist") setPlaylistItems((items) => updater(items));
    if (tab === "import") setImportItems((items) => updater(items));
  };

  const toggleItem = (tab: ListTabKey, index: number) => {
    updateListItem(tab, (items) =>
      items.map((item, idx) => {
        if (idx !== index || item.is_private || item._duplicate) return item;
        return { ...item, _checked: !item._checked };
      }),
    );
  };

  const selectAll = (tab: ListTabKey, checked: boolean) => {
    updateListItem(tab, (items) =>
      items.map((item) => (item.is_private || item._duplicate ? item : { ...item, _checked: checked })),
    );
  };

  const updateCustomTitle = (tab: ListTabKey, index: number, customTitle: string) => {
    updateListItem(tab, (items) =>
      items.map((item, idx) => (idx === index ? { ...item, custom_title: customTitle } : item)),
    );
  };

  const updateSingleTitle = (customTitle: string) => {
    setSingleInfo((item) => (item ? { ...item, custom_title: customTitle } : item));
  };

  const convertSingleTitle = async () => {
    const sourceTitle = (singleInfo?.custom_title || singleInfo?.title || "").trim();
    if (!sourceTitle) return;

    try {
      const result = await convertTitles([sourceTitle]);
      const convertedTitle = result.converted[0] || sourceTitle;
      setSingleInfo((item) =>
        item
          ? {
              ...item,
              custom_title: convertedTitle,
              orig_title: convertedTitle !== sourceTitle ? sourceTitle : item.orig_title,
              was_converted: item.was_converted || convertedTitle !== sourceTitle,
            }
          : item,
      );
    } catch (error) {
      logError("單一影片標題轉換失敗", errorMessage(error));
    }
  };

  const updateSegments = (tab: ListTabKey, index: number, segments: DownloadSegment[]) => {
    updateListItem(tab, (items) =>
      items.map((item, idx) => (idx === index ? { ...item, segments } : item)),
    );
  };

  const cancelDownload = async (tab: TabKey) => {
    const jobId = jobs[tab].jobId;
    if (!jobId) return;

    try {
      await cancelJobApi(jobId);
      console.warn(`[YT Downloader] 已送出取消要求 [${tabLabels[tab]}]`, { jobId });
      messageApi.success("已送出取消要求");
    } catch (error) {
      messageApi.error(errorMessage(error));
    }
  };

  const cancelAllDownloads = async () => {
    try {
      const result = await cancelAllJobsApi();
      console.warn("[YT Downloader] 已送出終止所有下載要求", result);
      messageApi.success(`已要求終止 ${result.jobs} 個下載工作`);
    } catch (error) {
      const message = errorMessage(error);
      logError("終止所有下載失敗", message);
      messageApi.error(message);
    }
  };

  const openFolder = async (folder: string) => {
    try {
      await openFolderApi(folder);
    } catch (error) {
      messageApi.error(errorMessage(error));
    }
  };

  const playlistCategories = useMemo(
    () => Array.from(new Set(playlistItems.map((item) => item.category).filter(Boolean))) as string[],
    [playlistItems],
  );
  return (
    <AppShell
      activeTab={activeTab}
      headerActions={
        <>
          <ActionButton size="sm" variant="danger" onClick={() => void cancelAllDownloads()}>
            終止後端工作
          </ActionButton>
          <CookieStatus
            cookie={cookie}
            inputRef={cookieInputRef}
            loading={cookieLoading}
            onDelete={handleCookieDelete}
            onUpload={handleCookieUpload}
          />
        </>
      }
      onTabChange={setActiveTab}
    >
      {activeTab === "single" ? (
        <SingleDownload
          defaultDir={defaultDir}
          error={singleError}
          info={singleInfo}
          job={jobs.single}
          loading={singleLoading}
          onCancel={() => void cancelDownload("single")}
          onFetch={fetchSingleInfo}
          onOpenFolder={(folder) => void openFolder(folder)}
          onReset={() => resetTab("single")}
          onRetryFailed={(items) => void retryFailedDownloads("single", items)}
          onSegmentsChange={(segments) =>
            setSingleInfo((item) => (item ? { ...item, segments } : item))
          }
          onStart={startSingleDownload}
          onTitleBlur={() => void convertSingleTitle()}
          onTitleChange={updateSingleTitle}
          onUrlChange={setSingleUrl}
          settings={settings.single}
          updateMediaType={(mediaType) => updateMediaType("single", mediaType)}
          updateSettings={(patch) => updateSettings("single", patch)}
          url={singleUrl}
        />
      ) : null}

      {activeTab === "multi" ? (
        <MultiDownload
          defaultDir={defaultDir}
          filter={filters.multi}
          items={multiItems}
          job={jobs.multi}
          loading={multiLoading}
          onCancel={() => void cancelDownload("multi")}
          onClearFilter={() => resetFilter("multi")}
          onFetch={fetchMultiInfo}
          onOpenFolder={(folder) => void openFolder(folder)}
          onReset={() => resetTab("multi")}
          onRetryFailed={(items) => void retryFailedDownloads("multi", items)}
          onSelectAll={(checked) => selectAll("multi", checked)}
          onSegmentsChange={(index, segments) => updateSegments("multi", index, segments)}
          onStart={() => void startListDownload("multi", multiItems, "downloads")}
          onTextChange={setMultiText}
          onTitleChange={(index, title) => updateCustomTitle("multi", index, title)}
          onToggle={(index) => toggleItem("multi", index)}
          settings={settings.multi}
          text={multiText}
          updateFilter={(patch) => updateFilter("multi", patch)}
          updateMediaType={(mediaType) => updateMediaType("multi", mediaType)}
          updateSettings={(patch) => updateSettings("multi", patch)}
        />
      ) : null}

      {activeTab === "playlist" ? (
        <PlaylistDownload
          categories={playlistCategories}
          defaultDir={defaultDir}
          error={playlistError}
          filter={filters.playlist}
          items={playlistItems}
          job={jobs.playlist}
          loading={playlistLoading}
          loadProgress={playlistLoadProgress}
          meta={playlistMeta}
          onCancel={() => void cancelDownload("playlist")}
          onClearFilter={() => resetFilter("playlist")}
          onFetch={fetchPlaylistInfo}
          onOpenFolder={(folder) => void openFolder(folder)}
          onReset={() => resetTab("playlist")}
          onRetryFailed={(items) => void retryFailedDownloads("playlist", items)}
          onSelectAll={(checked) => selectAll("playlist", checked)}
          onSegmentsChange={(index, segments) => updateSegments("playlist", index, segments)}
          onStart={() => void startListDownload("playlist", playlistItems, playlistMeta?.title || "playlist")}
          onTitleChange={(index, title) => updateCustomTitle("playlist", index, title)}
          onToggle={(index) => toggleItem("playlist", index)}
          onUrlChange={setPlaylistUrl}
          settings={settings.playlist}
          updateFilter={(patch) => updateFilter("playlist", patch)}
          updateMediaType={(mediaType) => updateMediaType("playlist", mediaType)}
          updateSettings={(patch) => updateSettings("playlist", patch)}
          url={playlistUrl}
        />
      ) : null}

      {activeTab === "import" ? (
        <ImportDownload
          defaultDir={defaultDir}
          dragOver={dragOver}
          filter={filters.import}
          importInputRef={importInputRef}
          items={importItems}
          job={jobs.import}
          loading={importLoading}
          message={importMessage}
          onCancel={() => void cancelDownload("import")}
          onClearFilter={() => resetFilter("import")}
          onDropFile={processImportFile}
          onFetchInfo={fetchImportInfo}
          onOpenFolder={(folder) => void openFolder(folder)}
          onReset={() => resetTab("import")}
          onRetryFailed={(items) => void retryFailedDownloads("import", items)}
          onSelectAll={(checked) => selectAll("import", checked)}
          onSegmentsChange={(index, segments) => updateSegments("import", index, segments)}
          onStart={() => void startListDownload("import", importItems, "imports")}
          onTitleChange={(index, title) => updateCustomTitle("import", index, title)}
          onToggle={(index) => toggleItem("import", index)}
          setDragOver={setDragOver}
          settings={settings.import}
          updateFilter={(patch) => updateFilter("import", patch)}
          updateMediaType={(mediaType) => updateMediaType("import", mediaType)}
          updateSettings={(patch) => updateSettings("import", patch)}
        />
      ) : null}

      <FailedDownloadsPanel
        records={failedRecords}
        onClear={confirmClearFailedRecords}
        onRemove={removeFailedRecord}
        onRetry={(records) => void retryStoredFailures(records)}
      />

      <CookieAlertPopup
        loading={cookieLoading}
        message={cookieAlert?.message || ""}
        open={Boolean(cookieAlert)}
        title={cookieAlert?.title || "Cookie 需要更新"}
        onClose={() => setCookieAlert(null)}
        onUploadClick={() => cookieInputRef.current?.click()}
      />
    </AppShell>
  );
}
