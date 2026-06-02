import { History, ShieldCheck, X } from "lucide-react";
import type {
  DocumentAccessSummary,
  DocumentSummary,
} from "@/application/documents/types";

type DocumentAccessPanelProps = {
  access: DocumentAccessSummary | null;
  onClose: () => void;
};

type DocumentHistoryPanelProps = {
  document: DocumentSummary | null;
  onClose: () => void;
};

export function DocumentAccessPanel({
  access,
  onClose,
}: DocumentAccessPanelProps) {
  if (!access) {
    return null;
  }

  return (
    <section className="panel documentAccessPanel" aria-label="文書アクセス記録">
      <div className="panelHeader compact">
        <div>
          <p className="sectionLabel">アクセス記録</p>
          <h2>{access.title}</h2>
        </div>
        <button
          className="iconButton"
          aria-label="アクセス記録を閉じる"
          onClick={onClose}
          type="button"
        >
          <X aria-hidden="true" size={18} />
        </button>
      </div>

      <div className="documentAccessBody">
        <ShieldCheck aria-hidden="true" size={22} />
        <div>
          <strong>{access.filename}</strong>
          <p>
            {access.version} のアクセスを {formatDateTime(access.accessedAt)}{" "}
            に監査ログへ記録しました。
          </p>
          <code>{access.storageKey}</code>
        </div>
      </div>
    </section>
  );
}

export function DocumentHistoryPanel({
  document,
  onClose,
}: DocumentHistoryPanelProps) {
  if (!document) {
    return null;
  }

  return (
    <section className="panel documentHistoryPanel" aria-labelledby="document-history-heading">
      <div className="panelHeader compact">
        <div>
          <p className="sectionLabel">版履歴</p>
          <h2 id="document-history-heading">{document.title}</h2>
        </div>
        <button
          className="iconButton"
          aria-label="版履歴を閉じる"
          onClick={onClose}
          type="button"
        >
          <X aria-hidden="true" size={18} />
        </button>
      </div>

      <div className="documentVersionList">
        {document.versions.map((version) => (
          <article className="documentVersionItem" key={version.id}>
            <History aria-hidden="true" size={17} />
            <div>
              <div className="documentVersionHeading">
                <strong>{version.version}</strong>
                <span className={`statusPill ${version.tone}`}>
                  {version.statusLabel}
                </span>
              </div>
              <p>{version.changeNote ?? "履歴を記録"}</p>
              <dl className="documentVersionMeta">
                <div>
                  <dt>記録者</dt>
                  <dd>{version.createdBy.name}</dd>
                </div>
                <div>
                  <dt>管理組織</dt>
                  <dd>{version.organizationUnit?.name ?? "未指定"}</dd>
                </div>
                <div>
                  <dt>記録日時</dt>
                  <dd>{formatDateTime(version.createdAt)}</dd>
                </div>
                <div>
                  <dt>保管期限</dt>
                  <dd>{formatRetention(version.retentionUntil)}</dd>
                </div>
              </dl>
              <code>{version.storageKey}</code>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
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
