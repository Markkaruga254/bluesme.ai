import React from "react";

interface LoaderProps {
  size?: number;
  color?: string;
  label?: string;
}

export function Loader({ size = 24, color = "#0ea5e9", label }: LoaderProps) {
  return (
    <span
      role="status"
      aria-label={label ?? "Loading"}
      style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
    >
      <span
        style={{
          display: "inline-block",
          width: size,
          height: size,
          border: `${Math.max(2, size / 8)}px solid ${color}33`,
          borderTop: `${Math.max(2, size / 8)}px solid ${color}`,
          borderRadius: "50%",
          animation: "spin 0.7s linear infinite",
          flexShrink: 0,
        }}
      />
      {label && (
        <span style={{ fontSize: 13, color: "#94a3b8", fontWeight: 500 }}>
          {label}
        </span>
      )}
    </span>
  );
}

export function SkeletonCard() {
  return (
    <div
      style={{
        background: "rgba(30,41,59,0.6)",
        border: "1px solid rgba(148,163,184,0.1)",
        borderRadius: 16,
        padding: "20px 22px",
        minHeight: 110,
      }}
    >
      <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 12, marginBottom: 14 }} />
      <div className="skeleton" style={{ width: "60%", height: 20, marginBottom: 8 }} />
      <div className="skeleton" style={{ width: "40%", height: 13 }} />
    </div>
  );
}

export function SkeletonLine({ width = "100%", height = 14 }: { width?: string; height?: number }) {
  return (
    <div
      className="skeleton"
      style={{ width, height, borderRadius: 6, marginBottom: 8 }}
    />
  );
}
