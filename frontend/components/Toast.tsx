import React, { useEffect, useRef } from "react";
import { useAppContext, ToastMessage } from "../context/AppContext";

const icons: Record<ToastMessage["type"], string> = {
  success: "✅",
  error: "❌",
  info: "ℹ️",
};

const colors: Record<ToastMessage["type"], { bg: string; border: string; text: string }> = {
  success: { bg: "rgba(16,185,129,0.15)", border: "rgba(16,185,129,0.4)", text: "#10b981" },
  error: { bg: "rgba(239,68,68,0.15)", border: "rgba(239,68,68,0.4)", text: "#ef4444" },
  info: { bg: "rgba(14,165,233,0.15)", border: "rgba(14,165,233,0.4)", text: "#0ea5e9" },
};

function ToastItem({ toast }: { toast: ToastMessage }) {
  const { removeToast } = useAppContext();
  const c = colors[toast.type];

  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        background: "rgba(15,23,42,0.95)",
        border: `1px solid ${c.border}`,
        borderRadius: 12,
        padding: "14px 16px",
        minWidth: 300,
        maxWidth: 380,
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        animation: "toast-in 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      <span style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>{icons[toast.type]}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: c.text, marginBottom: 2 }}>
          {toast.title}
        </div>
        <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.4 }}>{toast.message}</div>
      </div>
      <button
        onClick={() => removeToast(toast.id)}
        aria-label="Dismiss notification"
        style={{
          background: "none",
          border: "none",
          color: "#64748b",
          cursor: "pointer",
          fontSize: 16,
          padding: 0,
          lineHeight: 1,
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        ×
      </button>
    </div>
  );
}

export function ToastContainer() {
  const { toasts } = useAppContext();

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 20,
        right: 20,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        pointerEvents: "none",
      }}
    >
      {toasts.map((t) => (
        <div key={t.id} style={{ pointerEvents: "auto" }}>
          <ToastItem toast={t} />
        </div>
      ))}
    </div>
  );
}
