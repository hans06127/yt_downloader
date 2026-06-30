export interface CurrentVideoUrlResult {
  changed: boolean;
  url: string;
}

export function normalizeCurrentVideoUrl(input: string): CurrentVideoUrlResult {
  const trimmed = input.trim();
  if (!trimmed) return { changed: false, url: input };

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.replace(/^www\./, "");
    const videoId = parsed.searchParams.get("v");
    const hasPlaylist = parsed.searchParams.has("list");

    if (!hasPlaylist || !videoId || host !== "youtube.com" || parsed.pathname !== "/watch") {
      return { changed: false, url: input };
    }

    parsed.searchParams.delete("list");
    parsed.searchParams.delete("index");
    parsed.searchParams.delete("start_radio");

    return { changed: parsed.toString() !== trimmed, url: parsed.toString() };
  } catch {
    return { changed: false, url: input };
  }
}

export function normalizeCurrentVideoUrls(urls: string[]) {
  let changedCount = 0;
  const normalized = urls.map((url) => {
    const result = normalizeCurrentVideoUrl(url);
    if (result.changed) changedCount += 1;
    return result.url;
  });

  return { changedCount, urls: normalized };
}
