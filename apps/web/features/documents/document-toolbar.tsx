import { Plus, RefreshCcw } from "lucide-react";
import { allDocumentCategoryKey } from "./view-types";

type DocumentToolbarProps = {
  activeCategory: string;
  categories: string[];
  onActiveCategoryChange: (category: string) => void;
  onOpenCreateForm: () => void;
  onRefresh: () => void;
};

export function DocumentToolbar({
  activeCategory,
  categories,
  onActiveCategoryChange,
  onOpenCreateForm,
  onRefresh,
}: DocumentToolbarProps) {
  return (
    <div className="viewToolbar" aria-label="文書操作">
      <div className="segmentedControl" aria-label="文書分類">
        <button
          className={activeCategory === allDocumentCategoryKey ? "active" : ""}
          onClick={() => onActiveCategoryChange(allDocumentCategoryKey)}
          type="button"
        >
          すべて
        </button>
        {categories.map((category) => (
          <button
            className={activeCategory === category ? "active" : ""}
            key={category}
            onClick={() => onActiveCategoryChange(category)}
            type="button"
          >
            {category}
          </button>
        ))}
      </div>
      <div className="toolbarActions">
        <button
          className="iconButton"
          aria-label="文書を再読み込み"
          onClick={onRefresh}
          type="button"
        >
          <RefreshCcw aria-hidden="true" size={18} />
        </button>
        <button
          className="textButton primary"
          onClick={onOpenCreateForm}
          type="button"
        >
          <Plus aria-hidden="true" size={17} />
          文書を登録
        </button>
      </div>
    </div>
  );
}
