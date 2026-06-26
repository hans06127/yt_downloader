import type { ReactNode } from "react";
import FilterBar from "@/components/download/FilterBar";
import MediaTools from "@/components/download/MediaTools";
import ActionButton from "@/components/ui/ActionButton";
import { matchesFilter, selectedItems } from "@/lib/download/items";
import type { DownloadSegment, FilterState, MediaType, VideoItem } from "@/lib/types";

interface VideoListProps {
  categories?: string[];
  extraFilterAction?: ReactNode;
  filter: FilterState;
  items: VideoItem[];
  mediaType: MediaType;
  showCategoryFilter?: boolean;
  onClearFilter: () => void;
  onSelectAll: (checked: boolean) => void;
  onSegmentsChange: (index: number, segments: DownloadSegment[]) => void;
  onTitleChange: (index: number, title: string) => void;
  onToggle: (index: number) => void;
  updateFilter: (patch: Partial<FilterState>) => void;
}

export default function VideoList({
  categories = [],
  extraFilterAction,
  filter,
  items,
  mediaType,
  onClearFilter,
  onSelectAll,
  onSegmentsChange,
  onTitleChange,
  onToggle,
  showCategoryFilter = false,
  updateFilter,
}: VideoListProps) {
  const visibleItems = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => matchesFilter(item, filter));
  const selectedCount = selectedItems(items).length;

  return (
    <section className="card">
      <div className="card-title">影片清單</div>
      <FilterBar
        categories={categories}
        extraAction={extraFilterAction}
        filter={filter}
        onChange={updateFilter}
        onClear={onClearFilter}
        showCategoryFilter={showCategoryFilter}
      />
      <div className="select-bar">
        <ActionButton size="sm" onClick={() => onSelectAll(true)}>
          全選
        </ActionButton>
        <ActionButton size="sm" onClick={() => onSelectAll(false)}>
          取消全選
        </ActionButton>
        <span className="count-badge">
          {selectedCount} / {items.length} 已選
        </span>
      </div>
      <div className="video-list">
        {visibleItems.map(({ item, index }) => (
          <VideoRow
            item={item}
            key={`${item.id}-${index}`}
            mediaType={mediaType}
            onSegmentsChange={(segments) => onSegmentsChange(index, segments)}
            onTitleChange={(title) => onTitleChange(index, title)}
            onToggle={() => onToggle(index)}
          />
        ))}
      </div>
    </section>
  );
}

function VideoRow({
  item,
  mediaType,
  onSegmentsChange,
  onTitleChange,
  onToggle,
}: {
  item: VideoItem;
  mediaType: MediaType;
  onSegmentsChange: (segments: DownloadSegment[]) => void;
  onTitleChange: (title: string) => void;
  onToggle: () => void;
}) {
  const disabled = item.is_private || item._duplicate;
  const langClass = item.lang === "zh-TW" ? "lang-tw" : item.lang === "zh-CN" ? "lang-cn" : "";

  return (
    <div
      className={`video-item ${item._checked && !disabled ? "selected" : ""} ${
        item.is_private ? "private" : item._duplicate ? "duplicate" : ""
      }`}
      onClick={() => {
        if (!disabled) onToggle();
      }}
    >
      <input
        checked={item._checked && !disabled}
        disabled={disabled}
        type="checkbox"
        onChange={onToggle}
        onClick={(event) => event.stopPropagation()}
      />
      <div className="video-title">
        <input
          className={`title-input ${item.was_converted ? "title-converted" : ""}`}
          disabled={disabled}
          value={item.custom_title || item.title}
          onChange={(event) => onTitleChange(event.target.value)}
          onClick={(event) => event.stopPropagation()}
        />
      </div>
      {item.category ? <span className="video-cat">{item.category}</span> : null}
      {item.lang !== "other" ? <span className={langClass}>{item.lang === "zh-TW" ? "繁" : "簡"}</span> : null}
      {item._duplicate ? <span className="dup-badge">重複</span> : null}
      <span className="video-dur">{item.duration_str}</span>
      <MediaTools item={item} mediaType={mediaType} onSegmentsChange={onSegmentsChange} />
    </div>
  );
}
