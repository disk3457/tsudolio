import { Plus, RefreshCw } from "lucide-react";
import type { NoticeFilterKey } from "@/presentation/features/notices/view-types";

const filterOptions: Array<{ key: NoticeFilterKey; label: string }> = [
  { key: "all", label: "すべて" },
  { key: "active", label: "掲載中" },
  { key: "ack", label: "確認必須" },
  { key: "unacked", label: "未確認" },
];

type NoticeToolbarProps = {
  activeFilter: NoticeFilterKey;
  canManage: boolean;
  onActiveFilterChange: (filter: NoticeFilterKey) => void;
  onOpenCreateForm: () => void;
  onRefresh: () => void;
};

export function NoticeToolbar({
  activeFilter,
  canManage,
  onActiveFilterChange,
  onOpenCreateForm,
  onRefresh,
}: NoticeToolbarProps) {
  return (
    <div className="viewToolbar">
      <div className="segmentedControl" aria-label="掲示フィルター">
        {filterOptions.map((option) => (
          <button
            className={activeFilter === option.key ? "active" : ""}
            key={option.key}
            onClick={() => onActiveFilterChange(option.key)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="toolbarActions">
        <button className="iconButton" aria-label="掲示を再読み込み" onClick={onRefresh} type="button">
          <RefreshCw aria-hidden="true" size={17} />
        </button>
        {canManage && (
          <button className="textButton primary" onClick={onOpenCreateForm} type="button">
            <Plus aria-hidden="true" size={17} />
            新規掲示
          </button>
        )}
      </div>
    </div>
  );
}
