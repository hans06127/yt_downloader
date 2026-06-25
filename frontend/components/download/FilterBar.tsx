import type { ReactNode } from "react";
import ActionButton from "@/components/ui/ActionButton";
import type { FilterState, Lang } from "@/lib/types";

interface FilterBarProps {
  categories?: string[];
  extraAction?: ReactNode;
  filter: FilterState;
  showCategoryFilter?: boolean;
  onClear: () => void;
  onChange: (patch: Partial<FilterState>) => void;
}

export default function FilterBar({
  categories = [],
  extraAction,
  filter,
  onChange,
  onClear,
  showCategoryFilter = false,
}: FilterBarProps) {
  return (
    <div className="filter-bar">
      <label>時長篩選（分鐘）</label>
      <input
        min="0"
        placeholder="最短"
        step="0.1"
        type="number"
        value={filter.minDuration ?? ""}
        onChange={(event) => onChange({ minDuration: event.target.value ? Number(event.target.value) : null })}
      />
      <span className="text-muted">~</span>
      <input
        min="0"
        placeholder="最長"
        step="0.1"
        type="number"
        value={filter.maxDuration ?? ""}
        onChange={(event) => onChange({ maxDuration: event.target.value ? Number(event.target.value) : null })}
      />
      {showCategoryFilter ? (
        <>
          <label>類型</label>
          <select value={filter.category} onChange={(event) => onChange({ category: event.target.value })}>
            <option value="">全部類型</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </>
      ) : null}
      <label>語言</label>
      <select value={filter.lang} onChange={(event) => onChange({ lang: event.target.value as Lang | "" })}>
        <option value="">全部語言</option>
        <option value="zh-TW">繁體中文</option>
        <option value="zh-CN">簡體中文</option>
        <option value="other">其他/未知</option>
      </select>
      {extraAction}
      <ActionButton size="sm" onClick={onClear}>
        清除篩選
      </ActionButton>
    </div>
  );
}
