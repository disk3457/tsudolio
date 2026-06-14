import { OperationsApplicationError } from "@/application/operations/errors";
import {
  operationsBackupDataSetDefinitions,
  tenantTypeValues,
  type OperationImportIssue,
  type OperationsImportCandidate,
  type OperationsRestoreDryRunInput,
  type OperationsRestoreMode,
  type OperationsRestoreRequestInput,
  type TenantProfileInput,
  type TenantTypeValue,
} from "@/application/operations/types";

const tenantTypes = new Set<string>(tenantTypeValues);

export function parseTenantProfileInput(body: unknown): TenantProfileInput {
  if (!isRecord(body)) {
    throw new OperationsApplicationError(
      "INVALID_JSON",
      "テナント設定データの形式が正しくありません。",
    );
  }

  const timezone = readRequiredText(body.timezone, "タイムゾーン", 80);

  if (!isValidTimeZone(timezone)) {
    throw new OperationsApplicationError(
      "INVALID_FIELD",
      "タイムゾーンの形式が正しくありません。",
    );
  }

  return {
    name: readRequiredText(body.name, "正式名称", 160),
    displayName: readOptionalText(body.displayName, "表示名", 160),
    type: readTenantType(body.type),
    timezone,
  };
}

export function parseOperationsImportCandidate(
  body: unknown,
): OperationsImportCandidate {
  if (!isRecord(body)) {
    throw new OperationsApplicationError(
      "INVALID_JSON",
      "運用エクスポートJSONの形式が正しくありません。",
    );
  }

  const validationIssues: OperationImportIssue[] = [];
  const schemaVersion = readImportInteger(body.schemaVersion);
  const exportedAt = readImportDate(body.exportedAt);
  const tenant = readImportTenant(body.tenant, validationIssues);
  const counts = readImportCounts(body.counts, validationIssues);
  const { data, unknownDataKeys } = readImportData(
    body.data,
    validationIssues,
  );

  if (schemaVersion === null) {
    validationIssues.push({
      detail: "schemaVersion が数値で定義されていません。",
      key: "schema-version-missing",
      label: "Schema version",
      severity: "ERROR",
    });
  } else if (schemaVersion !== 1) {
    validationIssues.push({
      detail: `このアプリが検査できる schemaVersion は 1 です。指定値: ${schemaVersion}`,
      key: "schema-version-unsupported",
      label: "Schema version",
      severity: "ERROR",
    });
  }

  if (!exportedAt) {
    validationIssues.push({
      detail: "exportedAt が有効な日時として定義されていません。",
      key: "exported-at-missing",
      label: "Exported at",
      severity: "ERROR",
    });
  }

  for (const definition of operationsBackupDataSetDefinitions) {
    const declaredCount = counts[definition.key];
    const incomingCount = data[definition.key]?.length ?? 0;

    if (declaredCount === undefined) {
      validationIssues.push({
        detail: `counts.${definition.key} が見つかりません。`,
        key: `${definition.key}-count-missing`,
        label: definition.label,
        severity: "ERROR",
      });
      continue;
    }

    if (declaredCount !== incomingCount) {
      validationIssues.push({
        detail: `宣言件数 ${declaredCount} 件と data 配列 ${incomingCount} 件が一致しません。`,
        key: `${definition.key}-count-mismatch`,
        label: definition.label,
        severity: "ERROR",
      });
    }
  }

  return {
    counts,
    data,
    exportedAt,
    schemaVersion,
    tenant,
    unknownDataKeys,
    validationIssues,
  };
}

export function parseOperationsRestoreDryRunInput(
  body: unknown,
): OperationsRestoreDryRunInput {
  const input = parseOperationsRestoreInput(body);

  if (input.mode !== "DRY_RUN") {
    throw new OperationsApplicationError(
      "UNSUPPORTED_RESTORE_MODE",
      "現時点では復元の dry-run のみ実行できます。",
    );
  }

  return input;
}

export function parseOperationsRestoreInput(
  body: unknown,
): OperationsRestoreRequestInput {
  if (!isRecord(body)) {
    throw new OperationsApplicationError(
      "INVALID_JSON",
      "復元リクエストJSONの形式が正しくありません。",
    );
  }

  const mode = readRestoreMode(body.mode);

  if (!isRecord(body.backup)) {
    throw new OperationsApplicationError(
      "RESTORE_BACKUP_REQUIRED",
      "復元対象の運用エクスポートJSONを指定してください。",
    );
  }

  if (!isRecord(body.currentBackup)) {
    throw new OperationsApplicationError(
      "CURRENT_BACKUP_REQUIRED",
      "復元前に取得した現行バックアップJSONを指定してください。",
    );
  }

  const input = {
    backup: parseOperationsImportCandidate(body.backup),
    confirmationToken: readRequiredText(body.confirmationToken, "確認トークン", 120),
    currentBackup: parseOperationsImportCandidate(body.currentBackup),
  };

  if (mode === "DRY_RUN") {
    return {
      ...input,
      mode: "DRY_RUN",
    };
  }

  return {
    ...input,
    mode: "EXECUTE",
  };
}

function readRestoreMode(value: unknown): OperationsRestoreMode {
  if (value === "DRY_RUN" || value === "EXECUTE") {
    return value;
  }

  throw new OperationsApplicationError(
    "UNSUPPORTED_RESTORE_MODE",
    "復元モードは DRY_RUN または EXECUTE を指定してください。",
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRequiredText(value: unknown, label: string, maxLength: number) {
  if (typeof value !== "string") {
    throw new OperationsApplicationError(
      "INVALID_FIELD",
      `${label}を入力してください。`,
    );
  }

  const text = value.trim();

  if (!text) {
    throw new OperationsApplicationError(
      "INVALID_FIELD",
      `${label}を入力してください。`,
    );
  }

  if (text.length > maxLength) {
    throw new OperationsApplicationError(
      "INVALID_FIELD",
      `${label}は${maxLength}文字以内で入力してください。`,
    );
  }

  return text;
}

function readOptionalText(
  value: unknown,
  label: string,
  maxLength: number,
) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new OperationsApplicationError(
      "INVALID_FIELD",
      `${label}の形式が正しくありません。`,
    );
  }

  const text = value.trim();

  if (!text) {
    return null;
  }

  if (text.length > maxLength) {
    throw new OperationsApplicationError(
      "INVALID_FIELD",
      `${label}は${maxLength}文字以内で入力してください。`,
    );
  }

  return text;
}

function readTenantType(value: unknown): TenantTypeValue {
  if (typeof value !== "string" || !tenantTypes.has(value)) {
    throw new OperationsApplicationError(
      "INVALID_FIELD",
      "テナント種別の形式が正しくありません。",
    );
  }

  return value as TenantTypeValue;
}

function readImportTenant(
  value: unknown,
  validationIssues: OperationImportIssue[],
): OperationsImportCandidate["tenant"] {
  const tenant = {
    code: null,
    displayName: null,
    name: null,
    timezone: null,
    type: null,
  } satisfies OperationsImportCandidate["tenant"];

  if (!isRecord(value)) {
    validationIssues.push({
      detail: "tenant オブジェクトが見つかりません。",
      key: "tenant-missing",
      label: "Tenant",
      severity: "ERROR",
    });

    return tenant;
  }

  return {
    code: readImportText(value.code, {
      issueKey: "tenant-code-missing",
      label: "Tenant code",
      maxLength: 64,
      required: true,
      validationIssues,
    }),
    displayName: readImportText(value.displayName, {
      issueKey: "tenant-display-name-invalid",
      label: "Tenant display name",
      maxLength: 160,
      required: false,
      validationIssues,
    }),
    name: readImportText(value.name, {
      issueKey: "tenant-name-missing",
      label: "Tenant name",
      maxLength: 160,
      required: true,
      validationIssues,
    }),
    timezone: readImportTimeZone(value.timezone, validationIssues),
    type: readImportTenantType(value.type, validationIssues),
  };
}

function readImportText(
  value: unknown,
  options: {
    issueKey: string;
    label: string;
    maxLength: number;
    required: boolean;
    validationIssues: OperationImportIssue[];
  },
) {
  if (value === undefined || value === null || value === "") {
    if (options.required) {
      options.validationIssues.push({
        detail: `${options.label} が定義されていません。`,
        key: options.issueKey,
        label: options.label,
        severity: "ERROR",
      });
    }

    return null;
  }

  if (typeof value !== "string") {
    options.validationIssues.push({
      detail: `${options.label} の形式が正しくありません。`,
      key: options.issueKey,
      label: options.label,
      severity: "ERROR",
    });

    return null;
  }

  const text = value.trim();

  if (!text && options.required) {
    options.validationIssues.push({
      detail: `${options.label} が空です。`,
      key: options.issueKey,
      label: options.label,
      severity: "ERROR",
    });
  }

  if (text.length > options.maxLength) {
    options.validationIssues.push({
      detail: `${options.label} は ${options.maxLength} 文字以内である必要があります。`,
      key: options.issueKey,
      label: options.label,
      severity: "ERROR",
    });

    return null;
  }

  return text || null;
}

function readImportTimeZone(
  value: unknown,
  validationIssues: OperationImportIssue[],
) {
  const timezone = readImportText(value, {
    issueKey: "tenant-timezone-invalid",
    label: "Tenant timezone",
    maxLength: 80,
    required: true,
    validationIssues,
  });

  if (!timezone) {
    return null;
  }

  if (!isValidTimeZone(timezone)) {
    validationIssues.push({
      detail: `タイムゾーン ${timezone} を認識できません。`,
      key: "tenant-timezone-invalid",
      label: "Tenant timezone",
      severity: "ERROR",
    });

    return null;
  }

  return timezone;
}

function readImportTenantType(
  value: unknown,
  validationIssues: OperationImportIssue[],
) {
  if (typeof value !== "string" || !tenantTypes.has(value)) {
    validationIssues.push({
      detail: "tenant.type が対応している種別ではありません。",
      key: "tenant-type-invalid",
      label: "Tenant type",
      severity: "ERROR",
    });

    return null;
  }

  return value as TenantTypeValue;
}

function readImportCounts(
  value: unknown,
  validationIssues: OperationImportIssue[],
) {
  const counts: Record<string, number> = {};

  if (!isRecord(value)) {
    validationIssues.push({
      detail: "counts オブジェクトが見つかりません。",
      key: "counts-missing",
      label: "Counts",
      severity: "ERROR",
    });

    return counts;
  }

  for (const [key, count] of Object.entries(value)) {
    if (isNonNegativeInteger(count)) {
      counts[key] = count;
      continue;
    }

    validationIssues.push({
      detail: `counts.${key} は 0 以上の整数である必要があります。`,
      key: `${key}-count-invalid`,
      label: "Counts",
      severity: "ERROR",
    });
  }

  return counts;
}

function readImportData(
  value: unknown,
  validationIssues: OperationImportIssue[],
) {
  const data: Record<string, unknown[]> = {};
  const expectedKeys = new Set<string>(
    operationsBackupDataSetDefinitions.map((definition) => definition.key),
  );
  const unknownDataKeys: string[] = [];

  if (!isRecord(value)) {
    validationIssues.push({
      detail: "data オブジェクトが見つかりません。",
      key: "data-missing",
      label: "Data",
      severity: "ERROR",
    });

    for (const definition of operationsBackupDataSetDefinitions) {
      data[definition.key] = [];
    }

    return { data, unknownDataKeys };
  }

  for (const [key, rows] of Object.entries(value)) {
    if (!expectedKeys.has(key)) {
      unknownDataKeys.push(key);
      continue;
    }

    if (!Array.isArray(rows)) {
      data[key] = [];
      validationIssues.push({
        detail: `data.${key} は配列である必要があります。`,
        key: `${key}-data-invalid`,
        label: "Data",
        severity: "ERROR",
      });
      continue;
    }

    data[key] = rows;
    const nonRecordRows = rows.filter((row) => !isRecord(row)).length;

    if (nonRecordRows > 0) {
      validationIssues.push({
        detail: `${nonRecordRows} 件の行がオブジェクトではありません。`,
        key: `${key}-row-invalid`,
        label: key,
        severity: "ERROR",
      });
    }
  }

  for (const definition of operationsBackupDataSetDefinitions) {
    if (data[definition.key]) {
      continue;
    }

    data[definition.key] = [];
    validationIssues.push({
      detail: `data.${definition.key} が見つかりません。`,
      key: `${definition.key}-data-missing`,
      label: definition.label,
      severity: "ERROR",
    });
  }

  if (unknownDataKeys.length > 0) {
    validationIssues.push({
      detail: `未対応の data キーがあります: ${unknownDataKeys.join(", ")}`,
      key: "unknown-data-keys",
      label: "Data",
      severity: "WARNING",
    });
  }

  return { data, unknownDataKeys };
}

function readImportInteger(value: unknown) {
  if (!isNonNegativeInteger(value)) {
    return null;
  }

  return value;
}

function readImportDate(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return value;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isValidTimeZone(timezone: string) {
  try {
    new Intl.DateTimeFormat("ja-JP", { timeZone: timezone }).format(
      new Date(),
    );
    return true;
  } catch {
    return false;
  }
}
