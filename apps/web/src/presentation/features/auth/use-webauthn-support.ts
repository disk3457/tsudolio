"use client";

import { useSyncExternalStore } from "react";
import { browserSupportsWebAuthn } from "@simplewebauthn/browser";

export function useWebAuthnSupport() {
  return useSyncExternalStore(
    subscribeToWebAuthnSupport,
    readWebAuthnSupport,
    readServerWebAuthnSupport,
  );
}

function subscribeToWebAuthnSupport(onStoreChange: () => void) {
  const timeoutId = window.setTimeout(onStoreChange, 0);

  return () => window.clearTimeout(timeoutId);
}

function readWebAuthnSupport() {
  return browserSupportsWebAuthn();
}

function readServerWebAuthnSupport() {
  return false;
}
