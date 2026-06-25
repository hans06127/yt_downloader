import type { FetchInfoResult, FilterState, VideoItem } from "@/lib/types";

export function parseUrls(text: string) {
  const urls = text
    .split(/\r?\n/)
    .flatMap((line) => line.split(";"))
    .map((value) => value.trim())
    .filter(Boolean);

  return Array.from(new Set(urls));
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function normalizeItem(input: Partial<VideoItem>, fallbackUrl = ""): VideoItem {
  const title = input.title || fallbackUrl || "Untitled";
  const isPrivate = Boolean(input.is_private);

  return {
    id: input.id || input.url || fallbackUrl || title,
    title,
    orig_title: input.orig_title || title,
    was_converted: Boolean(input.was_converted),
    custom_title: input.custom_title || "",
    url: input.url || fallbackUrl,
    duration: typeof input.duration === "number" ? input.duration : null,
    duration_str: input.duration_str || "Unknown",
    category: input.category ?? null,
    uploader: input.uploader || "",
    lang: input.lang || "other",
    is_private: isPrivate,
    segments: input.segments || [],
    _checked: input._checked ?? !isPrivate,
    _duplicate: Boolean(input._duplicate),
  };
}

export function normalizeFetchResult(info: FetchInfoResult, fallbackUrl: string) {
  return normalizeItem(
    {
      id: info.url || fallbackUrl,
      title: info.title,
      orig_title: info.orig_title || info.title,
      was_converted: info.was_converted,
      custom_title: info.title,
      url: info.url || fallbackUrl,
      duration: info.duration ?? null,
      duration_str: info.duration_str || "Unknown",
      category: info.category ?? null,
      uploader: info.uploader || "",
      lang: info.lang || "other",
      is_private: info.is_private ?? false,
      _checked: true,
    },
    fallbackUrl,
  );
}

export function markDuplicates(items: VideoItem[]) {
  const seen = new Set<string>();

  return items.map((item) => {
    const key = (item.title || item.url).trim().toLowerCase();
    const duplicate = Boolean(key && seen.has(key));
    if (key && !duplicate) seen.add(key);

    return {
      ...item,
      _duplicate: duplicate,
      _checked: duplicate || item.is_private ? false : item._checked,
    };
  });
}

export function matchesFilter(item: VideoItem, filter: FilterState) {
  const minutes = item.duration ? item.duration / 60 : 0;
  const minOk = filter.minDuration === null || minutes >= filter.minDuration;
  const maxOk = filter.maxDuration === null || minutes <= filter.maxDuration;
  const langOk = !filter.lang || item.lang === filter.lang;
  const categoryOk = !filter.category || item.category === filter.category;

  return minOk && maxOk && langOk && categoryOk;
}

export function selectedItems(items: VideoItem[]) {
  return items.filter((item) => item._checked && !item._duplicate && !item.is_private);
}

export function downloadTitle(item: VideoItem) {
  return (item.custom_title || item.title).trim();
}

export function makeRawUrlItem(url: string): VideoItem {
  return normalizeItem({
    id: url,
    title: url,
    orig_title: url,
    custom_title: "",
    url,
    duration: null,
    duration_str: "待查詢",
    lang: "other",
    _checked: true,
  });
}
