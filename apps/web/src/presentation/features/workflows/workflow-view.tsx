"use client";

import {
  AlertCircle,
  Check,
  Clock3,
  ClipboardCheck,
  FilePlus2,
  FileCheck2,
  FileText,
  Plus,
  RefreshCcw,
  RotateCcw,
  X,
} from "lucide-react";
import type { WorkflowRequestSummary } from "@/application/workflows/types";
import { EmptyState } from "@/presentation/components/empty-state";
import { useWorkflowApprovals } from "@/presentation/features/workflows/use-workflow-approvals";
import type { WorkflowTab } from "@/presentation/features/workflows/view-types";
import { WorkflowForm } from "@/presentation/features/workflows/workflow-form";
import {
  formatDateTime,
  formatDue,
  formatNumber,
  getPriorityMeta,
} from "@/shared/formatters";

const tabOptions: Array<{ key: WorkflowTab; label: string }> = [
  { key: "pending", label: "承認待ち" },
  { key: "mine", label: "自分の申請" },
  { key: "recent", label: "処理済み" },
];

export function WorkflowView() {
  const {
    activeTab,
    closeForm,
    decidingId,
    formState,
    handleCreateRequest,
    handleDecision,
    loadWorkflows,
    myRequests,
    openCreateForm,
    recentRequests,
    savingAction,
    setActiveTab,
    updateForm,
    visibleRequests,
    workflowState,
  } = useWorkflowApprovals();
  const snapshot = workflowState.snapshot;
  const timezone = snapshot?.tenant.timezone ?? "Asia/Tokyo";

  return (
    <section className="viewStack">
      <div className="viewToolbar" aria-label="申請承認操作">
        <div className="segmentedControl" aria-label="申請表示">
          {tabOptions.map((option) => (
            <button
              className={activeTab === option.key ? "active" : ""}
              key={option.key}
              onClick={() => setActiveTab(option.key)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="toolbarActions">
          <button
            className="iconButton"
            aria-label="申請を再読み込み"
            onClick={() => void loadWorkflows()}
            type="button"
          >
            <RefreshCcw aria-hidden="true" size={18} />
          </button>
          <button
            className="textButton primary"
            onClick={openCreateForm}
            type="button"
          >
            <Plus aria-hidden="true" size={17} />
            申請を作成
          </button>
        </div>
      </div>

      {workflowState.message && (
        <div className="viewAlert" role="alert">
          <AlertCircle aria-hidden="true" size={18} />
          <p>{workflowState.message}</p>
        </div>
      )}

      <WorkflowForm
        categories={snapshot?.categories ?? ["その他"]}
        form={formState}
        onCancel={closeForm}
        onSubmit={(action) => void handleCreateRequest(action)}
        onUpdateField={updateForm}
        organizationUnits={snapshot?.organizationUnits ?? []}
        savingAction={savingAction}
      />

      <section className="workflowStats" aria-label="申請承認の状態">
        <article>
          <ClipboardCheck aria-hidden="true" size={22} />
          <div>
            <span>承認待ち</span>
            <strong>{formatNumber(snapshot?.stats.pending ?? 0)}</strong>
          </div>
        </article>
        <article>
          <Clock3 aria-hidden="true" size={22} />
          <div>
            <span>期限超過</span>
            <strong>{formatNumber(snapshot?.stats.overdue ?? 0)}</strong>
          </div>
        </article>
        <article>
          <AlertCircle aria-hidden="true" size={22} />
          <div>
            <span>重要</span>
            <strong>{formatNumber(snapshot?.stats.highPriority ?? 0)}</strong>
          </div>
        </article>
        <article>
          <FileCheck2 aria-hidden="true" size={22} />
          <div>
            <span>本日処理</span>
            <strong>{formatNumber(snapshot?.stats.decidedToday ?? 0)}</strong>
          </div>
        </article>
        <article>
          <FileText aria-hidden="true" size={22} />
          <div>
            <span>下書き</span>
            <strong>{formatNumber(snapshot?.stats.myDrafts ?? 0)}</strong>
          </div>
        </article>
      </section>

      <section className="workflowBoard">
        <section className="panel workflowQueuePanel" aria-labelledby="workflow-list-heading">
          <div className="panelHeader">
            <div>
              <p className="sectionLabel">
                {activeTab === "pending"
                  ? "待ち行列"
                  : activeTab === "mine"
                    ? "申請控え"
                    : "処理履歴"}
              </p>
              <h2 id="workflow-list-heading">
                {activeTab === "pending"
                  ? "承認待ち申請"
                  : activeTab === "mine"
                    ? "自分の申請"
                    : "処理済み申請"}
              </h2>
            </div>
            <span className="statusPill wait">
              {formatNumber(visibleRequests.length)} 件
            </span>
          </div>
          <div className="workflowRequestList">
            {workflowState.status === "loading" && (
              <EmptyState title="取得中" description="申請データを確認しています。" />
            )}
            {workflowState.status !== "loading" && visibleRequests.length === 0 && (
              <EmptyState
                title={
                  activeTab === "pending"
                    ? "承認待ちはありません"
                    : activeTab === "mine"
                      ? "自分の申請はありません"
                      : "処理済み申請はありません"
                }
                description="決裁が必要な申請が入るとここに表示されます。"
              />
            )}
            {visibleRequests.map((request) => (
              <WorkflowRequestCard
                canApprove={activeTab === "pending" && (snapshot?.canApprove ?? false)}
                deciding={decidingId === request.id}
                key={request.id}
                onDecision={(status) => void handleDecision(request, status)}
                request={request}
                timezone={timezone}
              />
            ))}
          </div>
        </section>

        <aside className="panel workflowHistoryPanel" aria-labelledby="workflow-recent-heading">
          <div className="panelHeader compact">
            <div>
              <p className="sectionLabel">直近</p>
              <h2 id="workflow-recent-heading">決裁済み</h2>
            </div>
            <FileCheck2 aria-hidden="true" className="panelIcon" size={20} />
          </div>
          <div className="workflowHistoryList">
            {workflowState.status === "loading" && (
              <EmptyState title="取得中" description="処理履歴を確認しています。" />
            )}
            {workflowState.status !== "loading" && recentRequests.length === 0 && (
              <EmptyState
                title="処理履歴なし"
                description="承認、却下、差し戻しの履歴がここに並びます。"
              />
            )}
            {recentRequests.map((request) => (
              <article className="workflowHistoryItem" key={request.id}>
                <span className={`workflowStatus ${request.tone}`}>
                  {request.statusLabel}
                </span>
                <div>
                  <h3>{request.title}</h3>
                  <p>
                    {request.decidedAt
                      ? formatDateTime(request.decidedAt, timezone)
                      : "処理日時なし"}
                  </p>
                </div>
              </article>
            ))}
          </div>
          <div className="workflowHistoryList workflowMyList">
            <div className="panelHeader compact">
              <div>
                <p className="sectionLabel">作成</p>
                <h2>自分の申請</h2>
              </div>
              <FilePlus2 aria-hidden="true" className="panelIcon" size={20} />
            </div>
            {workflowState.status !== "loading" && myRequests.length === 0 && (
              <EmptyState
                title="申請なし"
                description="作成した申請がここに並びます。"
              />
            )}
            {myRequests.slice(0, 4).map((request) => (
              <article className="workflowHistoryItem" key={request.id}>
                <span className={`workflowStatus ${request.tone}`}>
                  {request.statusLabel}
                </span>
                <div>
                  <h3>{request.title}</h3>
                  <p>{request.category}</p>
                </div>
              </article>
            ))}
          </div>
        </aside>
      </section>
    </section>
  );
}

function WorkflowRequestCard({
  canApprove,
  deciding,
  onDecision,
  request,
  timezone,
}: {
  canApprove: boolean;
  deciding: boolean;
  onDecision: (status: "APPROVED" | "REJECTED" | "RETURNED") => void;
  request: WorkflowRequestSummary;
  timezone: string;
}) {
  const priority = getPriorityMeta(request.priority);
  const isActionable = canApprove && request.status === "PENDING";

  return (
    <article className={`workflowRequestCard ${request.tone}`}>
      <div className="workflowRequestHeader">
        <div>
          <span className={`workflowStatus ${request.tone}`}>
            {request.statusLabel}
          </span>
          <span className={`riskBadge ${priority.level}`}>
            {request.priorityLabel}
          </span>
          {request.isOverdue && <span className="workflowOverdue">期限超過</span>}
        </div>
        <span className="workflowCategory">{request.category}</span>
      </div>

      <div className="workflowRequestBody">
        <h3>{request.title}</h3>
        <p>
          {request.organizationUnit?.name ?? "組織未指定"} /{" "}
          {request.requester.name}
        </p>
        {request.description && <p>{request.description}</p>}
      </div>

      <dl className="workflowMeta">
        <div>
          <dt>提出</dt>
          <dd>
            {request.submittedAt
              ? formatDateTime(request.submittedAt, timezone)
              : "未提出"}
          </dd>
        </div>
        <div>
          <dt>期限</dt>
          <dd>{formatDue(request.dueAt, timezone)}</dd>
        </div>
      </dl>

      {isActionable && (
        <div className="workflowDecisionActions" aria-label={`${request.title}の決裁`}>
          <button
            className="textButton primary"
            disabled={deciding}
            onClick={() => onDecision("APPROVED")}
            type="button"
          >
            <Check aria-hidden="true" size={16} />
            {deciding ? "処理中" : "承認"}
          </button>
          <button
            className="textButton"
            disabled={deciding}
            onClick={() => onDecision("RETURNED")}
            type="button"
          >
            <RotateCcw aria-hidden="true" size={16} />
            差し戻し
          </button>
          <button
            className="textButton danger"
            disabled={deciding}
            onClick={() => onDecision("REJECTED")}
            type="button"
          >
            <X aria-hidden="true" size={16} />
            却下
          </button>
        </div>
      )}
    </article>
  );
}
