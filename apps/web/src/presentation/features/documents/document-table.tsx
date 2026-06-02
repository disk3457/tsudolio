import { Eye, FileText, History, Pencil, Trash2 } from "lucide-react";
import { EmptyState } from "@/presentation/components/empty-state";
import type { DocumentSummary } from "@/application/documents/types";
import { allDocumentCategoryKey, type DocumentLoadState } from "./view-types";

type DocumentTableProps = {
  activeCategory: string;
  accessingId: string | null;
  deletingId: string | null;
  documents: DocumentSummary[];
  onAccess: (document: DocumentSummary) => void;
  onDelete: (document: DocumentSummary) => void;
  onEdit: (document: DocumentSummary) => void;
  onToggleHistory: (document: DocumentSummary) => void;
  selectedHistoryDocumentId: string | null;
  status: DocumentLoadState["status"];
};

export function DocumentTable({
  activeCategory,
  accessingId,
  deletingId,
  documents,
  onAccess,
  onDelete,
  onEdit,
  onToggleHistory,
  selectedHistoryDocumentId,
  status,
}: DocumentTableProps) {
  return (
    <section className="panel tablePanel" aria-labelledby="document-heading">
      <div className="panelHeader">
        <div>
          <p className="sectionLabel">文書台帳</p>
          <h2 id="document-heading">
            {activeCategory === allDocumentCategoryKey
              ? "すべての文書"
              : activeCategory}
          </h2>
        </div>
        <FileText aria-hidden="true" className="panelIcon" size={21} />
      </div>

      {status === "loading" && (
        <EmptyState title="取得中" description="文書台帳を確認しています。" />
      )}

      {status !== "loading" && documents.length === 0 && (
        <EmptyState
          title="文書なし"
          description="条件に一致する文書はまだ登録されていません。"
        />
      )}

      {documents.length > 0 && (
        <div className="dataTable documentTable">
          <div className="dataRow heading">
            <span>文書名</span>
            <span>分類</span>
            <span>管理組織</span>
            <span>版</span>
            <span>履歴</span>
            <span>保管期限</span>
            <span>状態</span>
            <span>操作</span>
          </div>
          {documents.map((document) => (
            <div className="dataRow" key={document.id}>
              <strong>{document.title}</strong>
              <span>{document.category}</span>
              <span>{document.organizationUnit?.name ?? "未指定"}</span>
              <span>{document.version}</span>
              <span>{document.versionCount}</span>
              <span>{formatRetention(document.retentionUntil)}</span>
              <span className={`statusPill ${document.tone}`}>
                {document.statusLabel}
              </span>
              <div className="documentActions">
                <button
                  className="iconButton compact"
                  aria-label={`${document.title}のアクセスを記録`}
                  disabled={accessingId === document.id}
                  onClick={() => onAccess(document)}
                  title="アクセス記録"
                  type="button"
                >
                  <Eye aria-hidden="true" size={15} />
                </button>
                <button
                  className={
                    selectedHistoryDocumentId === document.id
                      ? "iconButton compact active"
                      : "iconButton compact"
                  }
                  aria-label={`${document.title}の履歴を表示`}
                  onClick={() => onToggleHistory(document)}
                  title="履歴"
                  type="button"
                >
                  <History aria-hidden="true" size={15} />
                </button>
                <button
                  className="iconButton compact"
                  aria-label={`${document.title}を編集`}
                  onClick={() => onEdit(document)}
                  type="button"
                >
                  <Pencil aria-hidden="true" size={15} />
                </button>
                <button
                  className="iconButton compact danger"
                  aria-label={`${document.title}を削除`}
                  disabled={deletingId === document.id}
                  onClick={() => onDelete(document)}
                  type="button"
                >
                  <Trash2 aria-hidden="true" size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function formatRetention(value: string | null) {
  if (!value) {
    return "常用";
  }

  return new Intl.DateTimeFormat("ja-JP", {
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}
