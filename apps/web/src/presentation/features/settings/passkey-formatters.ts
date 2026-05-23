import type { PasskeySummary } from "@/application/security/types";

export function formatPasskeyDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
  }).format(new Date(value));
}

export function formatOptionalDate(value: string | null | undefined) {
  if (!value) {
    return "なし";
  }

  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
  }).format(new Date(value));
}

export function formatPasskeyDevice(passkey: PasskeySummary) {
  const deviceType =
    passkey.deviceType === "multiDevice" ? "同期対応" : "端末固定";

  return passkey.backedUp ? `${deviceType} / バックアップ済み` : deviceType;
}

export function formatPasskeyTransports(transports: string[]) {
  if (transports.length === 0) {
    return "方式未記録";
  }

  const labels: Record<string, string> = {
    ble: "BLE",
    cable: "CA BLE",
    hybrid: "ハイブリッド",
    internal: "内蔵",
    nfc: "NFC",
    "smart-card": "スマートカード",
    usb: "USB",
  };

  return transports
    .map((transport) => labels[transport] ?? transport)
    .join(" / ");
}
