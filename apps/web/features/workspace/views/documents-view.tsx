import { FileCheck2, FileText } from "lucide-react";
import { documentRows } from "@/features/workspace/data/static-demo";

export function DocumentsView() {
  return (
    <section className="viewStack">
      <div className="viewToolbar" aria-label="文書操作">
        <div className="segmentedControl" aria-label="文書分類">
          <button className="active" type="button">共有</button>
          <button type="button">規程</button>
          <button type="button">申請添付</button>
        </div>
        <button className="textButton primary" type="button">
          <FileCheck2 aria-hidden="true" size={17} />
          文書を登録
        </button>
      </div>

      <section className="panel tablePanel" aria-labelledby="document-heading">
        <div className="panelHeader">
          <div>
            <p className="sectionLabel">文書台帳</p>
            <h2 id="document-heading">共有文書</h2>
          </div>
          <FileText aria-hidden="true" className="panelIcon" size={21} />
        </div>
        <div className="dataTable">
          <div className="dataRow heading">
            <span>文書名</span>
            <span>分類</span>
            <span>管理部署</span>
            <span>版</span>
            <span>保管期限</span>
            <span>状態</span>
          </div>
          {documentRows.map((document) => (
            <div className="dataRow" key={document.title}>
              <strong>{document.title}</strong>
              <span>{document.area}</span>
              <span>{document.owner}</span>
              <span>{document.version}</span>
              <span>{document.retention}</span>
              <span className="statusPill open">{document.status}</span>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}
