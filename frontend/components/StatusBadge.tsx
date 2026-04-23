import React from "react";
import { useAppContext, SystemMode } from "../context/AppContext";

interface StatusBadgeProps {
  mode?: SystemMode;
  size?: "sm" | "md";
}

const modeConfig: Record<
  SystemMode,
  { label: string; dot: string; bg: string; border: string; text: string }
> = {
  live: {
    label: "Live Mode",
    dot: "bg-green-400",
    bg: "rgba(16,185,129,0.12)",
    border: "rgba(16,185,129,0.35)",
    text: "#10b981",
  },
  test: {
    label: "Test Mode",
    dot: "bg-amber-400",
    bg: "rgba(245,158,11,0.12)",
    border: "rgba(245,158,11,0.35)",
    text: "#f59e0b",
  },
  offline: {
    label: "Provider Offline",
    dot: "bg-red-500",
    bg: "rgba(239,68,68,0.12)",
    border: "rgba(239,68,68,0.35)",
    text: "#ef4444",
  },
};

export function StatusBadge({ mode, size = "md" }: StatusBadgeProps) {
  const { systemMode } = useAppContext();
  const activeMode = mode ?? systemMode;
  const cfg = modeConfig[activeMode];

  const dotSize = size === "sm" ? 6 : 8;
  const fontSize = size === "sm" ? 10 : 11;
  const padding = size === "sm" ? "2px 8px" : "4px 12px";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: cfg.bg,
        color: cfg.text,
        border: `1px solid ${cfg.border}`,
        borderRadius: 999,
        fontSize,
        fontWeight: 700,
        letterSpacing: "0.05em",
        textTransform: "uppercase" as const,
        padding,
        whiteSpace: "nowrap" as const,
      }}
    >
      <span
        style={{
          width: dotSize,
          height: dotSize,
          borderRadius: "50%",
          background: cfg.text,
          display: "inline-block",
          flexShrink: 0,
          animation: activeMode === "live" ? "glow-pulse 2s ease-in-out infinite" : "none",
        }}
      />
      {activeMode === "live" ? "🟢" : activeMode === "test" ? "🟡" : "🔴"} {cfg.label}
    </span>
  );
}
