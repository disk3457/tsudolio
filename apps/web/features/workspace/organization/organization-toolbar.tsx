import { Plus, RefreshCcw, UserPlus } from "lucide-react";
import type { ActivePanel } from "./types";

type OrganizationToolbarProps = {
  activePanel: ActivePanel;
  onActivePanelChange: (panel: ActivePanel) => void;
  onOpenUnitForm: () => void;
  onOpenUserForm: () => void;
  onRefresh: () => void;
};

export function OrganizationToolbar({
  activePanel,
  onActivePanelChange,
  onOpenUnitForm,
  onOpenUserForm,
  onRefresh,
}: OrganizationToolbarProps) {
  return (
    <div className="viewToolbar" aria-label="組織操作">
      <div className="segmentedControl" aria-label="表示対象">
        <button
          className={activePanel === "units" ? "active" : ""}
          onClick={() => onActivePanelChange("units")}
          type="button"
        >
          組織
        </button>
        <button
          className={activePanel === "users" ? "active" : ""}
          onClick={() => onActivePanelChange("users")}
          type="button"
        >
          利用者
        </button>
      </div>
      <div className="toolbarActions">
        <button
          className="iconButton"
          aria-label="組織データを再読み込み"
          onClick={onRefresh}
          type="button"
        >
          <RefreshCcw aria-hidden="true" size={18} />
        </button>
        <button className="textButton" onClick={onOpenUnitForm} type="button">
          <Plus aria-hidden="true" size={17} />
          組織
        </button>
        <button
          className="textButton primary"
          onClick={onOpenUserForm}
          type="button"
        >
          <UserPlus aria-hidden="true" size={17} />
          利用者
        </button>
      </div>
    </div>
  );
}
